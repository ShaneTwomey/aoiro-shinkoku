import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, type PDFPage, type PDFFont, rgb } from 'pdf-lib';
import fontUrl from './assets/NotoSansJP-Regular.ttf?url';
import { type Field } from './report';

export const ink = rgb(.08,.18,.25), muted = rgb(.25,.32,.35), draft = rgb(.63,.18,.13);
export const landscape: [number,number] = [841.89,595.28], portrait: [number,number] = [595.28,841.89];
let fontBytes: Promise<ArrayBuffer> | undefined;
async function bytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('asset');
  return res.arrayBuffer();
}
export async function document(title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('青色申告帳 | Aoiro 2026');
  pdf.registerFontkit(fontkit);
  fontBytes ??= bytes(fontUrl).catch(e => {fontBytes = undefined; throw e;});
  // Keep the full Japanese font: this fontkit release drops glyphs when subsetting it.
  const font = await pdf.embedFont(await fontBytes,{subset:false});
  return {pdf,font};
}
const clean = (s: unknown) => String(s ?? '').replace(/[\p{Cc}\p{Cf}]/gu,' ').trim();
export function verifyText(font: PDFFont, lines: string[]) {
  const glyphs = new Set(font.getCharacterSet());
  for (const line of lines) for (const c of clean(line)) {
    if (!glyphs.has(c.codePointAt(0)!)) throw new Error('glyph');
  }
}
export type Put = (value: unknown, left: number, right: number, top: number,
  opts?: {align?: 'right'|'center'; size?: number; color?: typeof ink}) => void;
export function writer(page: PDFPage,font: PDFFont, width: number,height: number): Put {
  const s = page.getWidth()/width, sy = page.getHeight()/height;
  return (value,left,right,top,{align,size=12,color=ink}={}) => {
    const string = clean(value);
    if (!string) return;
    const space = (right-left)*s;
    let fs = size*s;
    let w = font.widthOfTextAtSize(string,fs);
    if (w > space) {fs *= space/w; w=space;}
    if (fs < 4) throw new Error('fit');
    const offset = align==='right' ? space-w : align==='center' ? (space-w)/2 : 0;
    page.drawText(string,{x:left*s+offset,y:page.getHeight()-top*sy,size:fs,font,color});
  };
}
export async function backgrounds(pdf: PDFDocument,url: string,size: [number,number]) {
  const src = await PDFDocument.load(await bytes(url));
  const forms = await pdf.embedPages(src.getPages());
  return forms.map(form => {
    const page = pdf.addPage(size);
    page.drawPage(form,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});
    return page;
  });
}
export const only = (n: unknown) => n === 0 || n === '0' ? '' : n;
export const amount = (p:Put,v:unknown,x:number,right:number,y:number) => p(only(v),x,right,y,{align:'right'});
export function fieldWriters(field: (s:string)=>unknown) {
  return {
    text:(p:Put,id:string,x:number,right:number,y:number) => p(field(id),x,right,y),
    num:(p:Put,id:string,x:number,right:number,y:number,keepZero=false) => p(keepZero?field(id):only(field(id)),x,right,y,{align:'right'}),
  };
}
export async function pages(pdf: PDFDocument,font: PDFFont, title:string) {
  // Separate ASCII so codes and monetary amounts copy as plain digits even
  // when the Japanese font applies contextual numeral substitutions.
  const ascii = await pdf.embedFont(StandardFonts.Helvetica);
  const fontFor = (s:string) => /^[\x20-\x7e]/.test(s) ? ascii : font;
  const draw = (s:string, y:number, size:number, color:typeof ink) => {
    let x=41;
    for (const span of s.match(/[\x20-\x7e]+|[^\x20-\x7e]+/gu)??[]) {
      const f=fontFor(span);
      page.drawText(span,{x,y,size,font:f,color});
      x+=f.widthOfTextAtSize(span,size);
    }
  };
  let page: PDFPage,y=0,n=0;
  const next = () => {
    y=54; page = pdf.addPage(portrait); n++;
    draw(title,804,15,ink);
    page.drawLine({start:{x:41,y:792},end:{x:554,y:792},thickness:1,color:muted});
    draw('令和8年分  |  '+n,28,9,muted);
  };
  next();
  const write = (line: string, size=10, faint=false) => {
    const lines: string[] = [];
    let buf='', width=0;
    for (const c of clean(line)) {
      const w=fontFor(c).widthOfTextAtSize(c,size);
      if (width+w>510) {lines.push(buf); buf=''; width=0;}
      buf+=c; width+=w;
    }
    lines.push(buf);
    for(const s of lines){
      if(y>781) next();
      y+=size+5;
      if(s) draw(s,842-y,size,faint?muted:ink);
    }
  };
  return {write,next};
}
export const refs = (f:Field) => [...(f.from.fields??[]),...(f.from.refs??[]),f.from.input,f.from.rule].filter(Boolean).join(' / ');
export const fmt = (v: number|string) => typeof v==='number' ? v.toLocaleString('ja-JP') : v;
