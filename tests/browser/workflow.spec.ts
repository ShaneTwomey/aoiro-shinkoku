import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const sample='public/fixtures/journal-2026.csv';
const step=(page:Page,name:string)=>page.getByRole('navigation').getByRole('button',{name});
async function extract(path:string) {
  const root=join(process.cwd(),'node_modules','pdfjs-dist').replaceAll(sep,'/')+'/';
  const doc=await getDocument({data:new Uint8Array(await readFile(path)),
    cMapUrl:root+'cmaps/',cMapPacked:true,standardFontDataUrl:root+'standard_fonts/',isEvalSupported:false}).promise;
  try {
    return await Promise.all(Array.from({length:doc.numPages},async (_,i)=>{
      const p=await doc.getPage(i+1);
      const {items}=await p.getTextContent();
      return {text:items.map(item=>'str' in item?item.str:'').join(' '),items,view:p.view};
    }));
  } finally {await doc.destroy();}
}
async function download(page:Page,name:string,info:TestInfo,file:string) {
  const event=page.waitForEvent('download',{timeout:30_000});
  await page.getByRole('button',{name,exact:true}).click();
  const result=await event;
  const path=info.outputPath(file);
  await result.saveAs(path);
  expect(await result.failure()).toBeNull();
  return path;
}
test('2026 filing from the actual UTF-8 fixture to Japanese PDFs',async ({page},info)=>{
  const unexpected:string[]=[];
  const errors:string[]=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')&&!r.url().startsWith('blob:'))unexpected.push(r.url());});
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'青色申告の準備'})).toBeVisible();
  await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByLabel('CSV file',{exact:true}).setInputFiles(sample);
  await expect(page.getByText('5 rows · 0 with errors')).toBeVisible();
  await expect(page.getByRole('cell',{name:'架空案件・桜'})).toBeVisible();
  await page.getByRole('button',{name:'Post all rows'}).click();
  await expect(page.getByTestId('revenue')).toContainText('¥3,000,000');
  await expect(page.getByTestId('expense')).toContainText('¥600,000');
  await expect(page.getByTestId('profit')).toContainText('¥2,400,000');
  await expect(page.getByTestId('ledger-status')).toHaveText('Ledger balanced');
  await expect(page.getByText('¥3,600,000',{exact:true})).toHaveCount(2);
  await step(page,'Review & export').click();
  await expect(page.getByText('Draft · filing inputs need attention')).toBeVisible();
  await expect(page.getByTestId('tax')).toContainText('Confirm your filing inputs');
  await expect(page.getByRole('button',{name:'NTA form PDFs (review)'})).toBeDisabled();

  await step(page,'Year-end adjustments').click();

  await page.getByLabel('Debit account',{exact:true}).selectOption('cash');
  await page.getByLabel('Credit account',{exact:true}).selectOption('bank');
  await page.getByLabel(/Amount in yen/).fill('10,000');
  await page.getByLabel(/Memo/).fill('架空の現金振替');
  await page.getByRole('button',{name:'Add entry',exact:true}).click();
  await expect(page.getByText('Entry added.')).toBeVisible();
  await step(page,'Review journal').click();
  await expect(page.getByTestId('ledger-status')).toHaveText('Ledger balanced');
  await expect(page.getByText('¥3,610,000',{exact:true})).toHaveCount(2);
  await step(page,'Taxpayer inputs').click();
  await page.getByRole('button',{name:'Fill fictional filing answers'}).click();
  await expect(page.getByLabel(/Legal name/)).toHaveValue('青葉 試験');
  await step(page,'Review & export').click();
  await expect(page.getByText('Inputs reviewed · draft for official entry')).toBeVisible();
  await expect(page.getByTestId('tax')).toContainText('¥36,200');
  await page.locator('#field-B1\\.1 details summary').click();
  await page.getByRole('button',{name:'J0002',exact:true}).click();
  await expect(page.getByRole('cell',{name:'架空案件・桜',exact:false})).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2);
  await step(page,'Review & export').click();

  const forms=await download(page,'NTA form PDFs (review)',info,'form-packet.pdf');
  const worksheet=await download(page,'Entry worksheet PDF',info,'worksheet.pdf');
  const books=await download(page,'Books and statements PDF',info,'books.pdf');
  const f=await extract(forms), w=await extract(worksheet), b=await extract(books);
  expect(f).toHaveLength(6);
  expect(f.map(x=>x.view[2]>x.view[3])).toEqual([true,true,true,true,false,false]);
  expect(f[0].text).toMatch(/3000000/);
  expect(f[0].text).toMatch(/2400000/);
  expect(f[0].text).toMatch(/650000/);
  expect(f[3].text).toContain('2390000');
  expect(f[4].text).toMatch(/青葉\s*試験/);
  expect(f[4].text).toContain('35500');
  // Line 52 has two preprinted zeros. Confirm the printed 362 prefix in its box.
  expect(f[4].items.some(x=>'str' in x && x.str==='362' &&
    x.transform[4]>520 && x.transform[5]>=387 && x.transform[5]<=391)).toBe(true);
  expect(f[5].text).toMatch(/東京都架空区青葉一丁目1番/);
  for(const p of f)expect(p.text).toMatch(/提出不可/);
  expect(w.map(x=>x.text).join(' ')).toMatch(/R1\.52.*36,200/);
  expect(b.map(x=>x.text).join(' ')).toMatch(/架空案件・青葉/);
  expect(b.map(x=>x.text).join(' ')).toMatch(/総勘定元帳.*損益計算書.*貸借対照表/);

  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  await page.reload();
  await page.getByLabel('CSV file',{exact:true}).setInputFiles(sample);
  await expect(page.getByRole('alert')).toContainText('This CSV has already been imported.');
  await expect(page.getByTestId('tax')).toContainText('¥36,200');
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('app-desktop.png'),fullPage:true});
});
test('blocks unbalanced imports and restores a local backup into another browser context',async ({page,browser},info)=>{
  await page.goto('/');
  await page.getByRole('button',{name:'English',exact:true}).click();
  const invalid='仕訳帳\n日付,借方科目,借方金額,貸方科目,貸方金額,摘要,エラーメッセージ\n2026/1/5,現金,1000,売上高,1001,架空,';
  await page.getByLabel('CSV file',{exact:true}).setInputFiles({name:'unbalanced.csv',mimeType:'text/csv',buffer:Buffer.from(invalid)});
  await expect(page.getByRole('cell',{name:'Debit and credit do not balance'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Post all rows'})).toBeDisabled();
  await expect(page.getByTestId('revenue')).toContainText('¥0');
  await page.getByLabel('CSV file',{exact:true}).setInputFiles(sample);
  await page.getByRole('button',{name:'Post all rows'}).click();
  await page.getByText('Backup & restore',{exact:true}).click();
  const backup=await download(page,'Download backup',info,'backup.json');
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  try{
    const other=await ctx.newPage();
    await other.goto('http://127.0.0.1:4173/');
    await other.getByText('バックアップと復元',{exact:true}).click();
    await other.getByLabel('バックアップを選択',{exact:true}).setInputFiles(backup);
    await other.getByRole('button',{name:'置き換えて復元',exact:true}).click();
    await expect(other.getByTestId('profit')).toContainText('¥2,400,000');
    await expect(other.getByTestId('ledger-status')).toHaveText('帳簿一致');
    expect(await other.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await other.screenshot({path:info.outputPath('app-mobile.png'),fullPage:true});
    await expect(other.getByText('端末に保存済み',{exact:true})).toBeVisible();
    await other.reload();
    await other.getByLabel('CSVファイル',{exact:true}).setInputFiles(sample);
    await expect(other.getByRole('alert')).toContainText('同じCSVはすでに取り込まれています。');
  } finally {await ctx.close();}
});
