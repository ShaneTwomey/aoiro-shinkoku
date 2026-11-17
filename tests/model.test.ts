import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { HEADERS, inspectCsv, post, type Entry } from '../src/journal';
import { books, fixtureInputs, initial, restore, review } from '../src/model';
import { report } from '../src/report';
const bytes=(s:string)=>new TextEncoder().encode(s).buffer;
const hdr=HEADERS.join(',');
const entry = (n:number,debit:string,credit:string,amount:number):Entry =>
  ({id:String(n),date:'2026-12-31',debit,credit,amount,memo:'架空',row:0,source:'manual'});
it('parses BOM, quotes, CRLF, escaped quotes and identical rows once per unique batch',async()=>{
  const row='2026/1/5,普通預金,"1,000",売上高,"1,000","例 ""甲""\n乙",';
  const raw='\ufeff仕訳帳,,,,,,\n'+hdr+'\n'+row+'\n'+row+'\n,,,,,,\n';
  const p=await inspectCsv('fixture.csv',bytes(raw.replaceAll('\n','\r\n')),[]);
  expect(p.rows.map(x=>x.row)).toEqual([3,5]);
  const posted=post(p,[]);
  expect(posted.map(x=>x.amount)).toEqual([1000,1000]);
  expect(posted[0].memo).toBe('例 "甲"\n乙');
  expect(new Set(posted.map(x=>x.id)).size).toBe(2);
  await expect(inspectCsv('different name.csv',bytes(raw),[{hash:p.hash,name:p.name}])).rejects.toMatchObject({code:'duplicate'});
  expect((await inspectCsv('another batch.csv',bytes(hdr+'\n'+row),[{hash:p.hash,name:p.name}])).rows).toHaveLength(1);
});
it('identifies errors on the original numbered row and blocks the entire batch',async()=>{
  const p=await inspectCsv('bad.csv',bytes(hdr+'\n2026/2/29,架空の科目,1,売上,2,,式エラー\n2025/1/1,現金,1.5,架空,1,,\n'+'2026/3/1,現金,2,売上,2\n'),[]);
  expect(p.rows[0].issues).toEqual(['date','unbalanced','debit','sheet']);
  expect(p.rows[1].issues).toEqual(['date','amount','credit']);
  expect(p.rows[2].entry?.amount).toBe(2);
  expect(()=>post(p,[])).toThrow();
  await expect(inspectCsv('invalid.csv',bytes(hdr+'\n"unterminated'),[])).rejects.toMatchObject({code:'syntax',row:2});
  await expect(inspectCsv('invalid.csv',new Uint8Array([0xff]).buffer,[])).rejects.toMatchObject({code:'encoding'});
});
it('reconciles inventory, accrual, owner movements and capital with double-entry',()=>{
  const d=initial();
  d.opening={stock:'100',capital:'100'};
  d.entries=[entry(1,'stockStart','stock',100),entry(2,'purchase','ap',200),entry(3,'ar','sales',500),
    entry(4,'stock','stockEnd',120),entry(5,'supplies','accrued',60),entry(6,'bank','contribution',40),entry(7,'draw','bank',20)];
  const b=books(d);
  expect([b.cost,b.profit,b.debits,b.credits,b.assets,b.equity,b.closing.capital,b.closing.stock]).toEqual([180,260,1040,1040,660,660,100,120]);
  expect(b.ledgers.stock.map(e=>e.balance)).toEqual([0,120]);
});
it('gates unresolved personal information and bookkeeping even with imported entries',()=>{
  const d=initial();
  d.entries=[entry(1,'bank','sales',1000)];
  d.opening.bank='100';
  const r=review(d);
  expect(r.ready).toBe(false);
  expect(r.issues.map(i=>i.key)).toEqual(expect.arrayContaining(['profile','approval','money','openingUnbalanced','bookUnbalanced']));
  expect(()=>restore({...d,entries:[{...d.entries[0],amount:-500}]})).toThrow();
});
it('keeps result and line provenance in sync for the fictional CSV',async()=>{
  const buf=await readFile('public/fixtures/journal-2026.csv');
  const p=await inspectCsv('仕訳帳サンプル.csv',new Uint8Array(buf).buffer,[]);
  const d={...initial(),...fixtureInputs(),entries:post(p,[]),imports:[{hash:p.hash,name:p.name}]};
  const r=review(d);
  expect(r.issues).toEqual([]);
  const fs=report(d,r).flatMap(s=>s.fields);
  expect(fs.find(f=>f.id==='B1.1')).toMatchObject({value:3_000_000,from:{refs:['J0001','J0002']}});
  expect(fs.find(f=>f.id==='B1.43')).toMatchObject({value:2_400_000,from:{fields:['B1.33']}});
  expect(fs.find(f=>f.id==='R1.52')?.value).toBe(36_200);
  expect(restore(JSON.parse(JSON.stringify(d)))).toEqual(d);
  d.facts.scope='no';
  expect(review(d).issues).toContainEqual({key:'scope',at:undefined});
});
