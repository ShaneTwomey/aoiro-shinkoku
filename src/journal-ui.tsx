import { useContext, useEffect, useState } from 'react';
import { account, accounts } from './accounts';
import { CsvError, dateKey, HEADERS, inspectCsv, MAX_FILE, MAX_ROWS, post, yen, type Preview, type Entry } from './journal';
import { csvIssues, pick, rowIssues } from './i18n';
import { Panel, Input, Language, Select, Table, useWord, yenText } from './widgets';
import { openAccounts, type Data, type Review } from './model';

export type Change = (f:(d:Data)=>Data)=>void;
export const resetBooks = (d:Data): Data => ({...d,facts:{...d.facts,adjustments:'',withholding:''}});
export function ImportScreen({data,change,go}:{data:Data;change:Change;go:()=>void}) {
  const [preview,setPreview]=useState<Preview>();
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [page,setPage]=useState(0);
  const lang=useContext(Language), w=useWord();
  const name=data.imports.at(-1)?.name;
  const issues=preview?.rows.filter(r=>r.issues.length).length??0;
  const n=100;
  const fail=(e:unknown)=>{
    setMessage(e instanceof CsvError ? pick(lang,csvIssues[e.code])+(e.row?' ('+e.row+')':'') :
      w(['ファイルを読み込めませんでした。','Could not read the file.']));
  };
  const load=async (f:File|undefined)=>{
    if (!f) return;
    setMessage('');setPreview(undefined);setPage(0);setBusy(true);
    try {
      if(f.size>MAX_FILE) throw new CsvError('size');
      setPreview(await inspectCsv(f.name,await f.arrayBuffer(),data.imports));
    } catch(e){fail(e);} finally {setBusy(false);}
  };
  const fixture=async()=>{
    setBusy(true);
    try {
      const res=await fetch(import.meta.env.BASE_URL+'fixtures/journal-2026.csv');
      if(!res.ok) throw new Error('fixture');
      await load(new File([await res.blob()],'仕訳帳サンプル.csv'));
    } catch(e){fail(e);setBusy(false);}
  };
  const add=()=>{
    if(!preview) return;
    try {
      const entries=post(preview,data.imports);
      if(data.entries.length+entries.length>MAX_ROWS) throw new CsvError('size');
      change(d=>resetBooks({...d,entries:[...d.entries,...entries],imports:[...d.imports,{name:preview.name,hash:preview.hash}]}));
      go();
    } catch(e){fail(e);}
  };
  return <>
    <Panel title={['仕訳帳を取り込む','Import the journal']}
      help={['Googleスプレッドシートで「仕訳帳」を開き、ファイル → ダウンロード → CSV（現在のシート）を選択します。',
        'Open 仕訳帳 in Google Sheets and choose File → Download → Comma-separated values (.csv, current sheet).']}>
      <div className="file-box">
        <div><strong>{w(['令和8年分のCSV','2026 journal CSV'])}</strong><p className="muted">{w(['UTF-8 · 最大12 MB・2万行','UTF-8 · up to 12 MB and 20,000 rows'])}</p></div>
        <label className="control"><span>{w(['CSVファイル','CSV file'])}</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{void load(e.target.files?.[0]);e.currentTarget.value='';}}/></label>
      </div>
      <div className="actions">
        <button className="quiet" onClick={()=>void fixture()} disabled={busy}>{w(['架空の仕訳帳サンプルを開く','Preview the fictional CSV'])}</button>
        <a href={import.meta.env.BASE_URL+'fixtures/journal-2026.csv'} download>{w(['サンプルCSVを保存','Download sample CSV'])}</a>
      </div>
      {name&&<p className="muted">{w(['前回の取込：','Last import: '])}{name} · {data.entries.length}{w(['件',' entries'])}</p>}
      {message&&<p role="alert" className="notice warn">{message}</p>}
    </Panel>
    {preview&&<Panel title={['取込プレビュー','Import preview']}>
      <div className="between"><p role="status">{preview.name} · {preview.rows.length} {w(['件','rows'])} · {issues} {w(['件に修正が必要','with errors'])}</p>
        <button className="primary" disabled={issues>0} onClick={add}>{w(['全行を仕訳帳へ登録','Post all rows'])}</button></div>
      {!!issues&&<p className="notice warn">{w(['原本を修正してCSVを出力し直してください。問題がある行を含むファイルは登録できません。',
        'Correct the source sheet and export again. A batch with invalid rows cannot be posted.'])}</p>}
      <Table headers={[w(['行','Row']),...HEADERS,w(['検証結果','Validation'])]}>
        {preview.rows.slice(page*n,page*n+n).map(r=><tr key={r.row} className={r.issues.length?'invalid':''}>
          <td>{r.row}</td>{HEADERS.map((_,i)=><td key={i}>{r.cells[i]}</td>)}
          <td>{r.issues.length?r.issues.map(x=>w(rowIssues[x])).join(' · '):w(['有効','Valid'])}</td>
        </tr>)}
      </Table>
      <Pager {...{page,setPage}} total={preview.rows.length} n={n}/>
    </Panel>}
  </>;
}
export function Pager({page,setPage,total,n}:{page:number;setPage:(n:number)=>void;total:number;n:number}) {
  const w=useWord();
  if(total<=n)return null;
  return <div className="actions"><button className="quiet" disabled={page===0} onClick={()=>setPage(page-1)}>{w(['前へ','Previous'])}</button>
    <span aria-live="polite">{page+1} / {Math.ceil(total/n)}</span>
    <button className="quiet" disabled={(page+1)*n>=total} onClick={()=>setPage(page+1)}>{w(['次へ','Next'])}</button></div>;
}
export function JournalScreen({data,change,r,target}:{data:Data;change:Change;r:Review;target:string}) {
  const w=useWord(), lang=useContext(Language), [query,setQuery]=useState(''),[page,setPage]=useState(0);
  const {b}=r,n=100;
  const [pending,setPending]=useState<Entry>();
  const display=b.entries.filter(x=>[b.refs.get(x.id),x.date,x.memo,account[x.debit].ja,account[x.credit].ja,
    account[x.debit].en,account[x.credit].en].some(s=>s?.toLowerCase().includes(query.toLowerCase())));
  useEffect(()=>{if(target){setQuery(target);setPage(0);}},[target]);
  const remove=()=>{
    if(!pending)return;
    change(d=>resetBooks({...d,entries:d.entries.filter(x=>x.id!==pending.id)}));
    setPage(0);setPending(undefined);
  };
  const fileNames=new Map(data.imports.map(i=>[i.hash,i.name]));
  const name=(id:string)=>lang==='ja'?account[id].ja:account[id].ja+' · '+account[id].en;
  return <Panel title={['仕訳帳','Journal']}
    help={['明細を確認し、修正は反対仕訳または決算整理から行います。','Review your entries. Use a reversing entry or the adjustment screen to correct them.']}>
    <div className="facts-line">
      <span>{w(['借方合計','Total debits'])} <strong>{yenText(b.debits)}</strong></span>
      <span>{w(['貸方合計','Total credits'])} <strong>{yenText(b.credits)}</strong></span>
      <span data-testid="ledger-status">{b.assets===b.equity && b.assetsOpen===b.equityOpen && b.debits===b.credits ? w(['帳簿一致','Ledger balanced']) : w(['帳簿不一致','Ledger out of balance'])}</span>
    </div>
    <label className="control short"><span>{w(['仕訳の検索','Filter entries'])}</span><input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
    {pending&&<div className="notice warn"><p>{w(['この仕訳を削除しますか？元のCSV全体は再取込できません。','Remove this entry? The original CSV will still be recorded as imported.'])} {b.refs.get(pending.id)}</p>
      <div className="actions"><button onClick={remove}>{w(['削除する','Remove entry'])}</button><button className="quiet" onClick={()=>setPending(undefined)}>{w(['取消','Cancel'])}</button></div>
    </div>}
    {display.length===0?<p className="empty">{w(['表示する仕訳がありません。','No entries to show.'])}</p>:<>
      <Table headers={[[w(['参照','Ref.'])],w(['日付','Date']),w(['借方','Debit']),w(['貸方','Credit']),w(['金額','Amount']),w(['摘要・資料','Memo / source']),w(['操作','Action'])]}>
        {display.slice(page*n,page*n+n).map(e=><tr key={e.id}>
          <td className="mono">{b.refs.get(e.id)}</td><td>{e.date}</td><td>{name(e.debit)}</td><td>{name(e.credit)}</td><td>{yenText(e.amount)}</td>
          <td>{e.memo}<small>{e.source==='manual'?w(['手入力','Manual entry']):fileNames.get(e.source)+' · '+e.row}</small></td>
          <td><button className="quiet" onClick={()=>setPending(e)}>{w(['削除…','Remove…'])}</button></td>
        </tr>)}
      </Table><Pager {...{page,setPage,n}} total={display.length}/>
    </>}
  </Panel>;
}
export function EntriesForm({change,data}:{change:Change;data:Data}) {
  const lang=useContext(Language), w=useWord();
  const [m,set]=useState({date:'2026-12-31',debit:'',credit:'',amount:'',memo:''}),[message,msg]=useState('');
  const setM=(key:keyof typeof m,value:string)=>set({...m,[key]:value});
  const add=()=>{
    const date=dateKey(m.date),amount=yen(m.amount,true);
    if(!date||!Object.hasOwn(account,m.debit)||!Object.hasOwn(account,m.credit)||m.debit===m.credit||amount===undefined||!m.memo.trim()){
      msg(w(['令和8年の日付、異なる借方・貸方科目、正の整数の金額、摘要を入力してください。','Enter a valid 2026 date, different debit and credit accounts, positive whole yen, and a memo.']));
      return;
    }
    if(data.entries.length>=MAX_ROWS){msg(w(csvIssues.size));return;}
    const e:Entry={id:crypto.randomUUID(),date,amount,debit:m.debit,credit:m.credit,memo:m.memo.trim(),source:'manual',row:0};
    change(d=>resetBooks({...d,entries:[...d.entries,e]}));
    set({...m,debit:'',credit:'',amount:'',memo:''});
    msg(w(['仕訳を追加しました。','Entry added.']));
  };
  return <Panel title={['整理仕訳を追加','Add a journal adjustment']}
    help={['期首棚卸：期首棚卸高 / 棚卸資産。期末棚卸：棚卸資産 / 期末棚卸高。償却・按分額は証憑で確認し、必要な明細を追加します。',
      'Inventory: debit opening inventory cost and credit Inventory to clear the opening stock; debit Inventory and credit closing inventory to record the count. Reconcile depreciation and business-use amounts with your records.']}>
    <div className="grid">
      <Input label={['日付','Date']} type="date" min="2026-01-01" max="2026-12-31" value={m.date} onChange={e=>setM('date',e.target.value)}/>
      {(['debit','credit'] as const).map((k,i)=><Select key={k} label={w(i?['貸方科目','Credit account']:['借方科目','Debit account'])} value={m[k]} update={v=>setM(k,v)}>
        <option value="">{w(['科目を選択','Choose an account'])}</option>
        {accounts.map(a=><option key={a.id} value={a.id}>{a.ja}{lang==='en'?' — '+a.en:''}</option>)}
      </Select>)}
      <Input label={['金額（円）','Amount in yen']} inputMode="numeric" maxLength={12} value={m.amount} onChange={e=>setM('amount',e.target.value)}/>
      <Input label={['摘要','Memo']} maxLength={500} value={m.memo} onChange={e=>setM('memo',e.target.value)}/>
    </div>
    <div className="actions"><button className="primary" onClick={add}>{w(['仕訳を追加','Add entry'])}</button><span role="status">{message}</span></div>
  </Panel>;
}
export function Opening({data,change,r}:{data:Data;change:Change;r:Review}) {
  const w=useWord();
  return <Panel title={['1月1日の期首残高','January 1 opening balances']} help={['空欄は0円。元入金は前年資料をもとに入力します。','Blank means zero. Enter opening capital from your records.']}>
    <div className="facts-line">
      <span>{w(['期首資産','Opening assets'])} <strong>{yenText(r.b.assetsOpen)}</strong></span>
      <span>{w(['期首負債・資本','Opening liabilities and capital'])} <strong>{yenText(r.b.equityOpen)}</strong></span>
    </div>
    <details><summary>{w(['期首科目を開く','Edit opening balances'])}</summary>
      <div className="grid padded">{openAccounts.map(a=><Input key={a.id} label={[a.ja,a.en]} inputMode="numeric" maxLength={12} value={data.opening[a.id]??''}
        onChange={e=>{const value=e.target.value;change(d=>({...d,opening:{...d.opening,[a.id]:value},facts:{...d.facts,opening:'',adjustments:''}}));}}/>)}</div>
    </details>
  </Panel>;
}
