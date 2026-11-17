import { account, findAccount } from './accounts';
export const YEAR = 2026;
export const HEADERS = ['日付','借方科目','借方金額','貸方科目','貸方金額','摘要','エラーメッセージ'];
export const MAX_YEN = 999_999_999;
export const MAX_ROWS = 20_000;
export const MAX_FILE = 12_000_000;
export type Entry = { id: string; date: string; debit: string; credit: string; amount: number; memo: string; source: string; row: number };
export type Import = { hash: string; name: string };
export type CsvIssue = 'encoding' | 'size' | 'syntax' | 'header' | 'empty' | 'duplicate';
export type RowIssue = 'columns' | 'date' | 'amount' | 'unbalanced' | 'debit' | 'credit' | 'same' | 'sheet' | 'memo';
export type PreviewRow = { row: number; cells: string[]; issues: RowIssue[]; entry?: Omit<Entry,'id'|'source'> };
export type Preview = { hash: string; name: string; rows: PreviewRow[] };
export class CsvError extends Error { constructor(public code: CsvIssue, public row?: number) { super(code); } }

export function yen(s: string, positive = false): number | undefined {
  const t = s.trim();
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(t)) return;
  const n = Number(t.replaceAll(',',''));
  if (n > MAX_YEN || (positive && n === 0)) return;
  return n;
}
export function dateKey(s: string, year = YEAR): string | undefined {
  const m = /^(\d{4})([/-])(\d{1,2})\2(\d{1,2})$/.exec(s.trim());
  if (!m || Number(m[1]) !== year) return;
  const month = Number(m[3]), day = Number(m[4]);
  const date = new Date(Date.UTC(year, month-1, day));
  if (date.getUTCMonth()+1 !== month || date.getUTCDate() !== day || date.getUTCFullYear() !== year) return;
  return date.toISOString().slice(0,10);
}

export function parseCsv(text: string) {
  const result: {line: number; cells: string[]}[] = [];
  let line = 1, start = 1, cell = '', cells: string[] = [];
  let mode: 'start'|'bare'|'quoted'|'end' = 'start';
  const field = () => { cells.push(cell); cell = ''; mode = 'start'; };
  const row = () => {
    field();
    if (cells.some(x => x.trim() !== '')) result.push({line:start, cells});
    if (result.length > MAX_ROWS + 2) throw new CsvError('size');
    start = ++line; cells = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (mode === 'quoted') {
      if (ch === '"') {
        if (text[i+1] === '"') { cell += '"'; i++; }
        else mode = 'end';
      } else {
        cell += ch;
        if (ch === '\n') line++;
      }
    } else if (ch === ',') field();
    else if (ch === '\n') row();
    else if (ch === '"') {
      if (mode !== 'start') throw new CsvError('syntax',line);
      mode = 'quoted';
    } else {
      if (mode === 'end') throw new CsvError('syntax',line);
      cell += ch;
      mode = 'bare';
    }
  }
  if (mode === 'quoted') throw new CsvError('syntax',line);
  row();
  return result;
}

export async function inspectCsv(name: string, bytes: ArrayBuffer, history: Import[]): Promise<Preview> {
  if (bytes.byteLength > MAX_FILE) throw new CsvError('size');
  let data: string;
  try { data = new TextDecoder('utf-8', {fatal: true}).decode(bytes).replace(/\r\n?/g,'\n'); }
  catch { throw new CsvError('encoding'); }
  const parsed = parseCsv(data);
  if (parsed[0]?.cells[0].trim() === '仕訳帳' && parsed[0].cells.slice(1).every(v => !v.trim())) parsed.shift();
  const header = parsed.shift()?.cells;
  if (header?.length !== HEADERS.length || HEADERS.some((h,i) => h !== header[i].trim())) throw new CsvError('header');
  if (!parsed.length) throw new CsvError('empty');
  const canonical = JSON.stringify(parsed.map(r => {
    const cells = r.cells.map(x => x.trim());
    while (cells.length > 5 && cells.at(-1) === '') cells.pop();
    return cells;
  }));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
  if (history.some(f => f.hash === hash)) throw new CsvError('duplicate');
  const rows = parsed.map(({line,cells: raw}): PreviewRow => {
    const issues: RowIssue[] = [];
    const cells = [...raw];
    while (cells.length < 7) cells.push('');
    if (raw.length < 5 || raw.length > 7) issues.push('columns');
    const [d,dr,da,cr,ca,memo,sheet] = cells.map(v => v.trim());
    const date = dateKey(d), debit = findAccount(dr), credit = findAccount(cr), amount = yen(da,true), caYen = yen(ca,true);
    if (!date) issues.push('date');
    if (amount === undefined || caYen === undefined) issues.push('amount');
    else if (amount !== caYen) issues.push('unbalanced');
    if (!debit) issues.push('debit');
    if (!credit) issues.push('credit');
    if (debit && debit === credit) issues.push('same');
    if (sheet) issues.push('sheet');
    if (memo.length > 500) issues.push('memo');
    return {row:line,cells,issues,entry: !issues.length && date && debit && credit && amount
      ? { row:line,date,debit,credit,amount,memo } : undefined};
  });
  return {name,hash,rows};
}

export function post(preview: Preview, history: Import[]): Entry[] {
  if (history.some(h => h.hash === preview.hash)) throw new CsvError('duplicate');
  if (!preview.rows.length || preview.rows.some(r => r.issues.length || !r.entry)) throw new Error('invalid preview');
  return preview.rows.map(r => ({...r.entry!,id:preview.hash + ':' + r.row,source:preview.hash}));
}
export const ordered = (entries: Entry[]) => entries.toSorted((a,b) => a.date.localeCompare(b.date));
export const validEntry = (e: Entry) => Boolean(e && typeof e.id === 'string' && typeof e.date === 'string' &&
    dateKey(e.date) === e.date && Object.hasOwn(account,e.debit) && Object.hasOwn(account,e.credit) &&
    e.debit !== e.credit && Number.isInteger(e.amount) && e.amount > 0 && e.amount <= MAX_YEN &&
    typeof e.memo === 'string' && e.memo.length <= 500 && typeof e.source === 'string' && Number.isInteger(e.row));
