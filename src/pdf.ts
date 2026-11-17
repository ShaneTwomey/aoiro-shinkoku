import { account, accounts } from './accounts';
import { type Data, type Review, detailYen } from './model';
import { get, report, versionLine, MISSING_2026, NTA_CORNER, NTA_BLUE_PDF, NTA_RETURN_PDF, moneyNames } from './report';
import { document, verifyText, backgrounds, landscape, portrait, writer, draft, muted, fieldWriters, amount, pages, refs, fmt } from './pdf-core';
import { bluePages } from './pdf-blue';
import blueUrl from './assets/blue.pdf?url';
import returnUrl from './assets/return.pdf?url';

export async function filingPDF(d: Data, r: Review) {
  if (!r.ready) throw new Error('notReady');
  const fields = report(d,r).flatMap(s=>s.fields);
  const {pdf,font} = await document('令和8年分 所得税・青色申告（転記用・提出不可）');
  verifyText(font,[...Object.values(d.profile),...Object.values(d.details).flatMap(rows=>rows.flatMap(r=>Object.values(r)))]);
  const blue = (await backgrounds(pdf,blueUrl,landscape)).map(p => writer(p,font,1112,786));
  const [r1,r2] = (await backgrounds(pdf,returnUrl,portrait)).map(p => writer(p,font,900,1273));
  const field = (id:string) => get(fields,id);
  const {text,num} = fieldWriters(field);
  bluePages(blue,d,r,field);
  const {profile:pr} = d, {t} = r;

  r1('08',164,217,76,{align:'center',size:18}); r1('1',534,566,76,{align:'center',size:15}); r1('確定',577,697,76,{align:'center',size:18});
  text(r1,'P.office',490,596,135);
  const zip=pr.zip.replace('-','');
  r1(zip.slice(0,3),255,300,160,{align:'center'}); r1(zip.slice(3),319,365,160,{align:'center'});
  r1('住所',150,181,160,{align:'center',size:10});
  text(r1,'P.address',121,496,189);
  r1('9',56,65,234,{align:'center',size:9}); r1('同上',121,496,243);
  text(r1,'P.kana',605,860,188); text(r1,'P.name',605,860,220);
  text(r1,'P.profession',570,662,244); text(r1,'P.trade',735,861,244);
  const phone = pr.phone.split('-');
  if(phone.length===3) phone.forEach((s,i)=>r1(s,[668,737,810][i],[722,793,862][i],274,{align:'center'}));
  else text(r1,'P.phone',674,860,274);
  const dob = pr.birth;
  const era = dob>='2019-05-01' ? ['令和',2018] as const : dob>='1989-01-08' ? ['平成',1988] as const :
    dob>='1926-12-25' ? ['昭和',1925] as const : dob>='1912-07-30' ? ['大正',1911] as const : ['明治',1867] as const;
  [era[0],Number(dob.slice(0,4))-era[1],dob.slice(5,7),dob.slice(8,10)].forEach((v,i)=>
    r1(v,736+i*33.1,765+i*33.1,161,{align:'center',size:11}));
  r1('○',152,180,274,{align:'center',size:17});
  text(r1,'R1.bookCode',205,230,309);
  // Exact line coordinates on the 900 x 1273 rendering of NTA1KOA02001.
  const left: Record<string,number> = {'ア':309,1:566,12:822,13:846,14:870,26:1080,30:1173};
  for (const [id,y] of Object.entries(left)) num(r1,'R1.'+id,305,448,y,id==='12'||id==='30');
  if(t.basic) r1(t.basic/10000,306,383,1057,{align:'right'});
  const right: Record<number,number> = {32:333,42:473,44:520,45:544,46:568,49:615,50:638,51:662,53:708,59:845};
  for (const [id,y] of Object.entries(right)) {
    if(id==='50' && t.selfAssessed<0) r1('△'+(-t.selfAssessed),721,862,y,{align:'right'});
    else num(r1,'R1.'+id,721,862,y,['32','44','45','46','50'].includes(id));
  }
  if(t.taxable) r1(t.taxable/1000,721,813,309,{align:'right'});
  if(t.final>=0) r1(Math.floor(t.final/100),721,829,685,{align:'right'});

  r2('8',55,77,49,{align:'center',size:13}); r2('確定',339,391,49,{align:'center',size:13});
  text(r2,'P.address',109,412,133); text(r2,'P.trade',109,412,160);
  text(r2,'P.kana',109,412,180); text(r2,'P.name',109,412,195);
  const social = [
    [moneyNames.health[0],Number(field('R2.health'))],
    ['国民年金・基金・その他',Number(field('R2.pension'))+Number(field('R2.pensionFund'))+Number(field('R2.otherSocial'))],
    ['小規模企業共済等掛金',r.mutual],
  ] as const;
  social.filter(([,n])=>n!==0).forEach(([label,n],i)=>{
    const y=251+i*28.6;
    r2(label,60,205,y);
    amount(r2,n,213,321,y); amount(r2,n,331,441,y);
  });
  d.details.withholding.forEach((a,i)=>{
    const y=569+i*27.6;
    r2('事業',42,120,y); r2('営業等',126,188,y);
    r2(a.name,214,385,y); r2(a.address,409,616,y);
    amount(r2,detailYen(a),641,751,y); amount(r2,detailYen(a,'tax'),778,875,y);
  });
  num(r2,'R2.49',778,875,681);
  for(const p of blue) {
    p('令和8年分・下書き（提出不可）',42,400,773,{size:11,color:draft});
    p('国税庁資料を加工：'+NTA_BLUE_PDF,550,1088,773,{size:10,color:muted,align:'right'});
  }
  r1('令和8年分・下書き（提出不可）',38,400,35,{size:13,color:draft});
  r2('令和8年分・下書き（提出不可）',24,450,15,{size:12,color:draft});
  r1('国税庁資料を加工：'+NTA_RETURN_PDF,38,470,48,{size:8,color:muted});
  r2('国税庁資料を加工：'+NTA_RETURN_PDF,24,469,27,{size:8,color:muted});
  return pdf.save();
}

