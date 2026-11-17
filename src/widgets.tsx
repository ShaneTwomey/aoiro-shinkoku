import { createContext, useContext, useId, type ReactNode, type InputHTMLAttributes } from 'react';
import type { Pair } from './report';
import { type Lang, pick, factsLabels } from './i18n';
import type { Data, Decision, decisions } from './model';
export const Language = createContext<Lang>('ja');
export function useWord() { const lang=useContext(Language); return (p:Pair) => pick(lang,p); }
export function official(lang:Lang,p:Pair) { return lang==='ja'?p[0]:p[0]+' — '+p[1]; }
export const yenText = (value: number) => '¥'+value.toLocaleString('ja-JP');
export function Panel({title,help,children}:{title:Pair;help?:Pair;children:ReactNode}) {
  const w=useWord();
  return <section className="panel"><h2>{w(title)}</h2>{help&&<p className="muted">{w(help)}</p>}{children}</section>;
}
export function Input({label,...props}:{label:Pair}&InputHTMLAttributes<HTMLInputElement>) {
  const lang=useContext(Language);
  return <label className="control"><span><span lang="ja">{label[0]}</span>{lang==='en'&&<small>{label[1]}</small>}</span><input {...props}/></label>;
}
export function Select({label,value,update,children}:{label:ReactNode;value:string;update:(s:string)=>void;children:ReactNode}) {
  const id=useId();
  return <div className="control"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e=>update(e.target.value)}>{children}</select></div>;
}
export function DecisionBox({id,data,update}:{id:typeof decisions[number];data:Data;update:(v:Decision)=>void}) {
  const w=useWord();
  return <Select label={w(factsLabels[id])} value={data.facts[id]} update={v=>update(v as Decision)}>
    <option value="">{w(['選択してください','Select an answer'])}</option>
    <option value="yes">{w(['はい','Yes'])}</option>
    <option value="no">{w(['いいえ','No'])}</option>
  </Select>;
}
export function Table({headers,children}:{headers:ReactNode[];children:ReactNode}) {
  const w=useWord();
  return <div className="scroller" tabIndex={0} role="region" aria-label={w(['横スクロール可能な表','Scrollable table'])}>
    <table><thead><tr>{headers.map((h,i)=><th scope="col" key={i}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}
