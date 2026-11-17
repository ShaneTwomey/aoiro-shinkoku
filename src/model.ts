import { account, accounts, balanceKinds, debitKind, depreciable } from './accounts';
import { dateKey, MAX_ROWS, ordered, validEntry, yen, type Entry, type Import } from './journal';
import { blueLimit, tax2026 } from './tax';

export const people = ['office','name','kana','address','zip','birth','profession','trade','businessAddress','phone','bookCode'] as const;
export const decisions = ['scope','approval','books','deadline','etax','qualified','notified','opening','adjustments','deductions','withholding','residence'] as const;
export const amounts = ['health','pension','pensionFund','otherSocial','kyosai','ideco','advance'] as const;
export const statuses = ['', 'yes', 'no'] as const;
export type Decision = typeof statuses[number];
export const schedules = ['sales','purchase','withholding','rent','interest','depr'] as const;
export type Schedule = typeof schedules[number];
export const columns: Record<Schedule, readonly string[]> = {
  sales: ['name','address','number','amount'],
  purchase: ['name','address','number','amount'],
  withholding: ['name','address','amount','tax'],
  rent: ['name','address','property','keyMoney','renewal','paid','amount'],
  interest: ['name','address','yearEnd','paid','amount'],
  depr: ['name','account','quantity','acquired','cost','basis','method','life','rate','months','ordinary','special','percent','amount','closing','memo'],
};
export const limitRows: Record<Schedule, number> = {sales:4,purchase:4,withholding:4,rent:2,interest:2,depr:7};
export type Detail = Record<string,string>;
export type Data = {
  version: 1; entries: Entry[]; imports: Import[]; opening: Record<string,string>;
  profile: Record<typeof people[number],string>;
  facts: Record<typeof decisions[number],Decision>;
  money: Record<typeof amounts[number],string>;
  details: Record<Schedule,Detail[]>;
};
const empty = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map(k => [k,''])) as Record<K,''>;
export const blankDetail = (key: Schedule): Detail => empty(columns[key]);
export const initial = (): Data => ({
  version:1, entries:[], imports:[], opening:{}, profile:empty(people), facts:empty(decisions), money:empty(amounts),
  details:{sales:[],purchase:[],withholding:[],rent:[],interest:[],depr:[]},
});
export const openAccounts = accounts.filter(a => balanceKinds.includes(a.kind));
export const socialKeys = ['health','pension','pensionFund','otherSocial'] as const;
export const mutualKeys = ['kyosai','ideco'] as const;
const sum = (v: number[]) => v.reduce((a,b) => a+b,0);
const value = (v: string | undefined) => yen(v ?? '') ?? 0;
const unsigned = (v: string) => /^\d+(?:\.\d+)?$/.test(v) ? Number(v) : NaN;
export const detailYen = (r: Detail, key = 'amount') => value(r[key]);
type Obj = Record<string,unknown>;
const obj = (v: unknown): v is Obj => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const isText = (v: unknown, max = 250): v is string => typeof v === 'string' && v.length <= max;
const allFields = (o: unknown, keys: readonly string[], check: (v: unknown) => boolean) =>
  obj(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o,k) && check(o[k]));

export function restore(value: unknown): Data {
  if (!obj(value) || value.version !== 1 || !Array.isArray(value.entries) || !Array.isArray(value.imports) ||
      value.entries.length > MAX_ROWS || value.imports.length > MAX_ROWS ||
      !allFields(value.profile, people, isText) || !allFields(value.money, amounts, isText) ||
      !allFields(value.facts, decisions, v => statuses.includes(v as Decision)) ||
      !obj(value.opening) || !Object.entries(value.opening).every(([k,v]) => openAccounts.some(a => a.id === k) && isText(v)) ||
      !obj(value.details)) throw new Error('backup');
  const entries = value.entries as Entry[], imports = value.imports as Import[], details = value.details;
  if (!imports.every(f => obj(f) && isText(f.name,500) && isText(f.hash) && /^[a-f0-9]{64}$/.test(f.hash)) ||
      new Set(imports.map(f => f.hash)).size !== imports.length) throw new Error('backup');
  const hashes = new Set(imports.map(f => f.hash));
  if (!entries.every(e => obj(e) && validEntry(e) && (e.source === 'manual' || hashes.has(e.source))) ||
      new Set(entries.map(e => e.id)).size !== entries.length ||
      !schedules.every(s => Array.isArray(details[s]) && details[s].length <= limitRows[s] &&
        details[s].every((d: unknown) => allFields(d,columns[s],isText)))) throw new Error('backup');
  return value as unknown as Data;
}

