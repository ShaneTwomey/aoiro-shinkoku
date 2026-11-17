# 青色申告帳 · Aoiro Ledger

[日本語](#日本語) · [English](#english) · [法令・様式の根拠 / Rule and form evidence](docs/rules.md)

## 日本語

令和8年分（2026年）の所得税・復興特別所得税の申告準備アプリです。国内の事業所得（営業等）のみを申告する、通年居住者の青色申告承認済み個人事業主向けです。CSV、帳簿、計算、PDFはブラウザ内で処理します。IndexedDBに自動保存し、JSONで端末内にバックアップできます。

### 起動する

Node.js 22.12以上とnpmが必要です。

```sh
npm ci
npm run build
npm run preview
```

ターミナルに表示された http://127.0.0.1:4173 を開きます。ブラウザのプロファイル、ホスト名、ポートを同じにすると作業を再開できます。「バックアップと復元」からJSONを保存してください。復元はバックアップで現在のデータを置き換えます。JSONとPDFには入力した個人情報が含まれます。1つのタブで編集してください。

### 仕訳帳からCSVを出力する

1. [元のGoogleスプレッドシート](https://docs.google.com/spreadsheets/d/1AVcDrTQe-EE1yuIqPb_7PjVClyTeZf3CaecDR_uPg_o/edit#gid=63546998)で **仕訳帳** タブを開きます。
2. **ファイル → ダウンロード → CSV（現在のシート）** を選びます。ブック全体や別のタブではなく、現在のシートを出力します。
3. アプリの **CSV取込** でファイルを選び、取込プレビューを確認します。エラーがあれば元のシートを修正して再出力します。
4. **全行を仕訳帳へ登録** を押します。同じ内容のCSVはファイル名を変えても再登録できません。同じ取引が複数行ある場合は全行残ります。既に取り込んだ期間を含む別のCSVは、重複する行を事前に除いてください。

| 列 | 内容 |
| --- | --- |
| 日付 | 2026年の取引認識日。例：2026/01/03 または 2026/1/5。 |
| 借方科目 | 借方の日本語勘定科目。例：普通預金、通信費。 |
| 借方金額 | 借方金額。正の整数円。カンマ入りの金額はCSVの引用符で囲みます。 |
| 貸方科目 | 貸方の日本語勘定科目。例：売上高、普通預金。 |
| 貸方金額 | 貸方金額。借方金額と一致する正の整数円。 |
| 摘要 | 取引メモ。空欄可。 |
| エラーメッセージ | シート側の検証結果。空欄にします。エラーがある行は原本を修正します。 |

**仕訳帳サンプルを試す：** 元のブックの **仕訳帳サンプル** タブを開き、同じ **ファイル → ダウンロード → CSV（現在のシート）** で出力します。タブ内のサンプル日付が他年分なら、コピー上で2026年に直して試してください。元のブックが開けない場合やテスト結果を再現する場合は、同梱の[架空の仕訳帳サンプル](public/fixtures/journal-2026.csv)を取り込むか、アプリの「架空の仕訳帳サンプルを開く」を押します。

次は同梱ファイルの正確な形式です（UTF-8、BOMと先頭のタイトル行は任意）。

```csv
仕訳帳
日付,借方科目,借方金額,貸方科目,貸方金額,摘要,エラーメッセージ
2026/01/03,普通預金,"1,500,000",売上高,"1,500,000",架空案件・青葉,
2026/1/5,普通預金,"1,500,000",売上高,"1,500,000",架空案件・桜,
2026/2/15,通信費,"200,000",普通預金,"200,000",架空の通信費,
2026/5/10,消耗品費,"200,000",普通預金,"200,000",架空の消耗品,
2026/9/12,旅費交通費,"200,000",普通預金,"200,000",架空の出張,
,,,,,,
```

### 決算から申告へ

1. **仕訳確認** で借方・貸方を照合します。科目の別名は[対応科目一覧](src/accounts.ts)にあります。未登録の科目は原本で正しい科目に分類します。1行は借方・貸方各1科目です。複合仕訳は同じ摘要等を付けて複数の均衡した行に分けます。
2. **決算整理** では期首残高を入力して、未収・未払、前受・前払、棚卸、償却、家事按分を確認します。元入金は前年資料に基づきます。棚卸の例：期首は「期首商品棚卸高／棚卸資産」、期末は「棚卸資産／期末商品棚卸高」。償却や按分の金額は証憑から算定して入力します。借入利子、地代家賃、固定資産、主要取引先は該当する明細を入力します。
3. **申告者情報** で控除資格・期限・提出方法、社会保険料、共済・iDeCo、源泉徴収と予定納税額を確認します。源泉徴収は総額で売上を記帳します。売掛金を計上済みの場合、入金時に「預金／売掛金（手取額）」と「事業主貸／売掛金（源泉額）」に分けて消し込みます。源泉額は第二表の支払者別明細にも入力します。サンプルだけを使う場合は「架空の申告情報を入力」でテスト用の0円と判定項目を入力できます。
4. **申告プレビュー** で、各欄の仕訳・整理仕訳・入力・参照欄をたどれます。未解決の入力や対応範囲外の項目が残っている間、様式PDFは出力できません。確認後、決算書（一般用4ページ）と確定申告書（第一表・第二表）の日本語PDF、転記ワークシート、仕訳帳・総勘定元帳・損益計算書・貸借対照表を保存します。
5. [確定申告書等作成コーナー](https://www.keisan.nta.go.jp/kyoutu/ky/sm/top)の令和8年分で、まず一般用の青色申告決算書、次に所得税の事業所得（営業等）を入力します。転記表で項目を探し、自動計算欄の結果を比較します。個人番号、提出日、還付口座等は公式手続で入力し、該当する年金・共済等の証明書類を用意します。入力と公式様式を確認してからご自身で提出・納付します。通常の申告・納付期限は[2027年3月15日](https://www.nta.go.jp/publication/pamph/koho/kurashi/html/06_1.htm)です。

同梱の架空ケースは売上300万円、経費60万円、青色控除前240万円、期限内e-Taxの青色控除65万円、基礎控除104万円、他の控除・源泉徴収・予定納税は0円です。課税所得71万円、所得税35,500円、復興特別所得税745円、納付額36,200円です。この0円の設定は計算確認用です。ご自身の金額と混同しないでください。

対象外の例：他の所得、国外所得の特例、現金主義の特例、年途中の開廃業・出国・死亡、損失と繰越、従業員・専従者、製造原価、士業報酬の個別明細、医療費・寄附・家族・生命保険等の控除、住宅等の税額控除、消費税・住民税・事業税。控除の要否を確認し、該当時は公式手続へ進みます。追加用紙を要する明細は公式手続で作成します。アプリの帳簿は優良電子帳簿の適格性を証明しません。

国税庁は収録したPDFを令和7年分以降用／令和5年分以降用として掲載しています。**令和8年分の作成コーナー実画面と年分別の記載要領を照合できていないため、様式PDF・転記表は下書きです。** e-Tax用のデータファイルは提供しません。[法令・様式の根拠](docs/rules.md)で確認範囲と未確認事項を示します。

## English

A local browser app for preparing a 2026 (令和8年分) Japanese national income and reconstruction surtax return. It supports full-year Japan residents approved for blue filing who have only domestic general business income (事業所得・営業等). CSV parsing, bookkeeping, tax calculation and PDF generation run in the browser. Work is saved in IndexedDB.

### Run locally

Use Node.js 22.12 or later and npm.

```sh
npm ci
npm run build
npm run preview
```

Open http://127.0.0.1:4173 in your browser and select **English**. To resume work, use the same browser profile, hostname and port. Use **Backup & restore** to save a local JSON copy. Restoring replaces the current work. The JSON and PDFs contain the details you entered. Edit in one tab at a time.

### Get the journal CSV from Google Sheets

1. Open the **仕訳帳** tab in the [original Google Sheets template](https://docs.google.com/spreadsheets/d/1AVcDrTQe-EE1yuIqPb_7PjVClyTeZf3CaecDR_uPg_o/edit#gid=63546998).
2. Select **ファイル → ダウンロード → CSV（現在のシート）** (**File → Download → Comma-separated values (.csv, current sheet)**). Export the current tab.
3. In **Import CSV**, select the file and review each row. If the app flags a row, correct the source sheet and export it again.
4. Choose **Post all rows**. The same batch cannot be posted again, even with a new filename. Identical transactions within the file are preserved. Remove overlapping rows before importing a *different* CSV containing some previously posted entries.

| Column | Meaning |
| --- | --- |
| 日付 | Transaction recognition date in 2026, e.g. 2026/01/03 or 2026/1/5. |
| 借方科目 | Japanese debit account, e.g. 普通預金 or 通信費. |
| 借方金額 | Positive whole yen debited. CSV quotes protect commas in amounts. |
| 貸方科目 | Japanese credit account, e.g. 売上高 or 普通預金. |
| 貸方金額 | Positive whole yen credited. Must match the debit. |
| 摘要 | Transaction memo; may be empty. |
| エラーメッセージ | Source sheet error. Fix the source if this is populated. |

**Try 仕訳帳サンプル:** select the **仕訳帳サンプル** tab in the original workbook and use the same **ファイル → ダウンロード → CSV（現在のシート）** menu. If the sample dates are in a different tax year, use a copy and change the dates to 2026. To reproduce the tested result, import the bundled [fictional 仕訳帳 sample](public/fixtures/journal-2026.csv) or click **Preview the fictional CSV** in the app. The exact fixture format is reproduced in the Japanese section above; it lists the seven original headers and five fictional transactions. Files may have a UTF-8 BOM and an optional initial 仕訳帳 title row.

### Close the books and prepare the return

1. In **Review journal**, reconcile the debit and credit totals. See the [account list](src/accounts.ts) for accepted Japanese names and aliases. Classify unknown accounts in the source sheet. Each row has one debit and one credit; split compound entries into balanced rows and use a common memo to connect them.
2. In **Year-end adjustments**, supply and confirm January 1 balances and check receivables, payables, accruals, prepayments, inventory, depreciation and business use. For inventory, debit opening inventory cost and credit Inventory to clear the opening stock, then debit Inventory and credit closing inventory for the count. Reconcile any calculated depreciation or allocation to supporting records. Enter details for applicable major counterparties, rent, nonfinancial lenders and fixed assets.
3. In **Taxpayer inputs**, confirm scope, blue-return approval, actual bookkeeping, deadline, filing method and deduction eligibility. Enter eligible social insurance and mutual aid/iDeCo payments, withholding and advance tax from source records. For a withheld receivable, record sales gross first and clear the receivable in two entries (bank for the net amount and owner drawings for tax withheld). Also enter the payer and withholding amount for Part 2. With the bundled sample, **Fill fictional filing answers** sets the example facts and amounts.
4. In **Review & export**, trace reported figures to journal or adjustment IDs, inputs, related fields and rule sources. The form export is unavailable while required answers, reconciliations or scope questions are unresolved. After review, export Japanese PDFs on the NTA templates: the four-page general blue-return statement, Parts 1 and 2 of the income tax return, the field-by-field worksheet, and the journal, general ledger, profit and loss statement and balance sheet.
5. Open the 2026 flow in the [NTA Preparation Corner](https://www.keisan.nta.go.jp/kyoutu/ky/sm/top). Start with the general blue-return statement, then enter domestic general business income in the income tax return. Use the worksheet to find each field and compare auto-calculated results. Supply My Number, filing date and refund destination as applicable directly in the official process. Prepare any relevant pension or contribution certificates as instructed, review the official documents, then submit and pay yourself. The ordinary filing and payment deadline is [March 15, 2027](https://www.nta.go.jp/publication/pamph/koho/kurashi/html/06_1.htm).

The fictional case has ¥3,000,000 gross revenue, ¥600,000 deductible expenses and ¥2,400,000 profit before the blue deduction. It assumes a ¥650,000 blue deduction through timely e-Tax filing, a ¥1,040,000 basic deduction, and no other deductions, withholding or advance payments. Taxable income is ¥710,000; income tax is ¥35,500 and reconstruction surtax is ¥745, giving **¥36,200 payable** after rounding. The zero payments are test assumptions. Use actual amounts for your return.

Outside scope: other income, foreign income rules, the cash-basis election, midyear commencement, closure, departure or death, losses or carryovers, employees or family workers, manufacturing costs, separate accountant or lawyer fee details, medical, donation, family and life insurance deductions, housing and other tax credits, and consumption, resident and enterprise tax. Handle those cases or schedules that exceed the printed space in the official process. Saving your books in this app does not establish eligibility for the qualified electronic book route.

The NTA lists the included source forms as applicable from 2025 and 2023 respectively. **The final 2026 Preparation Corner screens and 2026-specific filing instructions have not been checked. The form PDFs and worksheet are marked as drafts.** The app does not generate a machine-readable e-Tax file. See the [rule and form evidence](docs/rules.md) for publication dates, source hashes, test coverage and remaining checks.

### テスト / Tests

```sh
npm ci
npx playwright install chromium
npm run build
npm test
npm run test:e2e
```

テストには架空データのみを使用します。ブラウザテストは本番ビルドでPDFをダウンロードし、日本語と金額を抽出して検証します。WindowsでネイティブのRollupモジュールが制限された環境でもビルドできるよう、公式Wasm版を固定しています。

Tests use fictional data only. Playwright runs against the production build, downloads the PDFs and extracts Japanese text and amounts. The build uses the official Rollup Wasm package so it also runs on Windows hosts that restrict native Rollup add-ons.
