import * as SQLite from 'expo-sqlite';

export type ExpenseRecord = { id: string; amount: number; category: string; date: string; note?: string };
export type NoteRecord = { id: string; text: string; date: string };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const db = () => (dbPromise ??= SQLite.openDatabaseAsync('suki-private.db'));

export async function initializeDatabase() {
  const sql = await db();
  await sql.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      text TEXT NOT NULL,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      sender TEXT NOT NULL CHECK(sender IN ('user','suki')),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return sql;
}

export async function getExpenses(): Promise<ExpenseRecord[]> {
  const sql = await db();
  return sql.getAllAsync<ExpenseRecord>('SELECT * FROM expenses ORDER BY date DESC, rowid DESC');
}
export async function getNotes(): Promise<NoteRecord[]> {
  const sql = await db();
  return sql.getAllAsync<NoteRecord>('SELECT * FROM notes ORDER BY date DESC, rowid DESC');
}
export async function saveExpense(item: ExpenseRecord) {
  const sql = await db();
  await sql.runAsync('INSERT INTO expenses(id,amount,category,date,note) VALUES(?,?,?,?,?)', item.id, item.amount, item.category, item.date, item.note ?? null);
}
export async function updateExpense(item: ExpenseRecord) {
  const sql = await db();
  await sql.runAsync('UPDATE expenses SET amount=?, category=?, date=?, note=? WHERE id=?', item.amount, item.category, item.date, item.note ?? null, item.id);
}
export async function deleteExpense(id: string) {
  const sql = await db();
  await sql.runAsync('DELETE FROM expenses WHERE id=?', id);
}
export async function saveNote(item: NoteRecord) {
  const sql = await db();
  await sql.runAsync('INSERT INTO notes(id,text,date) VALUES(?,?,?)', item.id, item.text, item.date);
}
export async function updateNote(item: NoteRecord) {
  const sql = await db();
  await sql.runAsync('UPDATE notes SET text=?, date=? WHERE id=?', item.text, item.date, item.id);
}
export async function deleteNote(id: string) {
  const sql = await db();
  await sql.runAsync('DELETE FROM notes WHERE id=?', id);
}
export async function getSetting(key: string) {
  const sql = await db();
  const row = await sql.getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?', key);
  return row?.value ?? null;
}
export async function setSetting(key: string, value: string) {
  const sql = await db();
  await sql.runAsync('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
}

/** One-time, idempotent migration from the previous AsyncStorage release. */
export async function migrateLegacyRecords(legacy: { expenses?: ExpenseRecord[]; notes?: NoteRecord[] }) {
  const sql = await db();
  await sql.withTransactionAsync(async () => {
    for (const e of legacy.expenses ?? []) await sql.runAsync('INSERT OR IGNORE INTO expenses(id,amount,category,date,note) VALUES(?,?,?,?,?)', e.id, e.amount, e.category, e.date, e.note ?? null);
    for (const n of legacy.notes ?? []) await sql.runAsync('INSERT OR IGNORE INTO notes(id,text,date) VALUES(?,?,?)', n.id, n.text, n.date);
    await sql.runAsync("INSERT INTO settings(key,value) VALUES('migration.asyncstorage.v1','done') ON CONFLICT(key) DO NOTHING");
  });
}
export async function replaceExpenses(items: ExpenseRecord[]) {
  const sql = await db();
  await sql.withTransactionAsync(async () => {
    await sql.runAsync('DELETE FROM expenses');
    for (const e of items) await sql.runAsync('INSERT INTO expenses(id,amount,category,date,note) VALUES(?,?,?,?,?)', e.id, e.amount, e.category, e.date, e.note ?? null);
  });
}
export async function replaceNotes(items: NoteRecord[]) {
  const sql = await db();
  await sql.withTransactionAsync(async () => {
    await sql.runAsync('DELETE FROM notes');
    for (const n of items) await sql.runAsync('INSERT INTO notes(id,text,date) VALUES(?,?,?)', n.id, n.text, n.date);
  });
}