export type Posting = { id: string; date: string; memo: string; counterpart: string; debit: number; credit: number; balance: number };
export function books(d: Data) {
  const opening: Record<string,number> = {}, closing: Record<string,number> = {};
  const ledgers: Record<string,Posting[]> = {};
  for (const a of accounts) {
    const n = value(d.opening[a.id]);
    opening[a.id] = n;
    closing[a.id] = debitKind(a.kind) ? n : -n;
    ledgers[a.id] = [];
  }
  let debits = 0, credits = 0;
  const entries = ordered(d.entries);
  const refs = new Map<string,string>();
  for (const [i,e] of entries.entries()) {
    const ref = (e.source === 'manual' ? 'A' : 'J') + (i+1).toString().padStart(4,'0');
    refs.set(e.id,ref);
    const record = (id: string, dc: number, cr: number, counterpart: string) => {
      const normal = debitKind(account[id].kind) ? 1 : -1;
      closing[id] += dc - cr;
      ledgers[id].push({id:ref,date:e.date,memo:e.memo,counterpart,debit:dc,credit:cr,balance:normal*closing[id]});
    };
    record(e.debit,e.amount,0,e.credit);
    record(e.credit,0,e.amount,e.debit);
    debits += e.amount; credits += e.amount;
  }
  for (const a of accounts) if (!debitKind(a.kind)) closing[a.id] = -closing[a.id];
  const total = (k: string, b = closing) => sum(accounts.filter(a => a.kind === k).map(a => b[a.id]));
  const revenue = total('revenue'), costOpen = closing.stockStart, purchases = closing.purchase, costClose = closing.stockEnd;
  const cost = costOpen + purchases - costClose;
  const gross = revenue - cost, expense = total('expense'), profit = gross - expense;
  const assetsOpen = total('asset',opening), equityOpen = total('liability',opening) + opening.capital;
  const assets = total('asset') + closing.draw;
  const equity = total('liability') + closing.capital + closing.contribution + profit;
  const monthly = Array.from({length:12},() => ({sales:0,purchase:0,salesRefs:[] as string[],purchaseRefs:[] as string[]}));
  for (const e of entries) {
    const m = monthly[Number(e.date.slice(5,7))-1];
    const sales = (e.credit === 'sales' ? e.amount : 0) - (e.debit === 'sales' ? e.amount : 0);
    const purchase = (e.debit === 'purchase' ? e.amount : 0) - (e.credit === 'purchase' ? e.amount : 0);
    m.sales += sales; m.purchase += purchase;
    if (sales) m.salesRefs.push(refs.get(e.id)!);
    if (purchase) m.purchaseRefs.push(refs.get(e.id)!);
  }
  return {opening,closing,ledgers,entries,refs,debits,credits,revenue,costOpen,purchases,costClose,cost,gross,expense,profit,assetsOpen,equityOpen,assets,equity,monthly};
}
export type Books = ReturnType<typeof books>;

export const issueKeys = ['noEntries','profile','scope','approval','facts','openingInvalid','openingUnbalanced','bookUnbalanced','review',
  'money','unsupportedAccounts','negative','inventory','net','schedule','advance','refund','needsOfficial'] as const;
