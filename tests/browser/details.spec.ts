import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

test('reconciles fictional premiums and withholding and fills the schedules', async ({page}, info)=>{
  await page.goto('/');
  const go=(name:string)=>page.getByRole('navigation').getByRole('button',{name}).click();
  await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByLabel('CSV file',{exact:true}).setInputFiles('public/fixtures/journal-2026.csv');
  await page.getByRole('button',{name:'Post all rows'}).click();

  await go('Year-end adjustments');
  await page.getByLabel('Debit account',{exact:true}).selectOption('draw');
  await page.getByLabel('Credit account',{exact:true}).selectOption('bank');
  await page.getByLabel(/Amount in yen/).fill('40,000');
  await page.getByLabel(/Memo/).fill('架空の源泉徴収額を事業主貸へ');
  await page.getByRole('button',{name:'Add entry',exact:true}).click();

  await go('Taxpayer inputs');
  await page.getByRole('button',{name:'Fill fictional filing answers'}).click();
  await page.getByLabel(/National health insurance premiums/).fill('80,000');
  await page.getByLabel(/iDeCo contributions/).fill('20,123');
  await page.getByLabel(/Advance tax from both installments/).fill('10,000');
  await page.getByText(/Business payouts with withholding/).click();
  await page.getByRole('button',{name:'Add detail',exact:true}).click();
  const box=page.getByRole('group',{name:'Detail 1'});
  await box.getByLabel(/氏名・名称/).fill('架空の楓企画');
  await box.getByLabel(/Address/).fill('東京都架空区楓二丁目');
  await box.getByLabel(/Amount \/ deductible amount/).fill('400,000');
  await box.getByLabel(/Tax withheld/).fill('40,000');
  await page.getByLabel(/^Did you check deduction records/).selectOption('yes');
  await page.getByLabel(/^Have you included the gross sales/).selectOption('yes');

  await go('Review & export');
  await expect(page.getByText('Inputs reviewed · draft for official entry')).toBeVisible();
  await expect(page.getByTestId('tax')).toContainText('¥18,911');
  const event=page.waitForEvent('download');
  await page.getByRole('button',{name:'NTA form PDFs (review)',exact:true}).click();
  const download=await event;
  const path=info.outputPath('detail-packet.pdf');
  await download.saveAs(path);
  const doc=await getDocument({data:new Uint8Array(await readFile(path)),disableFontFace:true}).promise;
  try {
    const p=await doc.getPage(6);
    const {items}=await p.getTextContent();
    const text=items.map(x=>'str' in x?x.str:'').join(' ');
    expect(text).toContain('架空の楓企画');
    expect(text).toContain('東京都架空区楓二丁目');
    expect(text).toContain('国民健康保険料');
    expect(text).toContain('80000');
    expect(text).toContain('20123');
    expect(text).toContain('40000');
  } finally {await doc.destroy();}
});
