import { account, accounts } from './accounts';
import { type Data, type Review, detailYen, socialKeys, mutualKeys, openAccounts, people, columns, schedules } from './model';
import { RULESET } from './tax';

export type Pair = readonly [ja: string, en: string];
export type Origin = { refs?: string[]; input?: string; rule?: string; fields?: string[] };
export type Field = { id: string; label: Pair; value: number | string; from: Origin };
export type Section = { title: Pair; fields: Field[] };
export const FORM_MAPPING = 'nta-r08.1: NTA0KOA2100 / NTA1KOA02001・NTA0KOA02002';
export const NTA_CORNER = 'https://www.keisan.nta.go.jp/kyoutu/ky/sm/top';
export const NTA_BLUE_PDF = 'https://www.nta.go.jp/taxes/shiraberu/shinkoku/yoshiki/01/shinkokusho/pdf/r05/10.pdf';
export const NTA_RETURN_PDF = 'https://www.nta.go.jp/taxes/shiraberu/shinkoku/yoshiki/01/shinkokusho/pdf/r07/01.pdf';
export const NTA_FORMS ='https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/1557_2.htm';
export const MISSING_2026: Pair = [
  '令和8年分の作成コーナー入力画面と年分別の記載要領は未照合です。転記用・提出不可。',
  'The final 2026 Preparation Corner screens and year-specific filing instructions have not been checked. Review copies only.',
];
export const moneyNames: Record<string,Pair> = {
  health:['国民健康保険料','National health insurance premiums'], pension:['国民年金保険料','National pension premiums'],
  pensionFund:['国民年金基金掛金','National pension fund contributions'], otherSocial:['その他の対象社会保険料','Other eligible social insurance premiums'],
  kyosai:['小規模企業共済掛金','Small business mutual aid premiums'], ideco:['個人型確定拠出年金（iDeCo）','iDeCo contributions'],
  advance:['予定納税額（第1期・第2期の合計）','Advance tax from both installments (NTA notice)'],
};
export const profileNames: Record<string,Pair> = {
  office:['提出先税務署','Tax office name (omit 税務署)'],name:['氏名','Legal name'],kana:['フリガナ','Name in katakana'],
  address:['納税地','Tax address'],zip:['郵便番号','Postal code'],birth:['生年月日','Date of birth (Western calendar)'],
  profession:['職業','Occupation'],trade:['屋号','Trade name (optional)'],businessAddress:['事業所所在地','Business address (optional)'],
  phone:['電話番号','Telephone'],bookCode:['記帳・帳簿の保存の区分','Bookkeeping classification'],
};
export const scheduleNames: Record<string,Pair> = {
  sales:['売上（収入）金額の明細','Sales counterparties'],purchase:['仕入金額の明細','Purchase counterparties'],
  withholding:['所得の内訳・源泉徴収税額','Business payouts with withholding'],rent:['地代家賃の内訳','Rent details'],
  interest:['利子割引料の内訳（金融機関を除く）','Interest details (excluding financial institutions)'],
  depr:['減価償却費の計算','Depreciation details'],
};
export const columnNames: Record<string,Pair> = {
  name:['氏名・名称','Name'],address:['所在地','Address'],number:['登録番号・法人番号','Registration / corporate number'],
  amount:['金額','Amount / deductible amount'],tax:['源泉徴収税額','Tax withheld'],property:['賃借物件','Rented property'],
  keyMoney:['権利金','Key money'],renewal:['更新料','Renewal fee'],paid:['本年中の支払額','Paid this year'],
  yearEnd:['年末借入残高','Year-end loan balance'],account:['科目','Asset account'],quantity:['数量','Quantity'],
  acquired:['取得年月','Acquired (YYYY-MM)'],cost:['取得価額','Acquisition cost'],basis:['償却の基礎金額','Depreciable basis'],
  method:['償却方法','Method'],life:['耐用年数','Useful life'],rate:['償却率（小数）','Rate (decimal)'],
  months:['本年償却月数','Months depreciated'],ordinary:['普通償却費','Ordinary depreciation'],special:['特別償却費','Special depreciation'],
  percent:['事業専用割合（%）','Business use (%)'],closing:['未償却残高','Closing book value'],memo:['摘要','Memo'],
};
export const get = (fields: Field[], id: string) => fields.find(f => f.id === id)?.value ?? '';
const field = (id: string, ja: string, en: string, value: Field['value'], from: Origin): Field => ({id,label:[ja,en],value,from});
export function report(d: Data, r: Review): Section[] {
  const {b,t} = r;
  const from = (...ids: string[]): Origin => ({ refs: [...new Set(ids.flatMap(id => b.ledgers[id].map(x=>x.id)))].sort() });
  const calc = (...fields: string[]): Origin => ({fields});
  const L = (n: number, ja: string, en:string, v: number, o: Origin) => field('B1.'+n,ja,en,v,o);
  const R = (n: string|number, ja: string, en:string, v: number, o: Origin) => field('R1.'+n,ja,en,v,o);
  const expenses = accounts.filter(a=>a.kind==='expense');
  const p1 = [
    L(1,'売上（収入）金額','Gross business receipts',b.revenue,from('sales','use','misc')),
    L(2,'期首商品（製品）棚卸高','Opening inventory',b.costOpen,from('stockStart')),
    L(3,'仕入金額','Purchases',b.purchases,from('purchase')),
    L(4,'小計','Inventory and purchases',b.costOpen+b.purchases,calc('B1.2','B1.3')),
    L(5,'期末商品（製品）棚卸高','Closing inventory',b.costClose,from('stockEnd')),
    L(6,'差引原価','Cost of goods sold',b.cost,calc('B1.4','B1.5')),
    L(7,'差引金額','Gross profit',b.gross,calc('B1.1','B1.6')),
    ...expenses.map(a => L(a.line!,a.ja,a.en,b.closing[a.id],from(a.id))),
    L(32,'経費計','Total operating expenses',b.expense,calc(...expenses.map(e=>'B1.'+e.line))),
    L(33,'差引金額','Operating profit',b.profit,calc('B1.7','B1.32')),
    L(43,'青色申告特別控除前の所得金額','Profit before blue-return deduction',b.profit,calc('B1.33')),
    L(44,'青色申告特別控除額','Blue-return deduction',t.blue,{fields:['B1.43'],input:'approval, books, deadline, etax, qualified, notified',rule:'BLUE'}),
    L(45,'所得金額','Business income after blue-return deduction',t.income,calc('B1.43','B1.44')),
  ];
  const m = b.monthly.flatMap(({sales,purchase,salesRefs,purchaseRefs},i) => [
    field('B2.S'+(i+1),(i+1)+'月 売上','Month '+(i+1)+' sales',sales,{refs:salesRefs}),
    field('B2.P'+(i+1),(i+1)+'月 仕入','Month '+(i+1)+' purchases',purchase,{refs:purchaseRefs}),
  ]);
  m.push(field('B2.use','家事消費等','Private use of stock',b.closing.use,from('use')),
    field('B2.misc','雑収入','Other business receipts',b.closing.misc,from('misc')),
    field('B2.cap','控除上限','Eligible deduction limit',r.cap,{rule:'BLUE',input:'approval, books, deadline, etax, qualified, notified'}));
  const dFields = schedules.flatMap(s => {
    const part = s === 'withholding' ? 'R2' : s === 'rent' ? 'B2' : 'B3';
    return d.details[s].flatMap((x,i)=>columns[s].filter(c=>x[c]).map(c => field(
      part+'.'+s+'.'+(i+1)+'.'+c,scheduleNames[s][0]+' '+(i+1)+' '+columnNames[c][0],
      scheduleNames[s][1]+' '+(i+1)+' '+columnNames[c][1],c==='account'?(account[x[c]]?.ja ?? x[c]):x[c],{input:s+' #'+(i+1)})));
  });
  for(const s of ['sales','purchase'] as const) {
    const id = s === 'sales' ? 'B1.1' : 'B1.3';
    const total = s === 'sales' ? b.revenue : b.purchases;
    m.push(field('B3.'+s+'.rest','上記以外の計・'+scheduleNames[s][0],'Residual (including unlisted counterparties) · '+scheduleNames[s][1],
      total-d.details[s].reduce((a,x)=>a+detailYen(x),0),{fields:[id],input:s}));
  }
  const bs = openAccounts.flatMap(a => [
    field('B4.O.'+a.id,a.ja+'（期首）',a.en+' (opening)',b.opening[a.id],{input:'opening · '+a.ja}),
    field('B4.C.'+a.id,a.ja+'（期末）',a.en+' (closing)',b.closing[a.id],{...from(a.id),fields:['B4.O.'+a.id]}),
  ]);
  bs.push(field('B4.C.draw','事業主貸','Owner drawings', b.closing.draw,from('draw')),
    field('B4.C.contribution','事業主借','Owner contributions',b.closing.contribution,from('contribution')),
    field('B4.C.profit','青色申告特別控除前の所得金額','Current-year profit before deduction',b.profit,calc('B1.43')),
    field('B4.O.assets','期首 資産の部 合計','Opening assets',b.assetsOpen,calc(...openAccounts.filter(a=>a.kind==='asset').map(a=>'B4.O.'+a.id))),
    field('B4.O.equity','期首 負債・資本の部 合計','Opening liabilities and capital',b.equityOpen,calc(...openAccounts.filter(a=>a.kind!=='asset').map(a=>'B4.O.'+a.id))),
    field('B4.C.assets','期末 資産の部 合計','Closing assets including drawings',b.assets,calc(...openAccounts.filter(a=>a.kind==='asset').map(a=>'B4.C.'+a.id),'B4.C.draw')),
    field('B4.C.equity','期末 負債・資本の部 合計','Closing liabilities and capital',b.equity,calc(...openAccounts.filter(a=>a.kind!=='asset').map(a=>'B4.C.'+a.id),'B4.C.contribution','B4.C.profit')));
  const r1 = [
    ...people.filter(k=>k!=='bookCode'&&d.profile[k]).map(k=>field('P.'+k,...profileNames[k],d.profile[k],{input:k})),
    field('R1.bookCode',...profileNames.bookCode,d.profile.bookCode,{input:'bookCode',rule:'FORMS'}),
    R('ア','収入金額等：事業・営業等','Business gross receipts',b.revenue,calc('B1.1')),
    R(1,'所得金額等：事業・営業等','Business income',t.income,calc('B1.45')),
    R(12,'所得金額等 合計','Total income',t.income,calc('R1.1')),
    R(13,'社会保険料控除','Social insurance deduction',r.social,{input:socialKeys.join(', '),rule:'SOCIAL'}),
    R(14,'小規模企業共済等掛金控除','Mutual aid and iDeCo deduction',r.mutual,{input:mutualKeys.join(', '),rule:'MUTUAL'}),
    R(25,'基礎控除','Basic deduction',t.basic,{fields:['R1.12'],rule:'BASIC'}),
    R(26,'13から25までの計','Subtotal of income deductions',t.deductions,calc('R1.13','R1.14','R1.25')),
    R(30,'所得から差し引かれる金額 合計','Total deductions',t.deductions,calc('R1.26')),
    R(31,'課税される所得金額','Taxable income, rounded down to ¥1,000',t.taxable,{fields:['R1.12','R1.30'],rule:'ROUND'}),
    R(32,'上の31に対する税額','Progressive income tax',t.normal,{fields:['R1.31'],rule:'RATE'}),
    R(42,'差引所得税額','Net income tax',t.normal,calc('R1.32')),
    R(44,'再差引所得税額（基準所得税額）','Base income tax for reconstruction surtax',t.normal,calc('R1.42')),
    R(45,'復興特別所得税額','Reconstruction surtax, rounded down to ¥1',t.surtax,{fields:['R1.44'],rule:'SURTAX'}),
    R(46,'所得税及び復興特別所得税の額','Combined national tax',t.combined,calc('R1.44','R1.45')),
    R(49,'源泉徴収税額','Tax withheld',r.withheld,{input:'withholding',fields:['R2.49']}),
    R(50,'申告納税額','Self-assessed tax after withholding',t.selfAssessed,{fields:['R1.46','R1.49'],rule:'ROUND'}),
    R(51,'予定納税額','Advance installments',r.advance,{input:'advance'}),
    R(52,'第3期分の税額・納める税金','Balance payable',Math.max(0,t.final),calc('R1.50','R1.51')),
    R(53,'第3期分の税額・還付される税金','Refund',Math.max(0,-t.final),calc('R1.50','R1.51')),
    R(59,'青色申告特別控除額','Blue-return deduction (informational)',t.blue,calc('B1.44')),
  ];
  const r2 = [
    ...[...socialKeys,...mutualKeys].map(k=>field('R2.'+k,...moneyNames[k],Number(d.money[k].replaceAll(',',''))||0,{input:k})),
    ...dFields.filter(f=>f.id.startsWith('R2.')),
    field('R2.49','源泉徴収税額の合計額','Total tax withheld',r.withheld,{fields:dFields.filter(f=>f.id.endsWith('.tax')).map(f=>f.id)}),
  ];
  return [
    {title:['青色申告決算書 1：損益計算書','Blue-return statement 1: Profit and loss'],fields:p1},
    {title:['青色申告決算書 2：月別・地代家賃・控除','Blue-return statement 2: Monthly totals, rent and deduction'],fields:[...m.filter(x=>x.id.startsWith('B2.')),...dFields.filter(x=>x.id.startsWith('B2.'))]},
    {title:['青色申告決算書 3：売上・仕入・償却・利子','Blue-return statement 3: Counterparties, depreciation and interest'],fields:[...dFields.filter(x=>x.id.startsWith('B3.')),...m.filter(x=>x.id.startsWith('B3.'))]},
    {title:['青色申告決算書 4：貸借対照表','Blue-return statement 4: Balance sheet'],fields:bs},
    {title:['確定申告書 第一表','Income tax return, Part 1'],fields:r1},
    {title:['確定申告書 第二表','Income tax return, Part 2'],fields:r2},
  ];
}
export const versionLine = RULESET + ' / ' + FORM_MAPPING;

export const officialSources: Record<string,string> = {
  BLUE:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm',
  BASIC:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm',
  RATE:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',
  SURTAX:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1000.htm',
  ROUND:'https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/pdf/060.pdf',
  SOCIAL:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1130.htm',
  MUTUAL:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1135.htm',
  FORMS:NTA_FORMS,
};
