import { useContext, useMemo, useState } from 'react';
import { factsLabels, issues } from './i18n';
import { moneyNames, MISSING_2026, NTA_CORNER, NTA_FORMS, officialSources, profileNames, report, scheduleNames, versionLine } from './report';
import type { Data, Review } from './model';
import { Language, official, Panel, Table, useWord, yenText } from './widgets';

export function download(name:string,data:Blob) {
  const url=URL.createObjectURL(data);
  const link=document.createElement('a');
  link.href=url;link.download=name;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
const variants = [
  ['forms','令和8年_確定申告書・青色申告決算書_転記用.pdf',['様式PDF（転記用）','NTA form PDFs (review)']],
  ['worksheet','令和8年_作成コーナー転記表_下書き.pdf',['転記ワークシートPDF','Entry worksheet PDF']],
  ['books','令和8年_仕訳帳・総勘定元帳・決算資料.pdf',['帳簿・決算資料PDF','Books and statements PDF']],
] as const;
export function ReviewScreen({data,r,toJournal,go}:{data:Data;r:Review;toJournal:(ref:string)=>void;go:(step:number)=>void}) {
  const w=useWord(),lang=useContext(Language),[busy,setBusy]=useState(''),[message,msg]=useState('');
  const sections=useMemo(()=>report(data,r),[data,r]);
  const issueAt=(s:string)=>{
    const key=s.split(' ')[0];
    if(scheduleNames[key])return w(scheduleNames[key])+s.slice(key.length);
    return w(profileNames[s]??moneyNames[s]??factsLabels[s]??[s,s]);
  };
  const exportFile=async (variant:typeof variants[number])=>{
    setBusy(variant[0]);msg('');
    try{
      const pdf=await import('./pdf');
      const bytes=await (variant[0]==='forms'?pdf.filingPDF(data,r):variant[0]==='worksheet'?pdf.worksheetPDF(data,r):pdf.booksPDF(data,r));
      download(variant[1],new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));
      msg(w(['PDFを保存しました。','PDF downloaded.']));
    }catch(e){
      msg(e instanceof Error && e.message==='glyph' ? w(['埋め込み書体にない文字があります。入力やファイル名を確認してください。',
        'A character is missing from the embedded font. Check your input, journal memos, or filenames.']) :
        e instanceof Error && e.message==='fit' ? w(['様式の欄に収まらない文字列があります。公式手続で転記表を参照してください。',
          'A text value will not fit on the source form. Use the worksheet to enter the full text in the official process.']) :
        w(['PDFを作成できませんでした。再試行してください。','Could not create the PDF. Try again.']));
    }finally{setBusy('');}
  };
  return <>
    <Panel title={['申告前の確認','Before filing']}>
      <div className={'notice '+(r.ready?'ok':'warn')} role="status">
        <strong>{r.ready?w(['入力確認済 · 提出用ではありません','Inputs reviewed · draft for official entry']):w(['下書き · 未解決の項目があります','Draft · filing inputs need attention'])}</strong>
        <p>{w(MISSING_2026)}</p>
      </div>
      {r.issues.length>0&&<ul className="issue-list">{r.issues.map((i,j)=><li key={j}>
        <button className="as-link" onClick={()=>go(i.key==='noEntries'?0:['openingInvalid','openingUnbalanced','bookUnbalanced','unsupportedAccounts','negative','inventory','schedule','net'].includes(i.key)&&
          !i.at?.startsWith('withholding')||i.at==='opening'||i.at==='adjustments'?2:3)}>
          {i.at&&<strong>{issueAt(i.at)} · </strong>}{w(issues[i.key])}
        </button>
      </li>)}</ul>}
      <div className="actions">
        {variants.map((v,i)=><button className={i===0?'primary':'quiet'} key={v[0]} onClick={()=>void exportFile(v)}
          disabled={Boolean(busy)||(i===0&&!r.ready)}>{busy===v[0]?w(['作成中…','Generating…']):w(v[2])}</button>)}
      </div>
      {message&&<p role="status" className="muted">{message}</p>}
      <p className="muted">
        {w(['提出は作成コーナーで行います。決算書（一般用）→所得税（事業・営業等）の順に入力し、自動計算の税額と照合してください。',
          'In the Preparation Corner, create the general blue-return statement first, then the income tax return under general business income. Compare the official calculated tax before you submit.'])}
      </p>
      <div className="actions">
        <a href={NTA_CORNER} target="_blank" rel="noreferrer">{w(['確定申告書等作成コーナー ↗','NTA Preparation Corner ↗'])}</a>
        <a href={NTA_FORMS} target="_blank" rel="noreferrer">{w(['国税庁の様式一覧 ↗','Official forms list ↗'])}</a>
      </div>
      {r.t.final<0&&<p className="muted">{w(issues.refund)}</p>}
    </Panel>
    <Panel title={['欄ごとの金額と根拠','Field values and sources']} help={['欄番号は様式に対応します。JはCSV、Aは手入力の仕訳です。リンクで元の仕訳を確認できます。',
      'Field numbers match the forms. J references an imported entry; A references a manual entry. Open a reference to see the entry.']}>
      {sections.map((s,i)=><details className="schedule" key={s.title[0]} open={i===0||undefined}>
        <summary>{w(s.title)}</summary>
        <Table headers={[w(['欄','Field']),w(['項目','Label']),w(['値','Value']),w(['根拠','Source'])]}>
          {s.fields.map(f=><tr key={f.id} id={'field-'+f.id}>
            <td className="mono">{f.id}</td><td>{official(lang,f.label)}</td>
            <td>{typeof f.value==='number'?yenText(f.value):f.value||'—'}</td>
            <td className="trace">
              {f.from.input&&<div>{w(['入力：','Inputs: '])}{f.from.input.split(', ').map(x=>moneyNames[x]?w(moneyNames[x]):x).join(' · ')}</div>}
              {f.from.fields?.length?<div>{f.from.fields.map(id=><a href={'#field-'+id} key={id} onClick={()=>{
                const target=document.getElementById('field-'+id)?.closest('details');if(target)target.open=true;
              }}>{id} </a>)}</div>:null}
              {f.from.rule&&<a href={officialSources[f.from.rule]??NTA_FORMS} target="_blank" rel="noreferrer">{w(['根拠：','Rule: '])}{f.from.rule} ↗</a>}
              {f.from.refs?.length?<details><summary>{f.from.refs.length} {w(['件の仕訳','journal entries'])}</summary>
                <div>{f.from.refs.map(ref=><button className="as-link mono" key={ref} onClick={()=>toJournal(ref)}>{ref}</button>)}</div>
              </details>:null}
            </td>
          </tr>)}
        </Table>
      </details>)}
      <p className="muted mono">{versionLine}</p>
    </Panel>
  </>;
}
