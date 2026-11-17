import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { type Lang, pick, tabs } from './i18n';
import { ImportScreen, JournalScreen } from './journal-ui';
import { AdjustScreen, Taxpayer } from './taxpayer-ui';
import { initial, restore, review, type Data } from './model';
import { read, save } from './storage';
import { download, ReviewScreen } from './review-ui';
import { Language, yenText } from './widgets';
import './style.css';

function App() {
  const [lang,setLang]=useState<Lang>(()=>localStorage.getItem('aoiro-lang')==='en'?'en':'ja');
  const [step,setStep]=useState(0),[target,setTarget]=useState('');
  const [data,setData]=useState<Data|null>(null),[pending,setPending]=useState<Data>(),[loaded,setLoaded]=useState(false);
  const [saveState,setSave]=useState<'saved'|'saving'|'failed'|'readFailed'>('saving');
  const [backupError,setError]=useState(false);
  const needsSave=useRef(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const w=(p:readonly [string,string])=>pick(lang,p);
  const r=useMemo(()=>data?review(data):null,[data]);
  useEffect(()=>{
    let active=true;
    read().then(d=>{if(active){setData(d??initial());setSave('saved');}}).catch(()=>{if(active)setSave('readFailed');})
      .finally(()=>{if(active)setLoaded(true);});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!data||!needsSave.current)return;
    let active=true;
    setSave('saving');
    save(data).then(()=>{if(active)setSave('saved');},()=>{if(active)setSave('failed');});
    return ()=>{active=false;};
  },[data]);
  useEffect(()=>{document.documentElement.lang=lang;localStorage.setItem('aoiro-lang',lang);},[lang]);
  useEffect(()=>{if(data&&step!==0)heading.current?.focus();},[step]); // Focus the destination only on navigation.
  const go=(i:number)=>{setTarget('');setStep(i);};
  const change=(f:(d:Data)=>Data)=>{needsSave.current=true;setData(d=>d?f(d):d);};
  const toJournal=(ref:string)=>{setTarget(ref);setStep(1);};
  const readBackup=async(file:File|undefined)=>{
    if(!file)return;
    setError(false);setPending(undefined);
    try{
      if(file.size>24_000_000)throw new Error('size');
      setPending(restore(JSON.parse(await file.text())));
    }catch{setError(true);}
  };
  const applyBackup=()=>{
    if(!pending)return;
    needsSave.current=true;setData(pending);setPending(undefined);go(1);
  };
  return <Language.Provider value={lang}>
    <header className="top">
      <div className="bar">
        <div className="brand"><span className="mark" aria-hidden="true">青</span><div>
          <strong>{w(['青色申告帳','Aoiro Ledger'])}</strong><small>{w(['個人事業の申告準備','Sole proprietor tax preparation'])}</small>
        </div></div>
        <div className="top-actions">
          <span className={'local '+(saveState.includes('ailed')?'failure':'')} role="status">
            {saveState==='saved'?w(['端末に保存済み','Saved on this device']):saveState==='saving'?w(['端末に保存中','Saving on this device']):w(['端末保存エラー','Local storage error'])}
          </span>
          <div className="segmented" aria-label={w(['表示言語','Language'])}>
            <button lang="ja" aria-pressed={lang==='ja'} onClick={()=>setLang('ja')}>日本語</button>
            <button lang="en" aria-pressed={lang==='en'} onClick={()=>setLang('en')}>English</button>
          </div>
        </div>
      </div>
    </header>
    <main className="shell">
      <div className="intro">
        <div><p className="eyebrow">2026 <span> / </span> 令和8年分</p>
          <h1>{w(['青色申告の準備','Prepare your blue return'])}</h1>
          <p>{w(['仕訳帳から確定申告へ。入力・計算・PDF出力はこの端末内で行います。','Turn your journal into a return. Data entry, calculations and PDF export stay on this device.'])}</p>
        </div>
        <details className="backup"><summary>{w(['バックアップと復元','Backup & restore'])}</summary>
          <div className="actions">
            <button className="quiet" disabled={!data} onClick={()=>data&&download('aoiro-2026-backup.json',new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))}>{w(['バックアップを保存','Download backup'])}</button>
            <label className="control"><span>{w(['バックアップを選択','Choose backup file'])}</span>
              <input type="file" accept=".json,application/json" onChange={e=>{void readBackup(e.target.files?.[0]);e.currentTarget.value='';}} disabled={!loaded}/>
            </label>
          </div>
          <small>{w(['バックアップには入力した個人情報が含まれます。','The backup contains the personal details you entered.'])}</small>
          {backupError&&<p role="alert">{w(['有効な令和8年版のバックアップではありません。','This is not a valid 2026 backup.'])}</p>}
          {pending&&<div className="notice warn">
            <p>{w(['作業中のデータをバックアップで置き換えます。','Replace the current work with this backup?'])} ({pending.entries.length})</p>
            <div className="actions"><button className="primary" onClick={applyBackup}>{w(['置き換えて復元','Replace and restore'])}</button>
              <button className="quiet" onClick={()=>setPending(undefined)}>{w(['取消','Cancel'])}</button></div></div>}
        </details>
      </div>
      {saveState==='readFailed'&&<p role="alert" className="notice warn">{w(['端末の保存データを開けません。ブラウザの設定を確認するか、バックアップを復元してください。',
        'Could not open local work. Check your browser settings or restore a backup.'])}</p>}
      {saveState==='failed'&&<p role="alert" className="notice warn">{w(['保存できませんでした。この画面を閉じる前にバックアップを保存してください。',
        'Could not save. Download a backup before closing this page.'])}</p>}
      {data&&r&&<>
        <nav aria-label={w(['申告準備の手順','Filing preparation steps'])} className="steps">
          {tabs.map((t,i)=><button key={i} aria-current={step===i?'step':undefined} onClick={()=>go(i)}>
            <span className="step-no">{'0'+(i+1)}</span><span>{w(t)}</span>
          </button>)}
        </nav>
        <div className="metrics">
          {([
            [['売上（収入）金額','Gross revenue'],r.b.revenue,'revenue'],
            [['必要経費・売上原価','Expenses and cost of sales'],r.b.expense+r.b.cost,'expense'],
            [['青色控除前の所得金額','Profit before blue deduction'],r.b.profit,'profit'],
            [!r.ready?['税額見込み','Estimated national tax']:r.t.final<0?['還付予定額（概算）','Estimated refund']:['納付予定額（概算）','Estimated balance due'],Math.abs(r.t.final),'tax'],
          ] satisfies [readonly [string,string],number,string][]).map(([label,amount,id])=><div className="metric" data-testid={id} key={id}>
            <span>{w(label)}</span><strong>{id==='tax'&&!r.ready?'—':yenText(amount)}</strong>
            {id==='tax'&&!r.ready&&<small>{w(['申告情報を確認してください','Confirm your filing inputs'])}</small>}
          </div>)}
        </div>
        <h2 className="sr-only" ref={heading} tabIndex={-1}>{w(tabs[step])}</h2>
        <div className="work-area">
          {step===0&&<ImportScreen {...{data,change}} go={()=>go(1)}/>}
          {step===1&&<JournalScreen {...{data,change,r,target}}/>}
          {step===2&&<AdjustScreen {...{data,change,r}}/>}
          {step===3&&<Taxpayer {...{data,change}}/>}
          {step===4&&<ReviewScreen {...{data,r,toJournal,go}}/>}
        </div>
        {step<4&&<div className="next"><button className="quiet" onClick={()=>go(step+1)}>{w(tabs[step+1])} →</button></div>}
      </>}
    </main>
    <footer>{w(['青色申告帳 · 令和8年分 · 国内事業所得（営業等）','Aoiro Ledger · 2026 · Domestic general business income'])}</footer>
  </Language.Provider>;
}
createRoot(document.getElementById('root')!).render(<App/>);
