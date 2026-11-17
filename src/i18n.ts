import type { Pair } from './report';
import type { CsvIssue, RowIssue } from './journal';
import type { IssueKey } from './model';
export type Lang = 'ja'|'en';
export const pick = (lang:Lang,p:Pair) => p[lang==='ja'?0:1];
export const tabs = [
  ['CSV取込','Import CSV'],['仕訳確認','Review journal'],['決算整理','Year-end adjustments'],
  ['申告者情報','Taxpayer inputs'],['申告プレビュー','Review & export'],
] as const;
export const csvIssues: Record<CsvIssue,Pair> = {
  encoding:['UTF-8のCSVを選んでください。','Choose a UTF-8 CSV.'],
  size:['ファイルまたは行数が上限を超えています。','The file or number of rows exceeds the limit.'],
  syntax:['CSVの引用符が正しくありません。','The CSV contains an invalid quoted field.'],
  header:['指定の7列を元の順番で出力してください。','Export the seven required columns in their original order.'],
  empty:['取り込めるデータ行がありません。','There are no data rows to import.'],
  duplicate:['同じCSVはすでに取り込まれています。','This CSV has already been imported.'],
};
export const rowIssues: Record<RowIssue,Pair> = {
  columns:['列数が不正','Unexpected column count'],date:['令和8年の実在する日付が必要','Enter a valid date in 2026'],
  amount:['正の整数（円）が必要','Amounts must be positive whole yen'],unbalanced:['借方・貸方の金額が不一致','Debit and credit do not balance'],
  debit:['借方科目が未登録','Unknown debit account'],credit:['貸方科目が未登録','Unknown credit account'],
  same:['借方と貸方が同じ科目','Debit and credit must use different accounts'],sheet:['シートにエラーあり','The source sheet reports an error'],
  memo:['摘要は500文字以内','Memo is longer than 500 characters'],
};
export const issues: Record<IssueKey,Pair> = {
  noEntries:['仕訳を取り込むか入力してください。','Import or enter journal entries.'],
  profile:['入力が不足しているか、形式が正しくありません。','Enter a valid taxpayer field.'],
  scope:['対応範囲を確認してください。範囲外の場合は作成コーナーで処理してください。','Confirm the supported scope. Handle other situations in the official Preparation Corner.'],
  approval:['青色申告の承認が確認できていません。','Confirm that you are approved to file a blue return.'],
  facts:['青色申告特別控除の判定項目を選択してください。','Answer this blue-return eligibility question.'],
  openingInvalid:['期首残高は整数（円）で入力してください。','Enter the opening balance in whole yen.'],
  openingUnbalanced:['期首資産と期首負債・資本が一致しません。','Opening assets do not equal opening liabilities and capital.'],
  bookUnbalanced:['帳簿が一致しません。','The books do not balance.'],
  review:['証憑や状況を確認してから「はい」を選択してください。','Review the facts or supporting records before choosing Yes.'],
  money:['整数（円）を入力してください。該当なしは0。','Enter a whole yen amount. Enter 0 if none.'],
  unsupportedAccounts:['この科目には対応外の入力・判断が必要です。','This account requires details or decisions outside the supported scope.'],
  negative:['通常残高がマイナスです。決算時に科目の分類・振替を確認してください。','A normal balance is negative. Review the account classification and any year-end reclassification.'],
  inventory:['期首・期末の棚卸資産と棚卸高が一致する必要があります。売上原価もご確認ください。','Reconcile opening and closing inventory entries to the balance sheet and check cost of sales.'],
  net:['赤字、特定の高所得、または様式の桁数を超えるため、このアプリの対象外です。','Losses, high-income minimum tax cases, and amounts beyond the form limits are outside scope.'],
  schedule:['明細の必須項目、金額、帳簿との一致を確認してください。','Check required detail fields, amounts, and reconciliation to the books.'],
  advance:['予定納税額を確認してください。','Check the advance tax amount.'],
  refund:['還付先を公式手続で入力してください。','Enter the refund destination in the official process.'],
  needsOfficial:['公式手続で確認してください。','Confirm in the official filing process.'],
};
export const factsLabels: Record<string,Pair> = {
  scope:['通年の居住者で、対象は国内の事業所得（営業等）のみ・発生主義・通常申告です。下記の対象外事項はありませんか？',
    'Were you a Japan resident all year, with only domestic general business income, accrual accounting, and an ordinary annual return? Confirm that none of the exclusions below applies.'],
  approval:['青色申告の承認を受けていますか？','Are you approved to file a blue return for 2026?'],
  books:['複式簿記で記帳し、貸借対照表・損益計算書等を添付しますか？','Do your actual records follow double-entry bookkeeping, and will you attach a balance sheet and profit and loss statement?'],
  deadline:['法定申告期限までに申告しますか？','Will you file by the statutory deadline?'],
  etax:['期限内に申告書・決算書等をe-Taxで送信しますか？','Will you transmit the return and required financial statements through e-Tax by the deadline?'],
  qualified:['事業の仕訳帳・総勘定元帳を優良な電子帳簿の要件を満たして保存していますか？',
    'Do you maintain the actual journal and general ledger as qualified electronic books?'],
  notified:['優良な電子帳簿の届出（又は有効な承認）を期限までに整えていますか？','Have you filed, or will you file by the deadline, the required qualified-book notice (or do you have valid approval)?'],
  opening:['前年末・開業時の資料と照合しましたか？残高なしの場合も確認してください。','Have you checked the opening balances against your records? Confirm even if all opening balances are zero.'],
  adjustments:['売掛・買掛、未収・未払、前受・前払、棚卸、按分、償却を確認し、必要な整理仕訳と明細を記入しましたか？',
    'Did you check receivables, payables, accruals, prepayments, inventory, business-use allocation and depreciation, and enter all needed adjustments and details?'],
  deductions:['控除の根拠資料を確認し、対応外の控除・税額控除・特例はありませんか？','Did you check deduction records and confirm no unsupported deductions, tax credits, or special rules apply?'],
  withholding:['源泉徴収を売上の総額に含め、明細は証憑と照合しましたか？該当なしの場合も確認してください。','Have you included the gross sales behind any withholding and checked all payout details? Confirm even if there was no withholding.'],
  residence:['翌年1月1日の住所は納税地と同じで、住民税・事業税欄への特別な記載は不要ですか？','Will your January 1, 2027 address match your tax address, with no special resident-tax or enterprise-tax entries needed?'],
};
export const exclude: Pair = [
  '対象外：他の所得、国外取引の特例・外国税額控除、現金主義の特例、年途中の開廃業・出国・死亡、欠損・繰越、従業員・専従者、製造原価・引当金、士業報酬明細、医療費・寄附・生命保険・家族の控除等、住宅等の税額控除、消費税・住民税・事業税の申告。該当する場合は公式手続へ。',
  'Outside scope: other income, foreign income rules or credits, the cash-basis election, a midyear start, closure, departure or death, losses and carryovers, payroll or family workers, manufacturing costs and reserves, the separate accountant/lawyer fee detail, medical, donation, life insurance and family deductions, housing or other tax credits, and consumption, resident and enterprise tax returns. Use the official process for these.',
];