export type IssueKey = typeof issueKeys[number];
export type Issue = {key: IssueKey; at?: string};
export function review(d: Data) {
  const b = books(d), issues: Issue[] = [];
  const add = (key: IssueKey, at?: string) => issues.push({key,at});
  const f = d.facts, yes = (k: keyof typeof f) => f[k] === 'yes';
  if (!b.entries.length) add('noEntries');
  for (const k of ['office','name','kana','address','zip','birth','profession','phone'] as const) {
    const v = d.profile[k].trim();
    if (!v || (k === 'zip' && !/^\d{3}-?\d{4}$/.test(v)) ||
      (k === 'birth' && (!/^(?:19|20)\d{2}-\d{2}-\d{2}$/.test(v) || !dateKey(v,Number(v.slice(0,4))) || v > '2026-12-31')) ||
      (k === 'phone' && !/^[0-9+ ()-]{8,24}$/.test(v))) add('profile',k);
  }
  if (!/^[1-5]$/.test(d.profile.bookCode) ||
    (d.profile.bookCode === '1' && (!yes('qualified') || !yes('notified'))) ||
    (d.profile.bookCode !== '1' && yes('qualified') && yes('notified')) ||
    (yes('books') && ['4','5'].includes(d.profile.bookCode))) add('profile','bookCode');
  if (!yes('scope')) add('scope');
  if (!yes('approval')) add('approval');
  for (const k of ['books','deadline','etax','qualified','notified'] as const) if (!f[k]) add('facts',k);
  if (yes('etax') && !yes('deadline')) add('facts','etax');
  for (const k of ['opening','adjustments','deductions','withholding','residence'] as const) if (!yes(k)) add('review',k);
  for (const [k,v] of Object.entries(d.opening)) if (v && yen(v) === undefined) add('openingInvalid',account[k].ja);
  if (b.assetsOpen !== b.equityOpen) add('openingUnbalanced');
  if (b.assets !== b.equity || b.debits !== b.credits) add('bookUnbalanced');
  for (const k of amounts) if (yen(d.money[k]) === undefined) add('money',k);
  const unsupported = ['wages','welfare','bad','securities','capital'];
  for (const id of unsupported) if (b.ledgers[id].length || (id === 'securities' && b.opening[id])) add('unsupportedAccounts',account[id].ja);
  for (const a of accounts) if (b.closing[a.id] < 0) add('negative',a.ja);
  if (b.monthly.some(x => x.sales < 0 || x.purchase < 0)) add('negative','月別売上・仕入');
  if (b.costOpen !== b.opening.stock || b.costClose !== b.closing.stock || b.cost < 0) add('inventory');
  if (b.profit < 0 || b.profit > 330_000_000 || Math.max(b.revenue,b.assets,b.assetsOpen,b.expense) > 999_999_999) add('net');
  const expected = {sales:b.closing.sales,purchase:b.purchases,rent:b.closing.rent,interest:b.closing.interest,depr:b.closing.depr};
  for (const s of schedules) {
    const rows = d.details[s];
    const amountsFor = (key: string) => sum(rows.map(r => detailYen(r,key)));
    const total = amountsFor('amount');
    if (s !== 'withholding') {
      const required = s === 'rent' || s === 'depr';
      if (required ? total !== expected[s] : total > expected[s]) add('schedule',s);
    }
    if (s === 'withholding' && total > b.revenue) add('schedule',s);
    for (const [i,r] of rows.entries()) {
      const valid = s === 'depr' ? Boolean(r.name.trim() && depreciable.includes(r.account) && r.method.trim() &&
        /^\d{4}-(?:0[1-9]|1[0-2])$/.test(r.acquired) && r.acquired <= '2026-12' &&
        yen(r.quantity,true) && yen(r.cost,true) && yen(r.basis,true) && yen(r.life,true) &&
        unsigned(r.rate) >= 0 && unsigned(r.rate) <= 1 && unsigned(r.percent) > 0 && unsigned(r.percent) <= 100 &&
        yen(r.months,true) && Number(r.months) <= 12 && ['ordinary','special','amount','closing'].every(k => yen(r[k]) !== undefined) &&
        detailYen(r) <= detailYen(r,'ordinary') + detailYen(r,'special')) :
      Boolean(r.name.trim() && (s === 'withholding' || r.address.trim()) && yen(r.amount,true) &&
        ((s !== 'sales' && s !== 'purchase') || !r.number || /^T?\d{13}$/.test(r.number)) &&
        (s !== 'withholding' || (yen(r.tax,true) && detailYen(r,'tax') <= detailYen(r))) &&
        (s !== 'rent' || (r.property.trim() && ['keyMoney','renewal','paid'].every(k => yen(r[k]) !== undefined) &&
          detailYen(r) <= detailYen(r,'keyMoney')+detailYen(r,'renewal')+detailYen(r,'paid'))) &&
        (s !== 'interest' || (yen(r.yearEnd) !== undefined && yen(r.paid,true) && detailYen(r) <= detailYen(r,'paid'))));
      if (!valid) add('schedule',s + ' #' + (i+1));
    }
  }
  for (const id of depreciable) {
    const rows = d.details.depr.filter(r => r.account === id);
    if (sum(rows.map(r => detailYen(r,'closing'))) !== b.closing[id] ||
      sum(rows.map(r => detailYen(r))) !== sum(b.entries.filter(e => e.debit === 'depr' && e.credit === id).map(e => e.amount)))
      add('schedule','depr · '+account[id].ja);
  }
  const cap = blueLimit(2026,{approved:yes('approval'),double:yes('books'),accrual:true,books:yes('books'),onTime:yes('deadline'),
    etax:yes('etax'),qualified:yes('qualified'),notified:yes('notified'),linked:false}) ?? 0;
  const social = sum(socialKeys.map(k=>value(d.money[k]))), mutual = sum(mutualKeys.map(k=>value(d.money[k])));
  const withheld = sum(d.details.withholding.map(r => detailYen(r,'tax'))), advance = value(d.money.advance);
  if (advance % 100 !== 0) add('advance','advance');
  const t = tax2026(b.profit,cap,social,mutual,withheld,advance);
  return {b,t,cap,social,mutual,withheld,advance,issues,ready:issues.length === 0};
}
export type Review = ReturnType<typeof review>;

export const fixtureInputs = (): Pick<Data,'profile'|'facts'|'money'> => ({
  profile:{office:'架空',name:'青葉 試験',kana:'アオバ シケン',address:'東京都架空区青葉一丁目1番',zip:'000-0000',birth:'1990-01-01',
    profession:'翻訳業',trade:'青葉翻訳室（架空）',businessAddress:'東京都架空区青葉一丁目1番',phone:'00-0000-0000',bookCode:'2'},
  facts:{scope:'yes',approval:'yes',books:'yes',deadline:'yes',etax:'yes',qualified:'no',notified:'no',
    opening:'yes',adjustments:'yes',deductions:'yes',withholding:'yes',residence:'yes'},
  money:{health:'0',pension:'0',pensionFund:'0',otherSocial:'0',kyosai:'0',ideco:'0',advance:'0'},
});
