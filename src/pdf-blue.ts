import { account, accounts } from './accounts';
import { type Data, type Review, detailYen } from './model';
import { type Put, fieldWriters, amount, only } from './pdf-core';

// Coordinates measured on the 1112 x 786 rendering of NTA0KOA2100.
export function bluePages([p1,p2,p3,p4]:Put[],d:Data,r:Review,field:(s:string)=>unknown) {
  const {text,num}=fieldWriters(field);
  const {profile:pr} = d, {b,t,cap} = r;
  p1('8',364,419,64,{align:'center',size:19});
  text(p1,'P.address',333,590,131);
  p1(pr.businessAddress || pr.address,333,590,168);
  text(p1,'P.profession',333,440,205);
  text(p1,'P.trade',491,591,205);
  p1(pr.kana,650,850,122,{size:10});
  text(p1,'P.name',650,850,139);
  text(p1,'P.phone',695,850,158);
  for (const [x,v] of [[796,'1'],[837,'1'],[977,'12'],[1018,'31']] as const) p1(v,x,x+35,257,{align:'center'});
  const b1y = [0,310,338,364,390,416,442,469,494,521,547,573,599,625,651,677,703,
    310,338,364,390,416,442,469,494,521,547,573,599,625,651,677,703,729,0,0,0,0,0,0,0,0,0,548,574,600];
  for (let n=1;n<=45;n++) {
    if (!b1y[n]) continue;
    const cols: [number,number] = n<=16 ? [223,384] : n<=33 ? [572,737] : [926,1083];
    num(p1,'B1.'+n,...cols,b1y[n],n>=43);
  }
  for (const a of accounts.filter(a=>a.line && a.line>=25 && a.line<31 && b.closing[a.id]!==0))
    p1(a.ja,411,518,b1y[a.line!]);

  const name = (p:Put,x:number,right:number,y:number) => {
    p(pr.kana,x,right,y-13,{size:8}); p(pr.name,x,right,y);
  };
  name(p2,245,496,68);
  for(let i=0;i<12;i++) {
    num(p2,'B2.S'+(i+1),103,262,151+i*23.45);
    num(p2,'B2.P'+(i+1),296,450,151+i*23.45);
  }
  num(p2,'B2.use',103,262,433);
  num(p2,'B2.misc',103,262,456);
  num(p2,'B1.1',103,262,479,true);
  num(p2,'B1.3',296,450,479);
  d.details.rent.forEach((x,i)=>{
    const y=489+38.8*i;
    p2(x.address+' '+x.name,469,746,y);
    p2(x.property,757,882,y);
    amount(p2,detailYen(x,'keyMoney')+detailYen(x,'renewal'),909,989,y-3);
    amount(p2,detailYen(x,'paid'),909,989,y+15);
    amount(p2,detailYen(x),998,1080,y+8);
  });
  p2(0,953,1080,608,{align:'right'});
  num(p2,'B1.43',953,1080,633,true);
  p2(0,953,1080,cap>100000?655:702,{align:'right'});
  p2(t.blue,953,1080,cap>100000?678:724,{align:'right'});

  p3(pr.name,246,735,30);
  for (const k of ['sales','purchase'] as const) {
    const up = k==='sales'?0:169;
    d.details[k].forEach((x,i)=>{
      const y=69+i*29.2+up;
      p3(x.name,61,214,y); p3(x.address,239,470,y);
      if(x.number) p3(x.number,498,613,y+(x.number.startsWith('T')?-7:7),{size:10});
      amount(p3,detailYen(x),640,728,y);
    });
    num(p3,'B3.'+k+'.rest',640,728,179+up);
    num(p3,k==='sales'?'B1.1':'B1.3',640,728,197+up,true);
  }
  d.details.depr.forEach((a,i)=>{
    const y=436+i*29.2;
    const [year,month]=a.acquired.split('-');
    p3(a.name,62,136,y);
    p3(year,162,186,y-9,{align:'center',size:9});
    p3(month,189,223,y-9,{align:'center',size:9});
    p3(a.quantity,162,222,y+5,{align:'right'});
    const row: [unknown,number,number,number?][] = [
      [detailYen(a,'cost'),249,322,-8],[detailYen(a,'basis'),328,402],[a.method,406,439],
      [a.life,443,469],[a.rate,475,516],[a.months,522,560,-7],[detailYen(a,'ordinary'),566,643],
      [detailYen(a,'special'),650,717],[detailYen(a,'ordinary')+detailYen(a,'special'),724,798],
      [a.percent,805,837],[detailYen(a),842,920],[detailYen(a,'closing'),926,1002],[a.memo,1008,1086],
    ];
    row.forEach(([v,x,right,dy])=>p3(only(v),x,right,y+(dy??0),{align:'right',size:11}));
  });
  num(p3,'B1.18',842,920,638);
  d.details.interest.forEach((a,i)=>{
    const y=719+i*22;
    p3(a.address+' '+a.name,43,275,y);
    amount(p3,detailYen(a,'yearEnd'),282,370,y); amount(p3,detailYen(a,'paid'),377,464,y); amount(p3,detailYen(a),470,558,y);
  });

  p4('8',87,127,67,{align:'center'});
  name(p4,114,310,128);
  p4('8',610,631,130,{align:'center',size:10}); p4('12',640,661,130,{align:'center',size:10}); p4('31',676,694,130,{align:'center',size:10});
  for (const [left,right,v] of [[179,194,'1'],[206,220,'1'],[291,306,'12'],[318,334,'31'],
    [526,539,'1'],[552,568,'1'],[639,652,'12'],[669,683,'31']] as const)
    p4(v,left,right,173,{align:'center',size:10});
  const asset = ['cash','current','time','bank','notesIn','ar','securities','stock','advances','loansOut',
    'building','fixtures','machines','vehicles','equipment','land','prepaid','otherAsset'];
  const liab = ['notesOut','ap','loansIn','accrued','unearned','held','otherDebt'];
  asset.forEach((id,i)=>{
    const y=195+i*22.04;
    if(i>=16 && (b.opening[id]||b.closing[id])) p4(account[id].ja,70,170,y);
    num(p4,'B4.O.'+id,204,285,y); num(p4,'B4.C.'+id,316,396,y);
  });
  liab.forEach((id,i)=>{
    const y=195+i*22.04;
    if(i>=6 && (b.opening[id]||b.closing[id])) p4(account[id].ja,412,519,y);
    num(p4,'B4.O.'+id,547,634,y); num(p4,'B4.C.'+id,659,750,y);
  });
  num(p4,'B4.C.draw',316,396,701);
  num(p4,'B4.O.assets',204,285,723,true); num(p4,'B4.C.assets',316,396,723,true);
  num(p4,'B4.C.contribution',659,750,660);
  num(p4,'B4.O.capital',547,634,682,true); num(p4,'B4.C.capital',659,750,682,true);
  num(p4,'B4.C.profit',659,750,701,true);
  num(p4,'B4.O.equity',547,634,723,true); num(p4,'B4.C.equity',659,750,723,true);
}
