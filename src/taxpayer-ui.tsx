import { useContext } from 'react';
import { depreciable, account } from './accounts';
import { amounts, blankDetail, columns, decisions, fixtureInputs, limitRows, people, type Data, type Decision, type Schedule } from './model';
import { columnNames, moneyNames, profileNames, scheduleNames } from './report';
import { exclude } from './i18n';
import { DecisionBox, Input, Language, official, Panel, Select, useWord } from './widgets';
import { type Change, EntriesForm, Opening } from './journal-ui';
import type { Review } from './model';

const checklist = (change:Change,key:typeof decisions[number],v:Decision) =>
  change(d=>({...d,facts:{...d.facts,[key]:v}}));
export function DetailEditor({id,data,change}:{id:Schedule;data:Data;change:Change}) {
  const lang=useContext(Language),w=useWord();
  const rows=data.details[id];
  const apply=(f:(v:typeof rows)=>typeof rows)=>{
    change(d=>({...d,details:{...d.details,[id]:f(d.details[id])},facts:{...d.facts,[id==='withholding'?'withholding':'adjustments']:''}}));
  };
  const set=(i:number,k:string,v:string)=>apply(r=>r.map((x,j)=>j===i?{...x,[k]:v}:x));
  return <details className="schedule">
    <summary>{official(lang,scheduleNames[id])} <small>({rows.length}/{limitRows[id]})</small></summary>
    <div className="padded">
      {(id==='sales'||id==='purchase')&&<p className="muted">{w(['主要取引先を記入します。差額は「上記以外の計」になります。',
        'Enter the main counterparties. The remainder goes in “other counterparties.”'])}</p>}
      {id==='withholding'&&<p className="muted">{w(['入金額ではなく、源泉徴収前の総額と実際の源泉税額を入力します。5件以上は作成コーナーへ。',
        'Enter gross receipts before withholding and the actual tax withheld. Use the official Preparation Corner for more than four payers.'])}</p>}
      {id==='interest'&&<p className="muted">{w(['この明細は金融機関以外の借入が対象です。金融機関分との差額は帳簿で確認してください。',
        'List nonfinancial lenders only. Reconcile any difference for financial institutions against the books.'])}</p>}
      {id==='depr'&&<p className="muted">{w(['確定済みの償却計算を転記してください。取得価額・耐用年数・事業専用割合の判断は行いません。',
        'Enter your completed depreciation calculation. The app reconciles postings and book values; verify the cost basis, useful life and business share separately.'])}</p>}
      {rows.map((r,i)=><fieldset className="detail-box" key={i}><legend>{w(['明細','Detail'])} {i+1}</legend>
        <div className="grid">{columns[id].map(k=>k==='account'?
          <Select key={k} label={official(lang,columnNames[k])} value={r[k]} update={v=>set(i,k,v)}>
            <option value="">{w(['科目を選択','Choose an account'])}</option>
            {depreciable.map(id=><option value={id} key={id}>{official(lang,[account[id].ja,account[id].en])}</option>)}
          </Select>:
          <Input key={k} label={columnNames[k]} value={r[k]} maxLength={140} onChange={e=>set(i,k,e.target.value)}/>)}</div>
        <button className="quiet" onClick={()=>apply(r=>r.filter((_,j)=>j!==i))}>{w(['この明細を削除','Remove this detail'])}</button>
      </fieldset>)}
      <button className="quiet" disabled={rows.length>=limitRows[id]} onClick={()=>apply(r=>[...r,blankDetail(id)])}>{w(['明細を追加','Add detail'])}</button>
    </div>
  </details>;
}
export function AdjustScreen({data,change,r}:{data:Data;change:Change;r:Review}) {
  return <>
    <Opening {...{data,change,r}}/>
    <EntriesForm {...{data,change}}/>
    <Panel title={['決算書の明細と確認','Statement details and year-end checks']}>
      {(['sales','purchase','rent','interest','depr'] as const).map(id=><DetailEditor key={id} {...{id,data,change}}/>)}
      <div className="stack">
        {(['opening','adjustments'] as const).map(id=><DecisionBox key={id} {...{id,data}} update={v=>checklist(change,id,v)}/>)}
      </div>
    </Panel>
  </>;
}
const bookTypes = [
  ['1 · 優良な電子帳簿（届出済み）','1 · Qualified electronic books (notice filed)'],
  ['2 · 会計ソフト等','2 · Accounting software / computer'],
  ['3 · その他の複式簿記','3 · Other double-entry books'],
  ['4 · 簡易な方法','4 · Simplified books'],
  ['5 · 上記以外','5 · Other situations'],
] as const;
export function Taxpayer({data,change}:{data:Data;change:Change}) {
  const w=useWord(),lang=useContext(Language);
  const addDemo=()=>change(d=>({...d,...fixtureInputs()}));
  const canAddDemo=data.entries.length>0&&Object.values(data.profile).every(x=>!x)&&Object.values(data.facts).every(x=>!x)
    &&Object.values(data.money).every(x=>!x)&&Object.values(data.details).every(x=>!x.length)&&!Object.values(data.opening).some(Boolean);
  return <>
    <Panel title={['申告者・事業所','Taxpayer and business']} help={['個人番号、還付口座と提出日は作成コーナーで入力します。',
      'Enter your My Number, refund account and submission date in the official Preparation Corner.']}>
      {canAddDemo&&<div className="notice">
        <p>{w(['サンプルCSVだけを試している場合は架空データを補完できます。','If you are trying only the sample CSV, you can fill in the fictional filing answers.'])}</p>
        <button className="quiet" onClick={addDemo}>{w(['架空の申告情報を入力','Fill fictional filing answers'])}</button>
      </div>}
      <div className="grid">
        {people.filter(k=>k!=='bookCode').map(k=><Input key={k} label={profileNames[k]} type={k==='birth'?'date':k==='phone'?'tel':'text'}
          maxLength={k==='zip'?8:k==='phone'?24:110} value={data.profile[k]}
          onChange={e=>{const v=e.target.value;change(d=>({...d,profile:{...d.profile,[k]:v},facts:k==='address'?{...d.facts,residence:''}:d.facts}));}}/>)}
      </div>
    </Panel>
    <Panel title={['対応範囲・青色申告特別控除','Scope and blue-return deduction']}>
      <p className="notice">{w(exclude)}</p>
      <div className="stack">
        {(['scope','approval','books','deadline','etax','qualified','notified','residence'] as const).map(id=><DecisionBox key={id} {...{id,data}}
          update={v=>checklist(change,id,v)}/>)}
        <Select label={official(lang,profileNames.bookCode)} value={data.profile.bookCode} update={v=>change(d=>({...d,profile:{...d.profile,bookCode:v}}))}>
          <option value="">{w(['区分を選択','Choose a classification'])}</option>
          {bookTypes.map((p,i)=><option key={i} value={String(i+1)}>{w(p)}</option>)}
        </Select>
      </div>
      <p className="muted">{w(['CSVの取込やアプリ内保存では、優良な電子帳簿の要件を満たすことはできません。',
        'Importing a CSV or storing it here does not establish qualified electronic books.'])}</p>
    </Panel>
    <Panel title={['所得控除・源泉徴収・予定納税','Deductions, withholding and advance tax']}
      help={['該当なしは0円。証明書類で実際の対象支払額を確認してください。',
        'Enter zero for items that do not apply. Use the eligible amounts actually paid and documented.']}>
      <div className="grid">{amounts.map(k=><Input key={k} label={moneyNames[k]} value={data.money[k]} inputMode="numeric" maxLength={12}
        onChange={e=>{const value=e.target.value;change(d=>({...d,money:{...d.money,[k]:value},facts:{...d.facts,deductions:''}}));}}/>)}</div>
      <DetailEditor id="withholding" {...{data,change}}/>
      <div className="stack">{(['deductions','withholding'] as const).map(id=><DecisionBox key={id} {...{id,data}}
        update={v=>checklist(change,id,v)}/>)}</div>
    </Panel>
  </>;
}
