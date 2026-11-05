
import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
  Alert,
  BackHandler,
  Keyboard,
  ActivityIndicator,
  Linking,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Menu,
  Plus,
  Search,
  Mic,
  Send,
  Globe,
  WifiOff,
  Settings,
  MessageCircle,
  History,
  X,
  ChevronRight,
  Sparkles,
  LogOut,
  Volume2,
  FileSpreadsheet,
  NotebookPen,
  Paperclip,
} from 'lucide-react-native';

import SukiMascot from '@/components/SukiMascot';
import { SUKI_CHAT_URL } from '@/services/api';
import { deleteTemporaryPdf, pickPdf } from '@/services/pdfPicker';
import { exportExpenses, exportNotes, type ExportRange } from '@/services/exportXlsx';
import { captureAndSearch } from '@/services/captureSearch';
import { useSukiSpeech } from '@/hooks/useSukiSpeech';
import { initializeDatabase, getExpenses, getNotes, replaceExpenses, replaceNotes, migrateLegacyRecords } from '@/services/database';
import { parseExpenseCommand } from '@/services/localCommands';

type ExpenseRecord = {
  id: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
};

type NoteRecord = {
  id: string;
  text: string;
  date: string;
};

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'suki';
};

type PendingConfirmation = { kind: 'expense' | 'note'; id: string };
type EditingRecord = { kind: 'expense' | 'note'; id: string } | null;
type PendingCapture = { kind: 'expense'; amount?: number; category?: string } | { kind: 'note'; text?: string } | { kind: 'choose'; text: string };

const GREEN = '#55C9F2';
const BACKGROUND = '#050705';
const SURFACE = '#111611';
const MUTED = '#858D80';

const chooseReply = (options: string[]) => options[Math.floor(Math.random() * options.length)];
// URL is validated before it can ever reach React Native fetch().

