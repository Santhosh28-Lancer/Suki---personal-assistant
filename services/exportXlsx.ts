import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { ExpenseRecord, NoteRecord } from './database';

export type ExportRange = { startDate?: string; endDate?: string; label: string };

function inRange(date: string, range: ExportRange) {
  return (!range.startDate || date >= range.startDate) &&
    (!range.endDate || date <= range.endDate);
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
}

async function shareFile(base64: string, filename: string, mimeType: string) {
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Android sharing is unavailable on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: `Share ${filename}` });
}

async function exportRows(rows: Record<string, string | number>[], filename: string, format: 'xlsx' | 'csv', sheetName: string) {
  if (format === 'csv') {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName.slice(0, 31));
    const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'csv' });
    await shareFile(base64, filename.replace(/\.xlsx$/i, '.csv'), 'text/csv');
    return;
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName.slice(0, 31));
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  await shareFile(base64, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function exportExpenses(
  records: ExpenseRecord[], range: ExportRange, format: 'xlsx' | 'csv' = 'xlsx',
) {
  const selected = records.filter(record => inRange(record.date, range));
  const rows: Record<string, string | number>[] = selected.map(record => ({
    Date: record.date, Amount_INR: record.amount, Category: record.category, Note: record.note ?? '',
  }));
  rows.push({ Date: '', Amount_INR: selected.reduce((sum, item) => sum + item.amount, 0), Category: 'TOTAL', Note: `${selected.length} records` });
  const stamp = `${range.startDate ?? 'beginning'}-to-${range.endDate ?? 'latest'}`;
  await exportRows(rows, `Suki-Expenses-${safeFilename(stamp)}.xlsx`, format, 'Expenses');
}

export async function exportNotes(
  records: NoteRecord[], range: ExportRange, format: 'xlsx' | 'csv' = 'xlsx',
) {
  const selected = records.filter(record => inRange(record.date, range));
  const rows: Record<string, string | number>[] = selected.map(record => ({
    Date: record.date, Note: record.text,
  }));
  const stamp = `${range.startDate ?? 'beginning'}-to-${range.endDate ?? 'latest'}`;
  await exportRows(rows, `Suki-Notes-${safeFilename(stamp)}.xlsx`, format, 'Notes');
}

// Backwards-compatible annual helpers.
export async function exportExpensesXlsx(records: ExpenseRecord[], year: number) {
  return exportExpenses(records, { startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: String(year) }, 'xlsx');
}
export async function exportNotesXlsx(records: NoteRecord[], year: number) {
  return exportNotes(records, { startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: String(year) }, 'xlsx');
}