export async function worksheetPDF(d: Data, r: Review) {
  const {pdf,font} = await document('令和8年分 確定申告書等作成コーナー 転記用ワークシート');
  const sections = report(d,r);
  verifyText(font,sections.flatMap(s=>s.fields.map(f=>String(f.value))));
  const out=await pages(pdf,font,'確定申告書等作成コーナー · 転記用ワークシート');
  out.write(MISSING_2026[0],11);
  out.write(r.ready?'帳簿と入力の確認は完了。作成コーナーで税額・様式を照合してください。':'下書き：未解決の項目があります。');
  out.write(NTA_CORNER,9,true);
  out.write(versionLine,9,true);
  out.write('1.「決算書・収支内訳書」で一般用の青色申告決算書を選択。B1〜B4を参照。');
  out.write('2.「所得税」で事業所得（営業等）を選択。R1・R2を参照し、控除・源泉徴収・予定納税を入力。');
  out.write('3. 自動計算された欄は照合用。個人番号・提出日・還付口座は公式手続で入力。');
  out.write('4. 年金・共済は証明書等を公式案内どおり準備し、申告書と決算書を確認後に提出。');
  out.write('J＝CSV仕訳、A＝手入力仕訳。入力名と算式の参照先を各金額の下に表示。');
  for(const s of sections) {
    out.next(); out.write(s.title[0],13);
    for(const f of s.fields){
      out.write(f.id+'  '+f.label[0]+'  :  '+fmt(f.value));
      const evidence = refs(f); if (evidence) out.write('参照：'+evidence,8,true);
    }
  }
  return pdf.save();
}

export async function booksPDF(d: Data,r: Review) {
  const {pdf,font} = await document('令和8年分 帳簿・決算資料');
  const {b} = r;
  verifyText(font,[d.profile.name,...b.entries.map(e=>e.memo),...d.imports.map(i=>i.name)]);
  const out = await pages(pdf,font,'仕訳帳 / 総勘定元帳 / 決算資料');
  out.write(r.ready ? '帳簿確認済・保存用' : '下書き・未確認');
  out.write(d.profile.name,11);
  out.write('仕訳帳　2026/01/01〜2026/12/31',13);
  const imports = new Map(d.imports.map(f=>[f.hash,f.name]));
  for(const e of b.entries) {
    out.write(b.refs.get(e.id)+'　'+e.date+'　借：'+account[e.debit].ja+'　貸：'+account[e.credit].ja+'　'+fmt(e.amount)+'円');
    const batch=imports.get(e.source);
    out.write((batch ? batch+' CSV '+e.row+'行' : '手入力')+'　'+e.memo,8,true);
  }
  out.write('借方合計 '+fmt(b.debits)+'円  /  貸方合計 '+fmt(b.credits)+'円',11);
  out.next(); out.write('総勘定元帳',13);
  out.write('残高は科目の通常の貸借区分を正として表示します。',9,true);
  for(const a of accounts) {
    if(!b.opening[a.id]&&!b.ledgers[a.id].length) continue;
    out.write(a.ja+'　期首残高 '+fmt(b.opening[a.id])+'円',11);
    for(const e of b.ledgers[a.id]) {
      out.write(e.id+'　'+e.date+'　'+account[e.counterpart].ja+'　借 '+fmt(e.debit)+'　貸 '+fmt(e.credit)+'　残高 '+fmt(e.balance));
    }
    out.write('期末残高 '+fmt(b.closing[a.id])+'円',9,true);
  }
  for (const index of [0,3]) {
    const s=report(d,r)[index];
    out.next(); out.write(index===0?'損益計算書':'貸借対照表',13);
    for(const f of s.fields) if(f.value!==0 || /assets|equity/.test(f.id)) out.write(f.label[0]+'　'+fmt(f.value)+'円');
  }
  return pdf.save();
}