export default function HomeScreen() {
  const [internet, setInternet] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [editingRecord, setEditingRecord] = useState<EditingRecord>(null);
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  const [recordsVisible, setRecordsVisible] = useState(false);
  const speech = useSukiSpeech((transcript) => { setMessage(transcript); setVoiceVisible(false); });
  const chatRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  // Restore internet preference.
  useEffect(() => {
    let active = true;

    AsyncStorage.getItem('suki.internet.enabled')
      .then((value) => {
        if (active && value !== null) {
          setInternet(value === 'true');
        }
      })
      .catch((error) => {
        console.warn('Could not restore settings:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  // Restore private, on-device expense and note records.
  useEffect(() => {
    let active = true;
    (async () => {
      await initializeDatabase();
      const [savedExpenses, savedNotes, savedPending] = await Promise.all([
        AsyncStorage.getItem('suki.expenses.v1'),
        AsyncStorage.getItem('suki.notes.v1'),
        AsyncStorage.getItem('suki.pending-confirmation.v1'),
      ]);
      const legacyExpenses = savedExpenses ? JSON.parse(savedExpenses) as ExpenseRecord[] : [];
      const legacyNotes = savedNotes ? JSON.parse(savedNotes) as NoteRecord[] : [];
      await migrateLegacyRecords({ expenses: legacyExpenses, notes: legacyNotes });
      await AsyncStorage.multiRemove(['suki.expenses.v1', 'suki.notes.v1']);
      const [dbExpenses, dbNotes] = await Promise.all([getExpenses(), getNotes()]);
      if (!active) return;
      setExpenses(dbExpenses);
      setNotes(dbNotes);
      if (savedPending) setPendingConfirmation(JSON.parse(savedPending) as PendingConfirmation);
    })().catch((error) => {
      console.warn('Could not restore Suki local records:', error);
      Alert.alert('Local storage', 'Suki could not load some saved records.');
    }).finally(() => {
      if (active) setLocalDataReady(true);
    });
    return () => { active = false; };
  }, []);

  // Persist internet preference.
  const toggleInternet = async (value: boolean) => {
    setInternet(value);

    try {
      await AsyncStorage.setItem(
        'suki.internet.enabled',
        String(value)
      );
    } catch (error) {
      console.warn('Could not save settings:', error);
      Alert.alert(
        'Storage error',
        'Your internet preference could not be saved.'
      );
    }
  };

  const appendLocalReply = (text: string) => {
    setMessages((previous) => [
      ...previous,
      { id: `${Date.now()}-suki-local`, text, sender: 'suki' },
    ]);
  };

  const persistExpenses = async (next: ExpenseRecord[]) => {
    await replaceExpenses(next);
    setExpenses(next);
  };

  const persistNotes = async (next: NoteRecord[]) => {
    await replaceNotes(next);
    setNotes(next);
  };

  const setPending = async (value: PendingConfirmation | null) => {
    setPendingConfirmation(value);
    if (value) await AsyncStorage.setItem('suki.pending-confirmation.v1', JSON.stringify(value));
    else await AsyncStorage.removeItem('suki.pending-confirmation.v1');
  };

  const localDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const monthName = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleString('en-IN', { month: 'long' });

  const handleLocalCommand = async (text: string): Promise<boolean> => {
    const lower = text.toLowerCase();
    const today = localDate();

    const exportMatch = /^export\s+(expenses|notes)\s+(all|today|this month|this year|\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2})(?:\s+(csv|xlsx))?$/i.exec(text.trim());
    if (exportMatch) {
      const kind = exportMatch[1].toLowerCase() as 'expenses' | 'notes';
      const period = exportMatch[2].toLowerCase();
      const format = (exportMatch[3]?.toLowerCase() ?? 'xlsx') as 'csv' | 'xlsx';
      let range: ExportRange;
      if (period === 'today') range = { startDate: today, endDate: today, label: 'today' };
      else if (period === 'this month') range = { startDate: `${today.slice(0, 7)}-01`, endDate: today, label: 'this month' };
      else if (period === 'this year') range = { startDate: `${today.slice(0, 4)}-01-01`, endDate: `${today.slice(0, 4)}-12-31`, label: today.slice(0, 4) };
      else if (period === 'all') range = { label: 'all records' };
      else {
        const dates = /^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/.exec(period);
        if (!dates || dates[1] > dates[2]) {
          appendLocalReply('Use a valid range, e.g. export expenses 2026-01-01 to 2026-01-31 csv.');
          return true;
        }
        range = { startDate: dates[1], endDate: dates[2], label: `${dates[1]} to ${dates[2]}` };
      }
      await exportRecords(kind, range, format);
      return true;
    }

    // Read/query commands take priority over a pending expense clarification.
    // This prevents "show my expenses" being saved as the category of a prior amount.
    const isExpenseSummary = /\b(show|list|get|find|total|how much|what).*(my )?(expenses|expense|spending)|\b(expenses|spending).*(this month|last month|today|yesterday|january|february|march|april|may|june|july|august|september|october|november|december|20\d{2})/i.test(text);
    if (isExpenseSummary) {
      const monthMatch = /(january|february|march|april|may|june|july|august|september|october|november|december)/i.exec(lower);
      const requestedMonth = monthMatch?.[1].toLowerCase();
      const yearMatch = /\b(20\d{2})\b/.exec(lower);
      const requestedYear = yearMatch ? Number(yearMatch[1]) : null;
      const now = new Date();
      const filtered = expenses.filter((item) => {
        const itemDate = new Date(`${item.date}T12:00:00`);
        if (requestedYear && itemDate.getFullYear() !== requestedYear) return false;
        if (requestedMonth && monthName(item.date).toLowerCase() !== requestedMonth) return false;
        if (lower.includes('last month')) {
          const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return itemDate.getMonth() === previous.getMonth() && itemDate.getFullYear() === previous.getFullYear();
        }
        if (lower.includes('this month')) return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        if (lower.includes('today')) return item.date === today;
        return true;
      });
      if (!filtered.length) {
        appendLocalReply(`No expenses found${requestedMonth ? ` for ${requestedMonth}` : requestedYear ? ` in ${requestedYear}` : ''}.`);
      } else {
        const total = filtered.reduce((sum, item) => sum + item.amount, 0);
        const lines = filtered.slice(0, 30).map((item) => `• ${item.date}: ₹${item.amount.toLocaleString('en-IN')} · ${item.category}`);
        appendLocalReply(`Here are your saved expenses:\n${lines.join('\n')}\n\nTotal: ₹${total.toLocaleString('en-IN')}${filtered.length > 30 ? `\nShowing 30 of ${filtered.length} records.` : ''}`);
      }
      setPendingCapture(null);
      if (pendingConfirmation) await setPending(null);
      return true;
    }

    // Retrieve notes before interpreting any pending clarification.
    if (/(show|find|get|search|list).*(my )?(notes|memos)|my notes/i.test(lower)) {
      const yearMatch = /\b(20\d{2})\b/.exec(lower);
      const monthMatch = /(january|february|march|april|may|june|july|august|september|october|november|december)/i.exec(lower);
      const matchingNotes = notes.filter((item) =>
        (!yearMatch || item.date.startsWith(yearMatch[1])) &&
        (!monthMatch || monthName(item.date).toLowerCase() === monthMatch[1].toLowerCase())
      );
      appendLocalReply(matchingNotes.length
        ? `Your notes:\n${matchingNotes.slice(0, 30).map((item) => `• ${item.date}: ${item.text}`).join('\n')}`
        : 'No matching notes found.');
      setPendingCapture(null);
      if (pendingConfirmation) await setPending(null);
      return true;
    }

    // DELETE without an active selected record must not become a new expense/note.
    if (/^(delete|remove)$/i.test(lower) && !editingRecord) {
      setPendingCapture(null);
      if (pendingConfirmation) await setPending(null);
      appendLocalReply('No individual record is selected. Open the menu → Manage Records, then choose DELETE beside the exact expense or note. I will not delete anything without a selected record.');
      return true;
    }

    // Ordinary conversation must never be treated as an expense draft.
    const isGeneralRequest = /^(help|what can you do|how|why|when|where|who|tell me|organize|organise|plan|suggest|explain|hello|hi|hey|thanks|thank you)\b/i.test(lower);
    if (isGeneralRequest) {
      setPendingCapture(null);
      if (pendingConfirmation) await setPending(null);
      return false;
    }

    // Resolve the previous save prompt before interpreting a new command.
    if (pendingConfirmation) {
      if (/^(yes|y|yeah|yep|sure|show|check|view)$/i.test(lower)) {
        const pending = pendingConfirmation;
        await setPending(null);
        if (pending.kind === 'expense') {
          const record = expenses.find((item) => item.id === pending.id);
          if (record) {
            setEditingRecord({ kind: 'expense', id: record.id });
            appendLocalReply(`Here is your saved expense:\nDate: ${record.date}\nAmount: ₹${record.amount.toLocaleString('en-IN')}\nCategory: ${record.category}\n\nTo edit it, type: \"change amount to 1200\" or \"change category to groceries\". Type DELETE to remove it, or DONE to finish.`);
          } else appendLocalReply('I could not find that saved expense. Your other records are safe.');
        } else {
          const record = notes.find((item) => item.id === pending.id);
          if (record) {
            setEditingRecord({ kind: 'note', id: record.id });
            appendLocalReply(`Here is your saved note:\n${record.date}\n${record.text}\n\nType \"change note to ...\" to edit it, DELETE to remove it, or DONE to finish.`);
          } else appendLocalReply('I could not find that saved note.');
        }
        return true;
      }
      if (/^(no|n|nope|not now|skip)$/i.test(lower)) {
        await setPending(null);
        appendLocalReply(chooseReply(['No worries. It is saved, and I will leave it right there. 💙','Done. Your entry is safe. I will not make a ceremony out of it.','All good. Saved quietly in the background. 💙']));
        return true;
      }
      // A different command implicitly dismisses the previous prompt.
      await setPending(null);
    }

    if (editingRecord) {
      if (/^(done|finish|cancel)$/i.test(lower)) {
        setEditingRecord(null);
        appendLocalReply('All set. Your changes are saved. 💙');
        return true;
      }
      if (/^(delete|remove)$/i.test(lower)) {
        if (editingRecord.kind === 'expense') {
          await persistExpenses(expenses.filter((item) => item.id !== editingRecord.id));
        } else {
          await persistNotes(notes.filter((item) => item.id !== editingRecord.id));
        }
        setEditingRecord(null);
        appendLocalReply('Deleted that entry from this phone.');
        return true;
      }
      if (editingRecord.kind === 'expense') {
        const amountEdit = /(?:change|update|set)\s+amount\s+to\s+₹?([\d,]+(?:\.\d{1,2})?)/i.exec(text);
        const categoryEdit = /(?:change|update|set)\s+category\s+to\s+(.+)/i.exec(text);
        const target = expenses.find((item) => item.id === editingRecord.id);
        if (target && (amountEdit || categoryEdit)) {
          const updated = expenses.map((item) => item.id !== target.id ? item : {
            ...item,
            ...(amountEdit ? { amount: Number(amountEdit[1].replace(/,/g, '')) } : {}),
            ...(categoryEdit ? { category: categoryEdit[1].trim().replace(/[.!?]+$/, '') } : {}),
          });
          await persistExpenses(updated);
          appendLocalReply('Updated your expense successfully. Type DONE when you have finished editing.');
          return true;
        }
      } else {
        const noteEdit = /(?:change|update)\s+note\s+to\s+(.+)/i.exec(text);
        if (noteEdit) {
          await persistNotes(notes.map((item) => item.id === editingRecord.id ? { ...item, text: noteEdit[1].trim() } : item));
          appendLocalReply('Updated your note. Type DONE when you have finished editing.');
          return true;
        }
      }
      appendLocalReply('I am in record-edit mode. Use the edit instructions above, or type DONE to leave.');
      return true;
    }

    // Natural expense capture. Accept amount/category in either order:
    // "1000 cafe", "Cafe 200", "₹1,000 groceries", "spent 500 on lunch".
    // When one field is missing, ask for that field and keep the draft in memory.
    const cleanCategory = (value: string) => value
      .replace(/\b(?:please|save|record|add|log|the|this|amount|expense|spent|paid|on|at|for|rupees?|rs\.?|inr)\b/gi, ' ')
      .replace(/[₹,:;.!?\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const parsedExpense = parseExpenseCommand(text);
    const explicitExpenseIntent = /\b(save|record|add|log|spent|paid|expense|cost)\b/i.test(text);

    const saveExpenseRecord = async (amount: number, category: string) => {
      const record: ExpenseRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount, category, date: today,
      };
      const next = [record, ...expenses];
      await persistExpenses(next);
      await setPending({ kind: 'expense', id: record.id });
      setPendingCapture(null);
      appendLocalReply(chooseReply([
        `Saved ₹${amount.toLocaleString('en-IN')} under ${category}. 💙 Want to review it? YES or NO.`,
        `Added to your expense sheet: ₹${amount.toLocaleString('en-IN')} · ${category}. Check the entry? YES or NO.`,
        `All recorded. ₹${amount.toLocaleString('en-IN')} tagged ${category}. Shall I show you? YES or NO.`,
      ]));
    };

    const saveNoteRecord = async (content: string) => {
      const record: NoteRecord = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: content, date: today };
      await persistNotes([record, ...notes]);
      await setPending({ kind: 'note', id: record.id });
      setPendingCapture(null);
      appendLocalReply(chooseReply([
        'Saved that in your notes. 💙 Want to review it? YES or NO.',
        'Tucked safely into your notes for today. Shall I show you? YES or NO.',
      ]));
    };

    // Explicit note phrases always route to Notes, never the expense parser.
    const noteMatch = /^(?:note|memo|remember|save note|save this note)\s*[:,-]?\s*(.*)$/i.exec(text);
    if (noteMatch) {
      const content = noteMatch[1].trim();
      if (content) { await saveNoteRecord(content); return true; }
      setPendingCapture({ kind: 'note' });
      appendLocalReply('What should I save in your notes?');
      return true;
    }

    // Continue a clarification before trying to interpret a fresh command.
    if (pendingCapture) {
      if (pendingCapture.kind === 'expense') {
        if (parsedExpense) {
          await saveExpenseRecord(parsedExpense.amount, parsedExpense.category);
          return true;
        }
        const amountOnly = /(?:₹\s*|\b(?:rs\.?|inr)\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i.exec(text);
        const amount = pendingCapture.amount ?? (amountOnly ? Number(amountOnly[1].replace(/,/g, '')) : NaN);
        const categoryFromReply = cleanCategory(text.replace(amountOnly?.[0] ?? '', ''));
        const category = pendingCapture.category || categoryFromReply;
        if (!Number.isFinite(amount) || amount <= 0) {
          appendLocalReply('I still need the amount. For example, type 1000.');
          return true;
        }
        if (!category) {
          setPendingCapture({ kind: 'expense', amount });
          appendLocalReply(`Got ₹${amount.toLocaleString('en-IN')}. What was it for? Type a tag like cafe, groceries, fuel or restaurant.`);
          return true;
        }
        await saveExpenseRecord(amount, category);
        return true;
      }
      if (pendingCapture.kind === 'note') {
        const content = text.replace(/^(?:note|memo|remember|notes?)\s*[:,-]?\s*/i, '').trim();
        if (!content) { appendLocalReply('What should I write in the note?'); return true; }
        await saveNoteRecord(content);
        return true;
      }
      const choice = /^(expense|spending|spent|amount)$/i.test(lower) ? 'expense'
        : /^(note|memo|remember)$/i.test(lower) ? 'note' : null;
      if (!choice) {
        appendLocalReply('Should I save that as an expense or a note? Type EXPENSE or NOTE.');
        return true;
      }
      const original = pendingCapture.text;
      if (choice === 'note') { await saveNoteRecord(original); return true; }
      const originalAmount = /(?:₹\s*|\b(?:rs\.?|inr)\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i.exec(original);
      const amount = originalAmount ? Number(originalAmount[1].replace(/,/g, '')) : NaN;
      const category = cleanCategory(original.replace(originalAmount?.[0] ?? '', ''));
      if (Number.isFinite(amount) && amount > 0 && category) { await saveExpenseRecord(amount, category); return true; }
      setPendingCapture({ kind: 'expense', ...(Number.isFinite(amount) && amount > 0 ? { amount } : {}), ...(category ? { category } : {}) });
      appendLocalReply(Number.isFinite(amount) && amount > 0 ? `Got ₹${amount.toLocaleString('en-IN')}. What was it for?` : category ? `What amount should I record under ${category}?` : 'Got it. What amount and what was it for? You can type “1000 cafe”.');
      return true;
    }

    // Parse expense entries consistently, regardless of amount/category order.
    if (parsedExpense) {
      await saveExpenseRecord(parsedExpense.amount, parsedExpense.category);
      return true;
    }

    if (explicitExpenseIntent) {
      const amountOnly = /(?:₹\s*|\b(?:rs\.?|inr)\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i.exec(text);
      const amount = amountOnly ? Number(amountOnly[1].replace(/,/g, '')) : NaN;
      const possibleCategory = cleanCategory(text.replace(amountOnly?.[0] ?? '', ''));
      if (Number.isFinite(amount) && amount > 0) {
        setPendingCapture({ kind: 'expense', amount });
        appendLocalReply(`Got ₹${amount.toLocaleString('en-IN')}. What was it for? Type a tag like cafe, groceries, fuel or restaurant.`);
      } else if (possibleCategory) {
        setPendingCapture({ kind: 'expense', category: possibleCategory });
        appendLocalReply(`What amount should I record under ${possibleCategory}?`);
      } else {
        setPendingCapture({ kind: 'expense' });
        appendLocalReply('I can save that as an expense. What amount and what was it for? For example: 1000 cafe.');
      }
      return true;
    }

    // Unknown short entries are never discarded. Ask which local sheet should receive them.
    if (text.length <= 100 && !/[?]$/.test(text) && !/^(show|find|get|search|list|help|how|what|why|when|where|who|tell|hello|hi|hey|thanks|thank|organize|organise|plan|suggest|explain)\b/i.test(text)) {
      setPendingCapture({ kind: 'choose', text });
      appendLocalReply('I can save that. Is it an EXPENSE or a NOTE?');
      return true;
    }

    return false;
  };

  useEffect(() => {
    const timer = setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, isSending]);

  // Local commands are handled on-device before any optional cloud request.
  const getOfflineReply = (input: string): string | null => {
    const value = input.toLowerCase().trim().replace(/[.!?]+$/, '');
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)$/.test(value)) return chooseReply(['Hey! 💙 What are we working on today?', 'Hello! Suki is here. What do you need?', 'Hi there! Ready when you are.']);
    if (/\b(joke|make me laugh|tell me something funny)\b/.test(value)) return 'Why did the developer go broke? Because they used up all their cache. 😄';
    if (/\b(tell me something interesting|interesting fact|fun fact)\b/.test(value)) return 'Octopuses have three hearts, blue blood, and neurons distributed through their arms. Their arms can perform some actions independently of the central brain. 🐙';
    if (/\b(help me organize my day|organize my day|organise my day|plan my day)\b/.test(value)) return 'Choose your 3 most important tasks, do the hardest one first, group small errands together, and reserve a proper break. Share your tasks and available hours for a realistic schedule.';
    if (/^(what can you do|help)$/.test(value)) return 'I can save and find expenses and notes offline, export your records, capture images for visual search, and help with questions when online AI is configured. Your private records stay on this device.';
    return null;
  };

  const attachAndAnalyzePdf = async () => {
    if (isSending) return;
    try {
      const pdf = await pickPdf();
      if (!pdf) return;
      if (pdf.size > 15 * 1024 * 1024) {
        await deleteTemporaryPdf(pdf.uri);
        Alert.alert('PDF too large', 'Choose a PDF smaller than 15 MB.');
        return;
      }
      if (!internet) {
        await deleteTemporaryPdf(pdf.uri);
        Alert.alert('Online analysis is off', 'PDF analysis sends the selected document to your configured Suki backend and AI provider. Turn on Online Access to continue.');
        return;
      }
      const chatUrl = SUKI_CHAT_URL;
      if (!chatUrl) {
        await deleteTemporaryPdf(pdf.uri);
        Alert.alert('Online AI not configured', 'Set EXPO_PUBLIC_API_URL to your deployed HTTPS backend and rebuild the app.');
        return;
      }
      const question = message.trim() || 'Summarize this PDF. Extract key findings, important dates, numbers, and action items.';
      Alert.alert(
        'Send PDF for analysis?',
        `Suki will upload “${pdf.name}” (${(pdf.size / 1024 / 1024).toFixed(2)} MB) to your configured backend. The backend extracts its text and sends that text to the configured AI provider. This is not on-device processing. Continue?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { void deleteTemporaryPdf(pdf.uri); } },
          { text: 'Upload & analyze', onPress: async () => {
            const userMessage: Message = { id: `${Date.now()}-user-pdf`, text: `📄 ${pdf.name}
${question}`, sender: 'user' };
            setMessages((previous) => [...previous, userMessage]);
            setMessage('');
            setIsSending(true);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120000);
            try {
              const form = new FormData();
              form.append('file', { uri: pdf.uri, name: pdf.name, type: 'application/pdf' } as unknown as Blob);
              form.append('question', question);
              const endpoint = chatUrl.replace(/\/chat\/?$/, '/documents/analyze');
              const response = await fetch(endpoint, { method: 'POST', body: form, signal: controller.signal });
              const data = await response.json().catch(() => null) as { reply?: string; detail?: string; page_count?: number; used_ocr?: boolean } | null;
              if (!response.ok) throw new Error(data?.detail || `Server returned HTTP ${response.status}`);
              if (!data?.reply?.trim()) throw new Error('The PDF analysis returned an empty response.');
              const metadata = `PDF analysis complete · ${data.page_count ?? '?'} pages${data.used_ocr ? ' · scanned-page OCR used' : ''}.\n\n`;
              appendLocalReply(metadata + data.reply.trim());
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'Unknown error.';
              appendLocalReply(`I couldn't analyze that PDF: ${detail}`);
            } finally {
              clearTimeout(timeout);
              await deleteTemporaryPdf(pdf.uri).catch(() => undefined);
              setIsSending(false);
            }
          } },
        ],
      );
    } catch (error) {
      Alert.alert('Attach PDF', error instanceof Error ? error.message : 'Could not select the PDF.');
    }
  };

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    if (!localDataReady) {
      Alert.alert('Suki is getting ready', 'Please wait while your local records load.');
      return;
    }

    Keyboard.dismiss();
    const userMessage: Message = {
      id: `${Date.now()}-user`,
      text: trimmed,
      sender: 'user',
    };
    setMessages((previous) => [...previous, userMessage]);
    setMessage('');
    setIsSending(true);

    try {
      const handledLocally = await handleLocalCommand(trimmed);
      if (handledLocally) return;

      if (!internet) {
        const localReply = getOfflineReply(trimmed);
        if (localReply) {
          appendLocalReply(localReply);
          return;
        }
        appendLocalReply('I can save expenses and notes offline. Type “1000 cafe”, “Cafe 200”, or “Note: call home”. For open-ended questions, online access is currently disabled.');
        return;
      }

      const history = [...messages, userMessage].slice(-12).map((item) => ({
        role: item.sender === 'user' ? 'user' as const : 'model' as const,
        content: item.text,
      }));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      let response: Response;
      try {
        if (!SUKI_CHAT_URL) {
          appendLocalReply('Online chat is not configured yet. Set EXPO_PUBLIC_API_URL to your deployed HTTPS backend endpoint in mobile/.env and rebuild the app. Do not use a laptop LAN address in a distributed APK. Your offline records still work.');
          return;
        }
        response = await fetch(SUKI_CHAT_URL, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json().catch(() => null) as
        | { reply?: string; detail?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.detail || `Server returned HTTP ${response.status}`);
      }

      if (typeof data?.reply !== 'string' || !data.reply.trim()) {
        throw new Error('Suki returned an empty response.');
      }

      appendLocalReply(data.reply.trim());
    } catch (error) {
      console.error('Suki request error:', error);
      const detail = error instanceof Error ? error.message : 'Unknown error.';
      appendLocalReply(`I couldn't save or complete that request: ${detail}`);
    } finally {
      setIsSending(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setMessage('');
    setMenuVisible(false);
  };

  const exportRecords = async (kind: 'expenses' | 'notes', range: ExportRange, format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      if (kind === 'expenses') await exportExpenses(expenses, range, format);
      else await exportNotes(notes, range, format);
      appendLocalReply(`Your ${kind} export (${range.label}, ${format.toUpperCase()}) is ready to share. 💙`);
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Could not create the export.');
    }
  };

  const chooseExport = (kind: 'expenses' | 'notes') => {
    const today = localDate();
    const monthStart = `${today.slice(0, 7)}-01`;
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const yearEnd = `${today.slice(0, 4)}-12-31`;
    const chooseFormat = (range: ExportRange) => Alert.alert('Export format', `Export ${kind} for ${range.label}.`, [
      { text: 'Excel (.xlsx)', onPress: () => void exportRecords(kind, range, 'xlsx') },
      { text: 'CSV (.csv)', onPress: () => void exportRecords(kind, range, 'csv') },
      { text: 'Cancel', style: 'cancel' },
    ]);
    Alert.alert(`Export ${kind}`, 'Choose a date range.', [
      { text: 'Today', onPress: () => chooseFormat({ startDate: today, endDate: today, label: 'today' }) },
      { text: 'This month', onPress: () => chooseFormat({ startDate: monthStart, endDate: today, label: 'this month' }) },
      { text: 'This year', onPress: () => chooseFormat({ startDate: yearStart, endDate: yearEnd, label: today.slice(0, 4) }) },
    ]);
  };

  const openSearch = async () => {
    const query = message.trim();
    if (!query) {
      Alert.alert('Search the web', 'Type what you want to search in the chat box first, then choose Search.');
      return;
    }
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Unable to open browser', 'Check that a browser is installed.'); }
  };

  const runCaptureSearch = async () => {
    setMenuVisible(false);
    try {
      const result = await captureAndSearch();
      if (!result.cancelled) {
        appendLocalReply(result.recognizedText
          ? `Your image was shared with the visual-search chooser. Select Google Lens or another compatible app. I also detected this text:\n${result.recognizedText.slice(0, 500)}`
          : 'Your image was shared with the visual-search chooser. Select Google Lens or another compatible app to search visually. No readable text was detected, but visual search does not depend on OCR.');
      }
    } catch (error) {
      Alert.alert('Capture to Search', error instanceof Error ? error.message : 'Could not process the image.');
    }
  };

  const openMenuItem = (item: string) => {
    setMenuVisible(false);

    switch (item) {
      case 'New Chat':
        newChat();
        break;

      case 'Voice Mode':
        setVoiceVisible(true);
        break;

      case 'Settings':
        setSettingsVisible(true);
        break;
      case 'About':
        Alert.alert('About Suki', 'Suki is your personal AI companion.\n\nCreated by Phantom.\nGitHub: github.com/Santhosh28-Lancer', [
          { text: 'Close', style: 'cancel' },
          { text: 'Open GitHub', onPress: () => { void Linking.openURL('https://github.com/Santhosh28-Lancer'); } },
        ]);
        break;

      case 'Explore / Search':
        void openSearch();
        break;
      case 'Capture to Search':
        void runCaptureSearch();
        break;
      case 'Manage Records':
        setRecordsVisible(true);
        break;

      case 'Export Expenses':
        chooseExport('expenses');
        break;

      case 'Export Notes':
        chooseExport('notes');
        break;

      case 'App Usage':
        Alert.alert(
          'Activity Awareness',
          'Android app usage tracking and permission management are coming in a later milestone.'
        );
        break;

      case 'Memory':
        Alert.alert(
          'Suki Memory',
          'Persistent personal memory is coming in a later milestone.'
        );
        break;

      case 'Chat History':
        Alert.alert(
          'Chat History',
          'Conversation persistence will be implemented in the storage milestone.'
        );
        break;

      case 'Exit':
        Alert.alert(
          'Leaving already?',
          'Do you want to close Suki?',
          [
            {
              text: 'Stay',
              style: 'cancel',
            },
            {
              text: 'Exit',
              style: 'destructive',
              onPress: () => BackHandler.exitApp(),
            },
          ]
        );
        break;
    }
  };

  const menuItems = [
    { name: 'New Chat', icon: Plus },
    { name: 'Chat History', icon: History },
    { name: 'Explore / Search', icon: Search },
    { name: 'Capture to Search', icon: Search },
    { name: 'Manage Records', icon: NotebookPen },
    { name: 'Export Expenses', icon: FileSpreadsheet },
    { name: 'Export Notes', icon: NotebookPen },
    { name: 'About', icon: MessageCircle },
    { name: 'Voice Mode', icon: Mic },
    { name: 'Memory', icon: MessageCircle },
    { name: 'App Usage', icon: Volume2 },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={styles.iconButton}
            accessibilityLabel="Open navigation menu"
          >
            <Menu color="#FFFFFF" size={23} />
          </Pressable>

          <View style={styles.brand}>
            <Text style={styles.brandTitle}>
              suki<Text style={{ color: GREEN }}>.</Text>
            </Text>

            <Text style={styles.brandSubtitle}>
              YOUR PERSONAL COMPANION
            </Text>
          </View>

          <Pressable
            onPress={newChat}
            style={styles.iconButton}
            accessibilityLabel="Start new chat"
          >
            <Plus color="#FFFFFF" size={23} />
          </Pressable>
        </View>

        {/* INTERNET CONTROL */}
        <View style={styles.internetCard}>
          <View style={styles.internetLeft}>
            <View
              style={[
                styles.statusIcon,
                {
                  backgroundColor: internet
                    ? '#24351A'
                    : '#242424',
                },
              ]}
            >
              {internet ? (
                <Globe size={17} color={GREEN} />
              ) : (
                <WifiOff size={17} color="#A1A1A1" />
              )}
            </View>

            <View>
              <Text style={styles.internetTitle}>
                Internet Access
              </Text>

              <Text style={styles.internetSubtitle}>
                {internet
                  ? 'Online preference enabled'
                  : 'Offline preference enabled'}
              </Text>
            </View>
          </View>

          <Switch
            value={internet}
            onValueChange={toggleInternet}
            trackColor={{
              false: '#383838',
              true: '#456E24',
            }}
            thumbColor={internet ? GREEN : '#BBBBBB'}
          />
        </View>

        {/* CHAT AREA */}
        <ScrollView
          ref={chatRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.welcome}>

              {/* SUKI CHARACTER */}
              <View style={styles.mascotGlow}>
                <SukiMascot size={205} />
              </View>

              <Text style={styles.greeting}>
                Hello, I'm Suki
                <Text style={{ color: GREEN }}>.</Text>
              </Text>

              <Text style={styles.description}>
                Your personal AI companion.
                {'\n'}
                Here to help, think and occasionally
                judge your decisions.
              </Text>

              {/* SUGGESTIONS */}
              <View style={styles.suggestionContainer}>
                <Text style={styles.suggestionHeading}>
                  LET'S GET STARTED
                </Text>

                <Pressable
                  style={styles.suggestion}
                  onPress={() =>
                    setMessage('Tell me something interesting.')
                  }
                >
                  <Sparkles size={17} color={GREEN} />

                  <Text style={styles.suggestionText}>
                    Tell me something interesting
                  </Text>

                  <ChevronRight size={17} color={MUTED} />
                </Pressable>

                <Pressable
                  style={styles.suggestion}
                  onPress={() =>
                    setMessage('Help me organize my day.')
                  }
                >
                  <History size={17} color={GREEN} />

                  <Text style={styles.suggestionText}>
                    Help me organize my day
                  </Text>

                  <ChevronRight size={17} color={MUTED} />
                </Pressable>

                <Pressable
                  style={styles.suggestion}
                  onPress={() =>
                    setMessage('What can you do?')
                  }
                >
                  <MessageCircle size={17} color={GREEN} />

                  <Text style={styles.suggestionText}>
                    What can you do?
                  </Text>

                  <ChevronRight size={17} color={MUTED} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.messages}>
              {messages.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.messageBubble,
                    item.sender === 'user'
                      ? styles.userBubble
                      : styles.sukiBubble,
                  ]}
                >
                  <Text style={styles.messageSender}>
                    {item.sender === 'user' ? 'YOU' : 'SUKI'}
                  </Text>

                  <Text style={styles.messageText}>
                    {item.text}
                  </Text>
                </View>
              ))}
              {isSending && (
                <View
                  style={[
                    styles.sukiBubble,
                    {
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                    },
                  ]}
                >
                  <ActivityIndicator size="small" color={GREEN} />
                  <Text style={styles.messageText}>Suki is thinking...</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* CHAT COMPOSER */}
        <View style={styles.composerArea}>
          <View style={styles.composer}>
            <Pressable
              style={styles.composerIcon}
              onPress={() => { void attachAndAnalyzePdf(); }}
              accessibilityLabel="Attach and analyze PDF"
              disabled={isSending}
            >
              <Paperclip color={GREEN} size={21} />
            </Pressable>

            <Pressable
              style={styles.composerIcon}
              onPress={() => { setVoiceVisible(true); void speech.start().catch((e) => Alert.alert('Microphone', e instanceof Error ? e.message : 'Speech recognition unavailable.')); }}
              accessibilityLabel="Start voice input"
            >
              <Mic color={GREEN} size={22} />
            </Pressable>

            <TextInput
              style={styles.input}
              placeholder="Message Suki..."
              placeholderTextColor="#737B70"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={4000}
              returnKeyType="default"
            />

            <Pressable
              style={[
                styles.sendButton,
                {
                  opacity: message.trim() && !isSending ? 1 : 0.5,
                },
              ]}
              onPress={sendMessage}
              disabled={!message.trim() || isSending}
              accessibilityLabel="Send message"
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#101510" />
              ) : (
                <Send color="#101510" size={19} />
              )}
            </Pressable>
          </View>

          <Text style={styles.footerText}>
            SUKI · YOUR WORLD, YOUR RULES
          </Text>
        </View>

      </KeyboardAvoidingView>

      {/* NAVIGATION DRAWER */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setMenuVisible(false)}
          />

          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>
                suki<Text style={{ color: GREEN }}>.</Text>
              </Text>

              <Pressable
                onPress={() => setMenuVisible(false)}
              >
                <X color="#FFFFFF" size={23} />
              </Pressable>
            </View>

            <Text style={styles.drawerLabel}>
              WORKSPACE
            </Text>

            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <Pressable
                  key={item.name}
                  style={styles.menuItem}
                  onPress={() => openMenuItem(item.name)}
                >
                  <Icon size={19} color={GREEN} />

                  <Text style={styles.menuText}>
                    {item.name}
                  </Text>

                  <ChevronRight size={17} color={MUTED} />
                </Pressable>
              );
            })}

            <View style={styles.drawerDivider} />

            <Pressable
              style={styles.menuItem}
              onPress={() => openMenuItem('Settings')}
            >
              <Settings size={19} color={GREEN} />

              <Text style={styles.menuText}>
                Settings
              </Text>

              <ChevronRight size={17} color={MUTED} />
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => openMenuItem('Exit')}
            >
              <LogOut size={19} color="#FF7777" />

              <Text style={styles.menuText}>
                Exit Suki
              </Text>

              <ChevronRight size={17} color={MUTED} />
            </Pressable>

            <View style={styles.drawerBottom}>
              <Text style={styles.version}>
                SUKI · VERSION 0.4.0
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* SETTINGS */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSettingsVisible(false)}
          />

          <View style={styles.settingsPanel}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>
                Settings
              </Text>

              <Pressable
                onPress={() => setSettingsVisible(false)}
              >
                <X color="#FFFFFF" size={23} />
              </Pressable>
            </View>

            <Text style={styles.drawerLabel}>
              CONNECTIVITY
            </Text>

            <View style={styles.settingsRow}>
              <View>
                <Text style={styles.internetTitle}>
                  Internet Access
                </Text>

                <Text style={styles.internetSubtitle}>
                  Control online features
                </Text>
              </View>

              <Switch
                value={internet}
                onValueChange={toggleInternet}
                trackColor={{
                  false: '#383838',
                  true: '#456E24',
                }}
                thumbColor={internet ? GREEN : '#BBBBBB'}
              />
            </View>

            <Text style={styles.settingsNote}>
              Privacy, voice, personality and memory
              controls will be added as their features
              are implemented.
            </Text>
          </View>
        </View>
      </Modal>

      {/* RECORD MANAGER: visible edit/delete controls, not hidden chat commands */}
      <Modal visible={recordsVisible} transparent animationType="slide" onRequestClose={() => setRecordsVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRecordsVisible(false)} />
          <View style={styles.settingsPanel}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Your records</Text>
              <Pressable onPress={() => setRecordsVisible(false)}><X color="#FFFFFF" size={23} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: '78%' }}>
              <Text style={styles.drawerLabel}>EXPENSES · {expenses.length}</Text>
              {expenses.length === 0 ? <Text style={styles.settingsNote}>No expenses saved yet.</Text> : expenses.map((item) => (
                <View key={item.id} style={styles.recordRow}>
                  <View style={{flex:1}}><Text style={styles.recordTitle}>₹{item.amount.toLocaleString('en-IN')} · {item.category}</Text><Text style={styles.internetSubtitle}>{item.date}</Text></View>
                  <Pressable style={styles.recordAction} onPress={() => { setRecordsVisible(false); setEditingRecord({kind:'expense',id:item.id}); appendLocalReply(`Editing ₹${item.amount} · ${item.category}. Type 'change amount to 1200' or 'change category to groceries', then type DONE.`); setMessage(''); }}><Text style={styles.recordActionText}>EDIT</Text></Pressable>
                  <Pressable style={styles.recordAction} onPress={() => Alert.alert('Delete expense?', `₹${item.amount} · ${item.category}`, [{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress: async () => { await persistExpenses(expenses.filter(x=>x.id!==item.id)); }}])}><Text style={[styles.recordActionText,{color:'#FF7777'}]}>DELETE</Text></Pressable>
                </View>
              ))}
              <Text style={[styles.drawerLabel,{marginTop:22}]}>NOTES · {notes.length}</Text>
              {notes.length === 0 ? <Text style={styles.settingsNote}>No notes saved yet.</Text> : notes.map((item) => (
                <View key={item.id} style={styles.recordRow}>
                  <View style={{flex:1}}><Text style={styles.recordTitle} numberOfLines={2}>{item.text}</Text><Text style={styles.internetSubtitle}>{item.date}</Text></View>
                  <Pressable style={styles.recordAction} onPress={() => { setRecordsVisible(false); setEditingRecord({kind:'note',id:item.id}); appendLocalReply('Editing your note. Type change note to followed by the replacement text, then type DONE.'); setMessage(''); }}><Text style={styles.recordActionText}>EDIT</Text></Pressable>
                  <Pressable style={styles.recordAction} onPress={() => Alert.alert('Delete note?', item.text, [{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress: async () => { await persistNotes(notes.filter(x=>x.id!==item.id)); }}])}><Text style={[styles.recordActionText,{color:'#FF7777'}]}>DELETE</Text></Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* VOICE PREVIEW */}
      <Modal
        visible={voiceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVoiceVisible(false)}
      >
        <View style={styles.voiceOverlay}>
          <Pressable
            style={styles.voiceClose}
            onPress={() => setVoiceVisible(false)}
          >
            <X size={25} color="#FFFFFF" />
          </Pressable>

          <SukiMascot size={220} />

          <Text style={styles.voiceTitle}>
            I'm listening...
          </Text>

          <Text style={styles.voiceDescription}>
            {speech.listening ? 'Listening. Speak naturally.' : speech.partial || 'Tap the microphone to start speaking.'}
          </Text>

          <Pressable
            style={styles.voiceButton}
            onPress={() => { if (speech.listening) speech.stop(); else void speech.start().catch((e) => Alert.alert('Microphone', e instanceof Error ? e.message : 'Speech recognition unavailable.')); }}
          >
            <Mic color="#111111" size={26} />
          </Pressable>

          <Text style={styles.voiceHint}>
            {speech.listening ? 'TAP TO STOP' : 'VOICE INPUT'}
          </Text>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  header: {
    height: 66,
    paddingHorizontal: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brand: {
    alignItems: 'center',
  },

  brandTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -1.5,
  },

  brandSubtitle: {
    color: MUTED,
    fontSize: 8,
    letterSpacing: 2,
    marginTop: -2,
  },

  iconButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
  },

  internetCard: {
    marginHorizontal: 17,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 17,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#20291D',
  },

  internetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  recordRow: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#20291D' },
  recordTitle: { color:'#F2F5EF', fontSize:13, flexShrink:1 },
  recordAction: { paddingHorizontal:8, paddingVertical:8, borderRadius:8, backgroundColor:'#1A2119' },
  recordActionText: { color:GREEN, fontSize:9, fontWeight:'800', letterSpacing:0.6 },

  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  internetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  internetSubtitle: {
    color: MUTED,
    fontSize: 10,
    marginTop: 3,
  },

  chatScroll: {
    flex: 1,
  },

  chatContent: {
    flexGrow: 1,
    paddingHorizontal: 19,
    paddingTop: 12,
    paddingBottom: 20,
    justifyContent: 'flex-start',
  },

  welcome: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 25,
  },

  mascotGlow: {
    backgroundColor: 'rgba(165,245,54,0.035)',
    borderRadius: 120,
    marginBottom: 12,
  },

  greeting: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },

  description: {
    color: '#929B8D',
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },

  suggestionContainer: {
    width: '100%',
    marginTop: 34,
    gap: 10,
  },

  suggestionHeading: {
    color: MUTED,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 3,
  },

  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderRadius: 15,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: '#242C20',
  },

  suggestionText: {
    flex: 1,
    color: '#E8EDE4',
    fontSize: 12,
    fontWeight: '500',
  },

  messages: {
    gap: 16,
    paddingVertical: 20,
  },

  messageBubble: {
    maxWidth: '88%',
    padding: 15,
    borderRadius: 17,
  },

  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#123447',
    borderBottomRightRadius: 4,
  },

  sukiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: SURFACE,
    borderBottomLeftRadius: 4,
  },

  messageSender: {
    color: GREEN,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 21,
  },

  composerArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },

  composer: {
    minHeight: 58,
    borderRadius: 19,
    backgroundColor: '#151B13',
    borderWidth: 1,
    borderColor: '#33412A',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  composerIcon: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    maxHeight: 115,
    paddingVertical: 12,
  },

  sendButton: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footerText: {
    color: '#596151',
    fontSize: 8,
    letterSpacing: 1.6,
    textAlign: 'center',
    marginTop: 11,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    flexDirection: 'row',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },

  drawer: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: '#0B100A',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 25,
    borderRightWidth: 1,
    borderColor: '#273421',
  },

  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 35,
  },

  drawerTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },

  drawerLabel: {
    color: MUTED,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 16,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minHeight: 53,
    borderBottomWidth: 1,
    borderBottomColor: '#1D251A',
  },

  menuText: {
    flex: 1,
    color: '#E8EDE4',
    fontSize: 13,
  },

  drawerDivider: {
    height: 1,
    backgroundColor: '#2A3525',
    marginVertical: 15,
  },

  drawerBottom: {
    marginTop: 'auto',
  },

  version: {
    color: '#64705D',
    fontSize: 9,
    letterSpacing: 1.5,
  },

  settingsPanel: {
    marginTop: 'auto',
    backgroundColor: '#0B100A',
    paddingHorizontal: 23,
    paddingTop: 30,
    paddingBottom: 45,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    width: '100%',
    borderTopWidth: 1,
    borderColor: '#273421',
  },

  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: '#273421',
  },

  settingsNote: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 20,
  },

  voiceOverlay: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  voiceClose: {
    position: 'absolute',
    top: 65,
    right: 25,
    padding: 10,
  },

  voiceTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 25,
  },

  voiceDescription: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },

  voiceButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 45,
  },

  voiceHint: {
    color: MUTED,
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 17,
  },
});
