'use strict';
/* =====================================================================
   CRM Dashboard v3 — ข้อมูลจริง + 11 ฟีเจอร์ใช้งานจริง
   ===================================================================== */

// ---------- helpers ----------
const fmt  = n => (Math.round(Number(n)||0)).toLocaleString('en-US');
const fmt2 = n => (Number(n)||0).toLocaleString('en-US',{maximumFractionDigits:2});
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const el = (t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const r2 = n => Math.round((Number(n)||0)*100)/100;

const DATA_KEY='crm_data',USERS_KEY='crm_users_v2',MONTHS_KEY='crm_months',SES_KEY='crm_session',LEGACY_ACC='crm_account',AUDIT_KEY='crm_audit',SMS_KEY='crm_sms_tpl';
const thMonths=['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const PALETTE=['#3b82f6','#22c55e','#f59e0b','#a855f7','#06b6d4','#ef4444','#ec4899','#84cc16','#f97316','#14b8a6','#8b5cf6','#eab308','#64748b'];

// ---------- load data ----------
const D = (function(){ try{ const s=localStorage.getItem(DATA_KEY); if(s) return JSON.parse(s); }catch(e){} return window.CRM_DATA; })();
D.customers.forEach(c=>{ ['caller','reason','next','note','name','surname'].forEach(k=>{ if(c[k]===undefined)c[k]=''; }); if(c.dnc===undefined)c.dnc=0; });

// ---------- date utils ----------
function pdate(s){ const m=String(s||'').trim().split(/[\/\-.]/); if(m.length<3)return null; const d=+m[0],mo=+m[1],y=+m[2]; if(!d||!mo||!y)return null; return new Date(Date.UTC(y,mo-1,d)); }
let DATA_MAX=0;
D.customers.forEach(c=>{ const dt=pdate(c.d); if(dt)DATA_MAX=Math.max(DATA_MAX,dt.getTime()); });
if(!DATA_MAX)DATA_MAX=Date.UTC(2026,5,30);
const RANGE={mode:'all',from:'',to:''};
function inRange(c){
  if(RANGE.mode==='all')return true;
  const dt=pdate(c.d); if(!dt)return false; const t=dt.getTime();
  if(RANGE.mode==='today')return t===DATA_MAX;
  if(RANGE.mode==='7d')return t>=DATA_MAX-6*864e5 && t<=DATA_MAX;
  if(RANGE.mode==='month'){const mx=new Date(DATA_MAX);return dt.getUTCFullYear()===mx.getUTCFullYear()&&dt.getUTCMonth()===mx.getUTCMonth();}
  if(RANGE.mode==='custom'){const a=pdate(RANGE.from),b=pdate(RANGE.to);if(a&&t<a.getTime())return false;if(b&&t>b.getTime())return false;return true;}
  return true;
}
function activeCustomers(){ return D.customers.filter(inRange); }

// ---------- normalize result ----------
function normResult(v){ if(!v)return''; let x=String(v).trim(); if(/^[0-9.,]+$/.test(x))return''; x=x.replace(/[่-๋]/g,'');
  if(/ไมรบ/.test(x))return'ไม่รับสาย'; if(/ตดตอไม/.test(x))return'ติดต่อไม่ได้'; if(/ตดสาย/.test(x))return'รับแล้วตัดสาย';
  if(/เงยบ/.test(x))return'รับแล้วเงียบ'; if(/เลกเลน/.test(x))return'เลิกเล่น'; if(/ไมสนใจ/.test(x))return'ไม่สนใจ';
  if(/ไมสะดวก/.test(x))return'ไม่สะดวก'; if(/ฝากขอความ/.test(x))return'ฝากข้อความ'; if(/ซำ/.test(x))return'เบอร์ซ้ำ';
  if(/ไมไดสมคร/.test(x))return'ไม่ได้สมัคร'; if(/โปร|20%|โบนส/.test(x))return'รับโปรโมชั่น'; return String(v).trim(); }

// ---------- aggregate (pure) ----------
function aggregate(cs){
  const bm=new Map(),daily=new Array(31).fill(0),dailyRet=new Array(31).fill(0),rb={};
  cs.forEach(c=>{
    const ret=(Number(c.dep)||0)>0?1:0;
    const brand=(c.b||'ไม่ระบุ').trim();
    let b=bm.get(brand); if(!b){b={name:brand,cust:0,ans:0,noans:0,sms:0,dep:0,ret:0,bonus:0};bm.set(brand,b);}
    b.cust++;b.ans+=c.a?1:0;b.noans+=c.na?1:0;b.sms+=c.sm?1:0;b.dep+=Number(c.dep)||0;b.ret+=ret;b.bonus+=Number(c.bn)||0;
    const dt=pdate(c.d); if(dt){const day=dt.getUTCDate(); if(day>=1&&day<=31){ if((Number(c.dep)||0)>0){daily[day-1]+=Number(c.dep);dailyRet[day-1]++;} }}
    const res=normResult(c.r); if(res)rb[res]=(rb[res]||0)+1;
  });
  const brands=[...bm.values()].map(b=>({name:b.name,cust:b.cust,calls:b.ans+b.noans,ans:b.ans,noans:b.noans,sms:b.sms,
    dep:r2(b.dep),ret:b.ret,bonus:r2(b.bonus),roi:b.bonus?Math.round(b.dep/b.bonus*10)/10:0,
    pctAns:(b.ans+b.noans)?Math.round(b.ans/(b.ans+b.noans)*1000)/10:0,pctRet:b.cust?Math.round(b.ret/b.cust*1000)/10:0})).sort((x,y)=>y.dep-x.dep);
  const T=brands.reduce((a,b)=>({cust:a.cust+b.cust,calls:a.calls+b.calls,ans:a.ans+b.ans,noans:a.noans+b.noans,sms:a.sms+b.sms,dep:a.dep+b.dep,ret:a.ret+b.ret,bonus:a.bonus+b.bonus}),{cust:0,calls:0,ans:0,noans:0,sms:0,dep:0,ret:0,bonus:0});
  T.dep=r2(T.dep);T.bonus=r2(T.bonus);
  T.pctAns=T.calls?Math.round(T.ans/T.calls*1000)/10:0;T.pctRet=T.cust?Math.round(T.ret/T.cust*1000)/10:0;
  T.roi=T.bonus?Math.round(T.dep/T.bonus*10)/10:0;T.avgDep=T.ret?Math.round(T.dep/T.ret):0;
  return {brands,totals:T,dailyDeposit:daily.map(r2),dailyRet,resultBreakdown:rb};
}
function recompute(){ D.customers.forEach(c=>c.ret=(Number(c.dep)||0)>0?1:0); Object.assign(D,aggregate(D.customers)); }

// ---------- persistence ----------
function saveData(){ try{localStorage.setItem(DATA_KEY,JSON.stringify(D));}catch(e){alert('บันทึกไม่สำเร็จ: ข้อมูลใหญ่เกินไป');} registerMonth(); if(typeof window.updateSourcePill==='function')window.updateSourcePill(); }
function applyChanges(){ recompute(); saveData(); renderAll(); }

// ---------- audit log ----------
function getAudit(){ try{return JSON.parse(localStorage.getItem(AUDIT_KEY))||[];}catch(e){return [];} }
function logAudit(action,detail){
  const a=getAudit();
  a.unshift({ts:new Date().toLocaleString('th-TH'),user:window.CRM_USER||'-',action,detail:detail||''});
  if(a.length>1000)a.length=1000;
  try{localStorage.setItem(AUDIT_KEY,JSON.stringify(a));}catch(e){}
  if(!$('#view-audit').classList.contains('hidden'))renderAudit();
}

// ---------- month snapshots ----------
function getMonths(){ try{return JSON.parse(localStorage.getItem(MONTHS_KEY))||{};}catch(e){return {};} }
function registerMonth(){ const m=getMonths(),T=D.totals; m[D.month]={month:D.month,generated:D.generated,cust:T.cust,calls:T.calls,ans:T.ans,dep:T.dep,ret:T.ret,bonus:T.bonus,roi:T.roi,pctAns:T.pctAns,pctRet:T.pctRet}; try{localStorage.setItem(MONTHS_KEY,JSON.stringify(m));}catch(e){} }

/* =====================================================================
   RENDER
   ===================================================================== */
let VW=null; // view aggregate (date-range filtered)
function renderAll(){
  $('#monthLabel').textContent=D.month; $('#monthInline').textContent=D.month; $('#genDate').textContent=D.generated;
  const act=activeCustomers(); VW=aggregate(act);
  $('#rangeInfo').textContent=`ลูกค้า ${fmt(act.length)} ราย`+(RANGE.mode!=='all'?' (กรองช่วงวันที่)':'');
  renderKPIs(); renderOverviewDonut(); renderTopVip(act); renderInsights(act);
  renderBars(); renderFunnel(); renderBrandTable(); renderTrend(); renderResults();
  populateFilters(); renderCustomers(); renderQueue(); renderCallbacks();
  renderMonths(); renderAgents(); renderCohort(); renderReports(); renderAudit();
}
const Tt=()=>VW.totals;

function renderKPIs(){
  const T=Tt();
  const k=[['ลูกค้าในช่วงนี้',fmt(T.cust),`${VW.brands.length} แบรนด์`,''],
    ['โทรติดตามไปแล้ว',fmt(T.calls),`SMS ${fmt(T.sms)} ครั้ง`,'cyan'],
    ['อัตรารับสาย',T.pctAns+'%',`รับ ${fmt(T.ans)} / ไม่รับ ${fmt(T.noans)}`,'amber'],
    ['ยอดฝากกลับรวม','฿'+fmt(T.dep),`เฉลี่ย ฿${fmt(T.avgDep)}/ราย`,'green'],
    ['ลูกค้ากลับมาฝาก',fmt(T.ret)+' ราย',`${T.pctRet}% ของช่วงนี้`,'purple'],
    ['ROI (ฝาก÷โบนัส)',T.roi+'x',`โบนัส ฿${fmt(T.bonus)}`,'green']];
  $('#kpiGrid').innerHTML=k.map(x=>`<div class="kpi ${x[3]}"><div class="kpi-label">${x[0]}</div><div class="kpi-value">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join('');
}
function donut(entries,size=150){
  const total=entries.reduce((s,e)=>s+e.value,0)||1,r=58,cx=size/2,cy=size/2,sw=20,C=2*Math.PI*r;
  let acc=0,segs='';
  entries.forEach(e=>{const len=e.value/total*C;segs+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${e.color}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(e.label)}: ${fmt(e.value)}</title></circle>`;acc+=len;});
  const svg=`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${segs}<text x="${cx}" y="${cy-4}" text-anchor="middle" fill="#e8edf7" font-size="22" font-weight="700">${fmt(total)}</text><text x="${cx}" y="${cy+16}" text-anchor="middle" fill="#8b97b3" font-size="11">รวม</text></svg>`;
  const legend=entries.map(e=>`<div class="lg"><span class="dot" style="background:${e.color}"></span><span>${esc(e.label)}</span><span class="lg-val">${fmt(e.value)} (${(e.value/total*100).toFixed(0)}%)</span></div>`).join('');
  return {svg,legend};
}
function resultEntries(limit){
  let e=Object.entries(VW.resultBreakdown).sort((a,b)=>b[1]-a[1]);
  if(limit&&e.length>limit){const top=e.slice(0,limit);const rest=e.slice(limit).reduce((s,x)=>s+x[1],0);if(rest)top.push(['อื่น ๆ',rest]);e=top;}
  return e.map((x,i)=>({label:x[0],value:x[1],color:PALETTE[i%PALETTE.length]}));
}
function renderOverviewDonut(){const d=donut(resultEntries(6));$('#donutOverview').innerHTML=d.svg;$('#donutLegend').innerHTML=d.legend;}
function renderResults(){
  const d=donut(resultEntries(8));$('#donutResults').innerHTML=d.svg;$('#donutResultsLegend').innerHTML=d.legend;
  const all=resultEntries(),total=all.reduce((s,x)=>s+x.value,0)||1;
  barsInto($('#chartResults'),all.map(x=>({label:x.label,value:x.value,display:`${fmt(x.value)} (${(x.value/total*100).toFixed(0)}%)`})));
}
function renderTopVip(act){
  const top=[...act].filter(c=>(Number(c.dep)||0)>0).sort((a,b)=>b.dep-a.dep).slice(0,5);
  $('#topVip').innerHTML=top.length?top.map((c,i)=>`<div class="rank-item"><div class="rank-num">${i+1}</div><div class="rank-main"><div class="rank-name">${esc(cname(c)||c.p||'-')}</div><div class="rank-sub">${esc(c.b)} · ${esc(c.r||'-')}</div></div><div class="rank-val">฿${fmt(c.dep)}</div></div>`).join(''):'<p class="muted">ยังไม่มีลูกค้ากลับมาฝาก</p>';
}
function cname(c){ return [c.name,c.surname].filter(Boolean).join(' '); }
function renderInsights(act){
  const T=Tt(),byRoi=[...VW.brands].filter(b=>b.roi>0).sort((a,b)=>b.roi-a.roi),byDep=[...VW.brands].sort((a,b)=>b.dep-a.dep);
  const notBack=act.filter(c=>!((Number(c.dep)||0)>0)&&(c.lg>0||c.a)&&!c.dnc).length;
  const items=[];
  if(byDep[0])items.push(['💰',`แบรนด์ทำยอดสูงสุด <b>${esc(byDep[0].name)}</b> ฿${fmt(byDep[0].dep)}`]);
  if(byRoi[0])items.push(['🎯',`คุ้มที่สุด <b>${esc(byRoi[0].name)}</b> ROI ${byRoi[0].roi}x`]);
  items.push(['📞',`โทร ${fmt(T.calls)} สาย รับ ${T.pctAns}% ดึงกลับ <b>${T.pctRet}%</b>`]);
  items.push(['🔥',`<b>${fmt(notBack)}</b> รายยังไม่กลับมาแต่มีสัญญาณสนใจ ควรโทรซ้ำ`]);
  $('#insights').innerHTML=items.map(i=>`<div class="insight-item"><div class="insight-ic">${i[0]}</div><div class="insight-tx">${i[1]}</div></div>`).join('');
}
function barsInto(c,items,roi){const max=Math.max(...items.map(i=>i.value),1);c.innerHTML=items.map(i=>`<div class="hbar${roi?' roi':''}"><span class="lbl" title="${esc(i.label)}">${esc(i.label)}</span><div class="track"><div class="fill" style="width:${(i.value/max*100).toFixed(1)}%"></div></div><span class="val">${i.display}</span></div>`).join('');}
function renderBars(){
  const tot=VW.totals.dep||1;
  barsInto($('#chartDeposit'),[...VW.brands].sort((a,b)=>b.dep-a.dep).map(b=>({label:b.name,value:b.dep,display:`฿${fmt(b.dep)} · ${(b.dep/tot*100).toFixed(0)}%`})));
  barsInto($('#chartRoi'),[...VW.brands].sort((a,b)=>b.roi-a.roi).map(b=>({label:b.name,value:b.roi,display:b.roi+'x'})),true);
}
function renderFunnel(){
  const T=Tt();
  const f=[[fmt(T.cust),'ลูกค้าในช่วงนี้',''],[fmt(T.calls),'โทรติดตาม',(T.cust?(T.calls/T.cust*100).toFixed(0):0)+'%'],[fmt(T.ans),'รับสาย',T.pctAns+'%'],[fmt(T.ret),'กลับมาฝาก',T.pctRet+'%']];
  $('#funnel').innerHTML=f.map(x=>`<div class="funnel-step"><div class="fn-num">${x[0]}</div><div class="fn-lbl">${x[1]}</div>${x[2]?`<div class="fn-pct">${x[2]}</div>`:''}</div>`).join('');
}

// brand table (rich, with % bars)
let brandSort={key:'dep',dir:-1};
function renderBrandTable(){
  const T=Tt(),tot=T.dep||1,maxDep=Math.max(...VW.brands.map(b=>b.dep),1);
  const cols=[{k:'name',t:'แบรนด์'},{k:'cust',t:'ลูกค้า',num:1},{k:'calls',t:'โทร',num:1},{k:'pctAns',t:'รับสาย%',num:1,f:v=>v+'%'},{k:'ret',t:'กลับมาฝาก',num:1},{k:'pctRet',t:'%กลับมาฝาก',num:1,f:v=>v+'%'},{k:'dep',t:'ยอดฝากกลับ (สัดส่วน)',bar:1},{k:'roi',t:'ROI',num:1,f:v=>v+'x'}];
  const rows=[...VW.brands].sort((a,b)=>{const x=a[brandSort.key],y=b[brandSort.key];return (x<y?-1:x>y?1:0)*brandSort.dir;});
  let h='<thead><tr>'+cols.map(c=>`<th class="${c.num?'num':''}" data-k="${c.k}">${c.t}${brandSort.key===c.k?(brandSort.dir<0?' ↓':' ↑'):''}</th>`).join('')+'</tr></thead><tbody>';
  rows.forEach(b=>{ h+='<tr>'+cols.map(c=>{
    if(c.bar)return `<td><span class="cellbar"><span class="cf" style="width:${(b.dep/maxDep*100).toFixed(1)}%"></span><span class="ct">฿${fmt(b.dep)} · ${(b.dep/tot*100).toFixed(0)}%</span></span></td>`;
    return `<td class="${c.num?'num':''}">${c.f?c.f(b[c.k]):esc(b[c.k])}</td>`; }).join('')+'</tr>'; });
  h+=`<tr class="row-total"><td>รวม</td><td class="num">${fmt(T.cust)}</td><td class="num">${fmt(T.calls)}</td><td class="num">${T.pctAns}%</td><td class="num">${fmt(T.ret)}</td><td class="num">${T.pctRet}%</td><td class="num">฿${fmt(T.dep)}</td><td class="num">${T.roi}x</td></tr></tbody>`;
  const tbl=$('#brandTable');tbl.innerHTML=h;
  tbl.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(brandSort.key===k)brandSort.dir*=-1;else brandSort={key:k,dir:typeof (VW.brands[0]||{})[k]==='number'?-1:1};renderBrandTable();});
}

// trend (pro)
let trendMetric='dep';
function renderTrend(){
  const isDep=trendMetric==='dep', data=isDep?VW.dailyDeposit:VW.dailyRet;
  const W=920,H=340,pad={l:62,r:20,t:20,b:36},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
  const max=Math.max(...data,1),step=isDep?5000:5,niceMax=Math.ceil(max/step)*step||step;
  const x=i=>pad.l+(data.length<=1?0:i/(data.length-1)*iw),y=v=>pad.t+ih-(v/niceMax*ih);
  // moving average (7d)
  const ma=data.map((_,i)=>{let s=0,n=0;for(let j=Math.max(0,i-3);j<=Math.min(data.length-1,i+3);j++){s+=data[j];n++;}return s/n;});
  let line='',area=`M ${x(0)} ${y(0)} `,maLine='',grid='',xl='',dots='';
  data.forEach((v,i)=>{line+=(i?'L':'M')+` ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;area+=`L ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;maLine+=(i?'L':'M')+` ${x(i).toFixed(1)} ${y(ma[i]).toFixed(1)} `;});
  area+=`L ${x(data.length-1)} ${y(0)} Z`;
  for(let g=0;g<=5;g++){const gv=niceMax/5*g,gy=y(gv);grid+=`<line x1="${pad.l}" y1="${gy}" x2="${W-pad.r}" y2="${gy}" stroke="#2a3654"/><text x="${pad.l-8}" y="${gy+4}" fill="#8b97b3" font-size="11" text-anchor="end">${isDep?fmt(gv):gv}</text>`;}
  const maxI=data.indexOf(Math.max(...data));
  data.forEach((v,i)=>{if(i%2===0||i===data.length-1)xl+=`<text x="${x(i)}" y="${H-12}" fill="#8b97b3" font-size="10" text-anchor="middle">${i+1}</text>`;const big=i===maxI;dots+=`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${big?5:3}" fill="${big?'#f59e0b':'#3b82f6'}"><title>วันที่ ${i+1}: ${isDep?'฿'+fmt2(v):v+' ราย'}</title></circle>`;});
  const peak=`<text x="${x(maxI)}" y="${y(data[maxI])-12}" fill="#f59e0b" font-size="11" font-weight="700" text-anchor="middle">สูงสุด ${isDep?'฿'+fmt(data[maxI]):data[maxI]}</text>`;
  $('#chartTrend').innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#ag)"/><path d="${line}" fill="none" stroke="#3b82f6" stroke-width="2.5"/><path d="${maLine}" fill="none" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="5 4" opacity="0.85"/>${dots}${peak}${xl}<text x="${W-pad.r}" y="14" fill="#f59e0b" font-size="10" text-anchor="end">— เส้นเฉลี่ยเคลื่อนที่ 7 วัน</text></svg>`;
  const top=data.map((v,i)=>({d:i+1,v})).sort((a,b)=>b.v-a.v).slice(0,5);
  $('#topDays').innerHTML=top.map(t=>`<div class="chip"><b>${isDep?'฿'+fmt(t.v):t.v+' ราย'}</b><small>วันที่ ${t.d}</small></div>`).join('');
}

// months
function renderMonths(){
  const list=Object.values(getMonths()).sort((a,b)=>a.month>b.month?1:-1),body=$('#monthsBody');
  if(!list.length){body.innerHTML='<p class="muted">ยังไม่มีข้อมูลรายเดือน — นำเข้า CSV แต่ละเดือนเพื่อสะสม</p>';return;}
  let cards='<div class="month-cards">'+list.map(x=>`<div class="month-card"><h3>${esc(x.month)}</h3><div class="mc-row"><span>ลูกค้า</span><b>${fmt(x.cust)}</b></div><div class="mc-row"><span>โทรไป</span><b>${fmt(x.calls)}</b></div><div class="mc-row"><span>รับสาย</span><b>${x.pctAns}%</b></div><div class="mc-row"><span>ยอดฝากกลับ</span><b>฿${fmt(x.dep)}</b></div><div class="mc-row"><span>กลับมาฝาก</span><b>${fmt(x.ret)} (${x.pctRet}%)</b></div><div class="mc-row"><span>ROI</span><b>${x.roi}x</b></div></div>`).join('')+'</div>';
  let tbl='<div class="table-wrap"><table class="data-table"><thead><tr><th>เดือน</th><th class="num">ลูกค้า</th><th class="num">โทร</th><th class="num">รับสาย%</th><th class="num">ยอดฝากกลับ</th><th class="num">กลับมาฝาก%</th><th class="num">ROI</th><th class="num">Δ ยอดฝาก</th></tr></thead><tbody>';
  list.forEach((x,i)=>{let d='—';if(i>0){const p=list[i-1].dep,df=x.dep-p,pc=p?df/p*100:0;d=`<span class="${df>=0?'delta-up':'delta-down'}">${df>=0?'▲':'▼'} ${Math.abs(pc).toFixed(0)}%</span>`;}tbl+=`<tr><td>${esc(x.month)}</td><td class="num">${fmt(x.cust)}</td><td class="num">${fmt(x.calls)}</td><td class="num">${x.pctAns}%</td><td class="num">฿${fmt(x.dep)}</td><td class="num">${x.pctRet}%</td><td class="num">${x.roi}x</td><td class="num">${d}</td></tr>`;});
  tbl+='</tbody></table></div>';
  body.innerHTML=cards+tbl+(list.length<2?'<p class="muted" style="margin-top:12px">💡 นำเข้าเดือนอื่นเพิ่ม แล้วระบบจะเทียบ Δ ให้อัตโนมัติ</p>':'');
}

// agents
function agentRows(){
  const m=new Map();
  D.customers.forEach(c=>{const k=(c.caller||'').trim()||'(ไม่ระบุ)';let a=m.get(k);if(!a){a={caller:k,total:0,ans:0,sms:0,promo:0,ret:0,dep:0};m.set(k,a);}a.total++;a.ans+=c.a?1:0;a.sms+=c.sm?1:0;a.promo+=/โปร/.test(c.r||'')?1:0;a.ret+=(Number(c.dep)||0)>0?1:0;a.dep+=Number(c.dep)||0;});
  return [...m.values()].map(a=>({...a,dep:r2(a.dep),pctAns:a.total?Math.round(a.ans/a.total*1000)/10:0,pctRet:a.total?Math.round(a.ret/a.total*1000)/10:0})).sort((x,y)=>y.dep-x.dep);
}
function renderAgents(){
  const rows=agentRows();
  let h='<thead><tr><th>พนักงาน</th><th class="num">งานที่รับผิดชอบ</th><th class="num">รับสาย</th><th class="num">รับสาย%</th><th class="num">ส่ง SMS</th><th class="num">เสนอโปร 20%</th><th class="num">ดึงกลับได้</th><th class="num">%สำเร็จ</th><th class="num">ยอดฝากกลับ</th></tr></thead><tbody>';
  rows.forEach(a=>h+=`<tr><td><span class="act-link" data-agent="${esc(a.caller)}">${esc(a.caller)}</span></td><td class="num">${fmt(a.total)}</td><td class="num">${fmt(a.ans)}</td><td class="num">${a.pctAns}%</td><td class="num">${fmt(a.sms)}</td><td class="num">${fmt(a.promo)}</td><td class="num">${fmt(a.ret)}</td><td class="num">${a.pctRet}%</td><td class="num">฿${fmt(a.dep)}</td></tr>`);
  h+='</tbody>';$('#agentTable').innerHTML=h;
  $('#agentTable').querySelectorAll('[data-agent]').forEach(s=>s.onclick=()=>agentDrill(s.dataset.agent));
}
function agentDrill(caller){
  const box=$('#agentDetail'); if(!box)return;
  const mine=D.customers.filter(c=>((c.caller||'').trim()||'(ไม่ระบุ)')===caller);
  const byDay=new Map();
  mine.forEach(c=>{const dt=pdate(c.d);const k=dt?`${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}`:'ไม่ระบุ';let g=byDay.get(k);if(!g){g={k,total:0,ans:0,ret:0,dep:0};byDay.set(k,g);}g.total++;g.ans+=c.a?1:0;g.ret+=(Number(c.dep)||0)>0?1:0;g.dep+=Number(c.dep)||0;});
  const days=[...byDay.values()];
  let h=`<div class="panel-head" style="margin-top:6px"><h2>รายวันของ ${esc(caller)}</h2></div><div class="table-wrap"><table class="data-table"><thead><tr><th>วันที่</th><th class="num">โทร</th><th class="num">รับสาย</th><th class="num">กลับมาฝาก</th><th class="num">ยอดฝากกลับ</th></tr></thead><tbody>`;
  days.forEach(g=>h+=`<tr><td>${g.k}</td><td class="num">${fmt(g.total)}</td><td class="num">${fmt(g.ans)}</td><td class="num">${fmt(g.ret)}</td><td class="num">฿${fmt(g.dep)}</td></tr>`);
  h+='</tbody></table></div>';box.innerHTML=h;box.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// cohort (by week of call date)
function cohortRows(){
  const m=new Map();
  D.customers.forEach(c=>{const dt=pdate(c.d);if(!dt)return;const day=dt.getUTCDay(),mon=new Date(dt);mon.setUTCDate(dt.getUTCDate()-((day+6)%7));const key=mon.getTime();let g=m.get(key);if(!g){g={start:mon,total:0,ans:0,ret:0,dep:0};m.set(key,g);}g.total++;g.ans+=c.a?1:0;g.ret+=(Number(c.dep)||0)>0?1:0;g.dep+=Number(c.dep)||0;});
  return [...m.values()].sort((a,b)=>a.start-b.start).map(g=>{const d=g.start;const lbl=`${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;return {lbl,total:g.total,ans:g.ans,ret:g.ret,dep:r2(g.dep),pctRet:g.total?Math.round(g.ret/g.total*1000)/10:0};});
}
function heatColor(p){ if(p>=3)return 'background:rgba(34,197,94,.25);color:#86efac'; if(p>=1.5)return 'background:rgba(245,158,11,.22);color:#fcd34d'; return 'background:rgba(239,68,68,.18);color:#fca5a5'; }
function renderCohort(){
  const rows=cohortRows();
  let h='<thead><tr><th>กลุ่ม (สัปดาห์เริ่ม)</th><th class="num">ถูกโทร</th><th class="num">รับสาย</th><th class="num">กลับมาฝาก</th><th class="num">อัตรากลับมาฝาก</th><th class="num">ยอดฝากกลับ</th></tr></thead><tbody>';
  rows.forEach(r=>h+=`<tr><td>${r.lbl}</td><td class="num">${fmt(r.total)}</td><td class="num">${fmt(r.ans)}</td><td class="num">${fmt(r.ret)}</td><td class="num"><span class="heat" style="${heatColor(r.pctRet)}">${r.pctRet}%</span></td><td class="num">฿${fmt(r.dep)}</td></tr>`);
  h+='</tbody>';$('#cohortTable').innerHTML=h||'';
  if(!rows.length)$('#cohortTable').innerHTML='<tbody><tr><td>ไม่มีข้อมูลวันที่โทร</td></tr></tbody>';
  renderCohortPromo();
}
function renderCohortPromo(){
  if(!$('#cohortPromo'))return;
  const grp={promo:{n:0,ret:0,dep:0,bonus:0},nopromo:{n:0,ret:0,dep:0,bonus:0}};
  D.customers.forEach(c=>{const isP=/โปร/.test(c.r||'')||(Number(c.bn)||0)>0;const g=isP?grp.promo:grp.nopromo;g.n++;if((Number(c.dep)||0)>0)g.ret++;g.dep+=Number(c.dep)||0;g.bonus+=Number(c.bn)||0;});
  const row=(label,g)=>{const pct=g.n?Math.round(g.ret/g.n*1000)/10:0,avg=g.ret?Math.round(g.dep/g.ret):0,net=g.dep-g.bonus;return `<tr><td>${label}</td><td class="num">${fmt(g.n)}</td><td class="num"><span class="heat" style="${heatColor(pct/15)}">${pct}%</span></td><td class="num">฿${fmt(avg)}</td><td class="num">฿${fmt(g.bonus)}</td><td class="num">฿${fmt(net)}</td></tr>`;};
  $('#cohortPromo').innerHTML='<thead><tr><th>กลุ่ม</th><th class="num">จำนวนคน</th><th class="num">กลับมาฝาก%</th><th class="num">ฝากเฉลี่ย/คน</th><th class="num">โบนัสจ่ายรวม</th><th class="num">ฝากสุทธิหลังหักโบนัส</th></tr></thead><tbody>'+row('🎁 ได้รับโปร 20%',grp.promo)+row('— ไม่ได้รับโปร',grp.nopromo)+'</tbody>';
  const pP=grp.promo.n?grp.promo.ret/grp.promo.n*100:0,pN=grp.nopromo.n?grp.nopromo.ret/grp.nopromo.n*100:0,diff=(pP-pN).toFixed(1),net=grp.promo.dep-grp.promo.bonus;
  $('#cohortVerdict').innerHTML=`สรุป: กลุ่มโปรกลับมาฝากมากกว่า <b>${diff} จุด</b> · ฝากสุทธิหลังหักโบนัสกลุ่มโปร = <b>฿${fmt(net)}</b> → ${net>0?'✅ ยังคุ้ม':'⚠️ ต้องทบทวน'}`;
}

// queue (advanced filters)
let queuePage=0;
function queueFiltered(){
  const results=$$('.qResult:checked').map(c=>c.value);
  const status=$$('.qStatus:checked').map(c=>c.value);
  const brands=$$('.qBrand:checked').map(c=>c.value);
  const allBrandsChecked=$$('.qBrand').length===brands.length;
  return roleScope(D.customers).filter(c=>{
    if(c.dnc && !status.includes('dnc'))return false;
    if(results.length && !results.includes(c.r||'(ว่าง)'))return false;
    if(!allBrandsChecked && brands.length && !brands.includes(c.b))return false;
    const ret=(Number(c.dep)||0)>0;
    const st=[]; if(ret)st.push('returned'); else st.push('pending'); if(c.a)st.push('answered'); if(c.next)st.push('callback'); if(c.dnc)st.push('dnc');
    if(status.length && !st.some(s=>status.includes(s)))return false;
    return true;
  });
}
function renderQueueChecks(){
  const res=[...new Set(D.customers.map(c=>c.r||'(ว่าง)'))].sort();
  $('#qResults').innerHTML=res.map(r=>`<label><input type="checkbox" class="qResult" value="${esc(r)}" checked> ${esc(r)}</label>`).join('');
  const bs=[...new Set(D.customers.map(c=>c.b))];
  $('#qBrands').innerHTML=bs.map(b=>`<label><input type="checkbox" class="qBrand" value="${esc(b)}" checked> ${esc(b)}</label>`).join('');
}
function renderQueue(){
  const list=queueFiltered(),PG=50,pages=Math.max(1,Math.ceil(list.length/PG));if(queuePage>=pages)queuePage=0;
  const slice=list.slice(queuePage*PG,queuePage*PG+PG);
  let h='<thead><tr><th>แบรนด์</th><th>ชื่อ</th><th>เบอร์โทร</th><th>ผลการโทร</th><th class="num">login</th><th>นัดโทร</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>';
  slice.forEach(c=>{const idx=D.customers.indexOf(c);const ret=(Number(c.dep)||0)>0;h+=`<tr><td>${esc(c.b)}</td><td>${esc(cname(c)||'-')}</td><td>${esc(c.p||'-')}</td><td>${c.r?`<span class="tag res">${esc(c.r)}</span>`:'-'}</td><td class="num">${c.lg||0}</td><td>${esc(c.next||'-')}</td><td>${c.dnc?'<span class="tag" style="background:rgba(239,68,68,.18);color:#fca5a5">ห้ามโทร</span>':(ret?'<span class="tag ok">กลับมาฝาก</span>':'<span class="tag no">รอติดตาม</span>')}</td><td><span class="act-link" data-edit="${idx}">แก้ไข</span></td></tr>`;});
  h+='</tbody>';$('#queueTable').innerHTML=h;
  $('#qCount').textContent=`พบ ${fmt(list.length)} ราย`;
  $('#queueTable').querySelectorAll('[data-edit]').forEach(a=>a.onclick=()=>openCustModal(+a.dataset.edit));
  pager($('#queuePager'),pages,queuePage,p=>{queuePage=p;renderQueue();});
}

// callbacks
function renderCallbacks(){
  const today=new Date(DATA_MAX);
  const list=roleScope(D.customers).map(c=>({c,dt:pdate(c.next)})).filter(x=>x.dt).sort((a,b)=>a.dt-b.dt);
  let due=0;
  let h='<thead><tr><th>นัดวันที่</th><th>สถานะนัด</th><th>แบรนด์</th><th>ชื่อ</th><th>เบอร์โทร</th><th>ผลการโทรล่าสุด</th><th>จัดการ</th></tr></thead><tbody>';
  list.forEach(x=>{const overdue=x.dt.getTime()<DATA_MAX,isToday=x.dt.getTime()===DATA_MAX;if(overdue||isToday)due++;
    const tag=overdue?'<span class="tag" style="background:rgba(239,68,68,.18);color:#fca5a5">เลยกำหนด</span>':isToday?'<span class="tag" style="background:rgba(245,158,11,.2);color:#fcd34d">ครบกำหนด</span>':'<span class="tag" style="background:rgba(59,130,246,.15);color:#60a5fa">รออยู่</span>';
    h+=`<tr><td>${esc(x.c.next)}</td><td>${tag}</td><td>${esc(x.c.b)}</td><td>${esc(cname(x.c)||'-')}</td><td>${esc(x.c.p||'-')}</td><td>${esc(x.c.r||'-')}</td><td><span class="act-link" data-edit="${D.customers.indexOf(x.c)}">แก้ไข</span></td></tr>`;});
  h+='</tbody>';$('#cbTable').innerHTML=list.length?h:'<tbody><tr><td>ยังไม่มีรายการนัดโทรกลับ — ตั้งได้ที่หน้าแก้ไขลูกค้า</td></tr></tbody>';
  $('#cbToday').textContent=list.length?`${due} รายการครบ/เลยกำหนด`:'';
  $('#cbTable').querySelectorAll('[data-edit]').forEach(a=>a.onclick=()=>openCustModal(+a.dataset.edit));
}

// customers
const PAGE=50;let custPage=0;
function populateFilters(){
  const bs=[...new Set(D.customers.map(c=>c.b))];
  const opts='<option value="">ทุกแบรนด์</option>'+bs.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');
  $('#filterBrand').innerHTML=opts; $('#smsBrand').innerHTML=opts;
  const rs=[...new Set(D.customers.map(c=>c.r).filter(Boolean))].sort();
  $('#filterResult').innerHTML='<option value="">ทุกผลการโทร</option>'+rs.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
  $('#resultOptions').innerHTML=[...new Set([...rs,...Object.keys(D.resultBreakdown||{})])].map(r=>`<option value="${esc(r)}">`).join('');
}
function custFiltered(){
  const q=$('#searchInput').value.trim().toLowerCase(),qd=q.replace(/\D/g,''),fb=$('#filterBrand').value,fr=$('#filterResult').value,fret=$('#filterRet').value;
  return roleScope(D.customers).filter(c=>{
    if(q){const nm=cname(c).toLowerCase();const ph=String(c.p||'').replace(/\D/g,'');const hit=(nm&&nm.includes(q))||(qd&&ph.includes(qd))||(c.surname||'').toLowerCase().includes(q)||(c.name||'').toLowerCase().includes(q);if(!hit)return false;}
    if(fb&&c.b!==fb)return false;
    if(fr&&c.r!==fr)return false;
    if(fret==='dnc'){if(!c.dnc)return false;}
    else if(fret!==''){if(String((Number(c.dep)||0)>0?1:0)!==fret)return false;}
    return true;
  });
}
function renderCustomers(){
  const list=custFiltered(),pages=Math.max(1,Math.ceil(list.length/PAGE));if(custPage>=pages)custPage=0;
  const slice=list.slice(custPage*PAGE,custPage*PAGE+PAGE);
  let h='<thead><tr><th>แบรนด์</th><th>ชื่อ-นามสกุล</th><th>เบอร์โทร</th><th>วันที่</th><th>ผลการโทร</th><th>พนักงาน</th><th class="num">ยอดฝากกลับ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>';
  slice.forEach(c=>{const idx=D.customers.indexOf(c);const ret=(Number(c.dep)||0)>0;
    h+=`<tr><td>${esc(c.b)}</td><td>${esc(cname(c)||'-')}</td><td>${esc(c.p||'-')}</td><td>${esc(c.d||'-')}</td><td>${c.r?`<span class="tag res">${esc(c.r)}</span>`:'-'}</td><td>${esc(c.caller||'-')}</td><td class="num">${c.dep?'฿'+fmt(c.dep):'-'}</td><td>${c.dnc?'<span class="tag" style="background:rgba(239,68,68,.18);color:#fca5a5">ห้ามโทร</span>':(ret?'<span class="tag ok">กลับมาฝาก</span>':'<span class="tag no">รอติดตาม</span>')}</td><td><span class="act-link" data-edit="${idx}">แก้ไข</span></td></tr>`;});
  h+='</tbody>';$('#custTable').innerHTML=h;
  $('#custCount').textContent=`พบ ${fmt(list.length)} ราย`+(list.length>PAGE?` · หน้า ${custPage+1}/${pages}`:'');
  $('#custTable').querySelectorAll('[data-edit]').forEach(a=>a.onclick=()=>openCustModal(+a.dataset.edit));
  pager($('#pager'),pages,custPage,p=>{custPage=p;renderCustomers();});
}
function pager(node,pages,cur,go){node.innerHTML='';if(pages<=1)return;const p=el('button',null,'‹ ก่อนหน้า');p.disabled=cur===0;p.onclick=()=>go(cur-1);const n=el('button',null,'ถัดไป ›');n.disabled=cur>=pages-1;n.onclick=()=>go(cur+1);node.append(p,el('span','pinfo',`หน้า ${cur+1}/${pages}`),n);}

// reports (weekly/monthly)
let repMode='week';
function reportData(mode){
  const m=new Map();
  D.customers.forEach(c=>{const dt=pdate(c.d);let key,lbl;
    if(!dt){key='ไม่ระบุ';lbl='ไม่ระบุวันที่';}
    else if(mode==='week'){const mon=new Date(dt);mon.setUTCDate(dt.getUTCDate()-((dt.getUTCDay()+6)%7));key=mon.getTime();lbl=`สัปดาห์ ${String(mon.getUTCDate()).padStart(2,'0')}/${String(mon.getUTCMonth()+1).padStart(2,'0')}`;}
    else {key=dt.getUTCFullYear()+'-'+(dt.getUTCMonth()+1);lbl=thMonths[dt.getUTCMonth()+1]+' '+dt.getUTCFullYear();}
    let g=m.get(key);if(!g){g={key,lbl,sort:dt?dt.getTime():0,calls:0,ans:0,noans:0,sms:0,ret:0,dep:0,bonus:0};m.set(key,g);}
    g.calls+=(c.a?1:0)+(c.na?1:0);g.ans+=c.a?1:0;g.noans+=c.na?1:0;g.sms+=c.sm?1:0;g.ret+=(Number(c.dep)||0)>0?1:0;g.dep+=Number(c.dep)||0;g.bonus+=Number(c.bn)||0;});
  return [...m.values()].sort((a,b)=>a.sort-b.sort).map(g=>({...g,dep:r2(g.dep),bonus:r2(g.bonus),pctAns:g.calls?Math.round(g.ans/g.calls*1000)/10:0,pctNoAns:g.calls?Math.round(g.noans/g.calls*1000)/10:0,bonusPct:g.dep?Math.round(g.bonus/g.dep*1000)/10:0,roi:g.bonus?Math.round(g.dep/g.bonus*10)/10:0}));
}
function renderReports(){
  const rows=reportData(repMode);
  let h=`<div class="table-wrap"><table class="data-table"><thead><tr><th>${repMode==='week'?'สัปดาห์':'เดือน'}</th><th class="num">โทร</th><th class="num">รับสาย</th><th class="num">รับสาย%</th><th class="num">ไม่รับ</th><th class="num">ไม่รับ%</th><th class="num">SMS</th><th class="num">กลับมาฝาก</th><th class="num">ยอดฝากกลับ</th><th class="num">โบนัส</th><th class="num">โบนัส/ยอดฝาก%</th><th class="num">ROI</th></tr></thead><tbody>`;
  rows.forEach(r=>h+=`<tr><td>${esc(r.lbl)}</td><td class="num">${fmt(r.calls)}</td><td class="num">${fmt(r.ans)}</td><td class="num">${r.pctAns}%</td><td class="num">${fmt(r.noans)}</td><td class="num">${r.pctNoAns}%</td><td class="num">${fmt(r.sms)}</td><td class="num">${fmt(r.ret)}</td><td class="num">฿${fmt(r.dep)}</td><td class="num">฿${fmt(r.bonus)}</td><td class="num">${r.bonusPct}%</td><td class="num">${r.roi}x</td></tr>`);
  h+='</tbody></table></div>';$('#reportBody').innerHTML=h;
}

// audit
function renderAudit(){
  const q=($('#auditSearch')?$('#auditSearch').value:'').trim().toLowerCase();
  let a=getAudit(); if(q)a=a.filter(x=>(x.user+x.action+x.detail).toLowerCase().includes(q));
  let h='<thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead><tbody>';
  a.slice(0,500).forEach(x=>h+=`<tr><td>${esc(x.ts)}</td><td>${esc(x.user)}</td><td><span class="tag res">${esc(x.action)}</span></td><td>${esc(x.detail)}</td></tr>`);
  h+='</tbody>';$('#auditTable').innerHTML=h;
  $('#auditCount').textContent=`${fmt(a.length)} รายการ`;
}

/* =====================================================================
   EXPORT (CSV / Excel)
   ===================================================================== */
function dl(fn,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function csvCell(v){const s=String(v==null?'':v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function exportCSV(fn,headers,rows){const lines=[headers.join(',')];rows.forEach(r=>lines.push(r.map(csvCell).join(',')));dl(fn,new Blob([new Uint8Array([0xEF,0xBB,0xBF]),lines.join('\n')],{type:'text/csv;charset=utf-8'}));}
function exportExcel(fn,title,headers,rows){
  let h='<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1" cellspacing="0">';
  h+=`<tr><th colspan="${headers.length}" style="background:#1f4e79;color:#fff;font-size:14px">${esc(title)}</th></tr>`;
  h+='<tr>'+headers.map(x=>`<th style="background:#d9e1f2">${esc(x)}</th>`).join('')+'</tr>';
  rows.forEach(r=>h+='<tr>'+r.map(c=>`<td>${esc(c)}</td>`).join('')+'</tr>');
  h+='</table></body></html>';
  dl(fn,new Blob(['﻿'+h],{type:'application/vnd.ms-excel'}));
}
function custExportRows(list){return list.map(c=>[c.b,cname(c),c.p,c.d,c.t,c.a,c.na,c.sm,c.r,c.dep,c.bn,c.lg,c.caller,c.reason,c.next,c.dnc?'ห้ามโทร':'',c.note]);}
const CUST_HEADERS=['brand','name','phone','date','time','answered','noanswer','sms','result','deposit','bonus','logindays','caller','reason','callback','dnc','note'];

/* =====================================================================
   NAVIGATION + PRINT + RANGE
   ===================================================================== */
const titles={overview:'แดชบอร์ด',results:'สรุปผลการโทร',trend:'แนวโน้มรายวัน',brands:'เปรียบเทียบรายแบรนด์',months:'เปรียบเทียบรายเดือน',agents:'ผลงานพนักงาน',cohort:'วิเคราะห์กลุ่มลูกค้า',queue:'คิวโทรติดตาม',callbacks:'นัดหมายโทรกลับ',customers:'รายชื่อลูกค้า',sms:'ข้อความ SMS',reports:'รายงาน',import:'นำเข้าข้อมูล',notifications:'การแจ้งเตือน Telegram',audit:'ประวัติการใช้งาน',admins:'การจัดการแอดมิน',settings:'ตั้งค่าระบบ'};
const subs={overview:'ภาพรวมผลการโทรติดตาม',results:'การกระจายผลการโทร',trend:'แนวโน้มยอดฝากกลับรายวัน',brands:'เปรียบเทียบผลงานแต่ละแบรนด์',months:'เปรียบเทียบผลงานรายเดือน',agents:'ผลงานรายพนักงาน',cohort:'วิเคราะห์กลุ่มลูกค้าและความคุ้มค่าโปรโมชั่น',queue:'คิวโทรติดตามพร้อมตัวกรอง',callbacks:'รายการนัดหมายโทรกลับ',customers:'ฐานข้อมูลลูกค้าทั้งหมด',sms:'คลังข้อความและการส่ง SMS',reports:'รายงานรายสัปดาห์และรายเดือน',import:'นำเข้าและส่งออกข้อมูล',notifications:'การแจ้งเตือนผ่าน Telegram',audit:'บันทึกประวัติการใช้งานระบบ',admins:'เพิ่ม/ลบผู้ใช้ และกำหนดสิทธิ์เข้าถึง',settings:'ตั้งค่าระบบและเปลี่ยนรหัสผ่าน'};
const RANGE_VIEWS=['overview','results','trend','brands'];
// สิทธิ์ขั้นต่ำต่อหน้า (ROLE_LEVEL: ADMIN/พนักงานโทร < HEAD/หัวหน้า < MANAGER/ผู้จัดการ)
const ROLE_LEVEL={ADMIN:1,HEAD:2,MANAGER:3};
const VIEW_MIN={overview:1,queue:1,callbacks:1,customers:1,sms:1,settings:1,
  results:2,trend:2,brands:2,months:2,agents:2,cohort:2,reports:2,import:2,notifications:2,admins:2,
  audit:3};
const ALL_VIEWS=['overview','results','trend','brands','months','agents','cohort','queue','callbacks','customers','sms','reports','import','notifications','admins','audit','settings'];
// สิทธิ์เริ่มต้นตามบทบาท (ใช้เมื่อไม่ได้กำหนดสิทธิ์รายคน)
function roleDefaultViews(role){const lv=ROLE_LEVEL[role]||1;return ALL_VIEWS.filter(v=>(VIEW_MIN[v]||1)<=lv);}
function applyRoleGating(role){
  // ใช้สิทธิ์รายคน (window.CRM_ALLOWED) ถ้ามี — ไม่งั้นใช้สิทธิ์เริ่มต้นของบทบาท
  const allowed=window.CRM_ALLOWED instanceof Set?window.CRM_ALLOWED:new Set(roleDefaultViews(role));
  $$('.nav-item').forEach(a=>{a.style.display=allowed.has(a.dataset.view)?'':'none';});
  // ซ่อนทั้งกลุ่มถ้าไม่มีเมนูที่มองเห็น
  $$('.nav-group').forEach(g=>{const any=Array.from(g.querySelectorAll('.nav-item')).some(a=>a.style.display!=='none');g.style.display=any?'':'none';});
  // ถ้าหน้าที่เปิดอยู่ไม่มีสิทธิ์ ให้เด้งกลับแดชบอร์ด
  const open=$$('.view:not(.hidden)')[0];
  if(open){const v=open.id.replace('view-','');if(!allowed.has(v)){const ov=$('.nav-item[data-view="overview"]');if(ov)ov.click();}}
}
// agent เห็นเฉพาะงานของตัวเอง (caller = ชื่อผู้ใช้)
function isAgent(){return window.CRM_ROLE==='ADMIN';}
function roleScope(list){ if(!isAgent())return list; const me=window.CRM_USERNAME||''; return list.filter(c=>(c.caller||'')===me); }
$$('.nav-item').forEach(a=>a.addEventListener('click',e=>{
  e.preventDefault();const v=a.dataset.view;
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x===a));
  $$('.view').forEach(s=>s.classList.add('hidden'));
  $('#view-'+v).classList.remove('hidden');
  $('#pageTitle').textContent=titles[v];$('#pageSub').textContent=subs[v]||'';
  $('#rangeBar').style.display=RANGE_VIEWS.includes(v)?'':'none';
  const sub=a.parentElement;if(sub&&sub.classList&&sub.classList.contains('nav-sub'))sub.parentElement.classList.add('open');
  document.body.classList.remove('nav-open');
  window.scrollTo(0,0);
}));
$('#navToggle')&&$('#navToggle').addEventListener('click',()=>document.body.classList.toggle('nav-open'));
$('#navBackdrop')&&$('#navBackdrop').addEventListener('click',()=>document.body.classList.remove('nav-open'));
// พับ/กางหมวด (accordion)
$$('.nav-cat').forEach(b=>b.addEventListener('click',()=>{const w=b.parentElement;w.classList.toggle('open');}));
// ใส่เลขข้อ/ข้อย่อยอัตโนมัติ (ข้ามรายการที่ถูกซ่อนตามสิทธิ์)
function renumberNav(){let cn=0;$$('.nav-cat-wrap').forEach(w=>{if(w.style.display==='none')return;cn++;const num=w.querySelector('.nav-num');if(num)num.textContent=cn;let sn=0;Array.from(w.querySelectorAll('.nav-item')).forEach(it=>{if(it.style.display==='none')return;sn++;const s=it.querySelector('.sub-num');if(s)s.textContent=cn+'.'+sn;});});}
// เปิดหมวดของเมนูที่ถูกเลือก
function openActiveCat(){const act=$('.nav-item.active');if(act&&act.parentElement&&act.parentElement.classList.contains('nav-sub'))act.parentElement.parentElement.classList.add('open');}
$('#btnPrint').addEventListener('click',()=>window.print());
$('#btnPrint2')&&$('#btnPrint2').addEventListener('click',()=>window.print());

// range control
function setRange(mode){RANGE.mode=mode;$$('#rangeSeg .seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.range===mode));$('#rangeCustom').classList.toggle('hidden',mode!=='custom');if(mode!=='custom')renderAll();}
$$('#rangeSeg .seg-btn').forEach(b=>b.addEventListener('click',()=>setRange(b.dataset.range)));
$('#rangeApply').addEventListener('click',()=>{RANGE.from=$('#rangeFrom').value;RANGE.to=$('#rangeTo').value;renderAll();});

// trend toggle
$$('#view-trend .tg-btn').forEach(b=>b.addEventListener('click',()=>{$$('#view-trend .tg-btn').forEach(x=>x.classList.toggle('active',x===b));trendMetric=b.dataset.metric;renderTrend();}));
// reports toggle
$$('#view-reports .tg-btn').forEach(b=>b.addEventListener('click',()=>{$$('#view-reports .tg-btn').forEach(x=>x.classList.toggle('active',x===b));repMode=b.dataset.rep;renderReports();}));

// customer filters / search
['#searchInput','#filterBrand','#filterResult','#filterRet'].forEach(s=>$(s).addEventListener('input',()=>{custPage=0;renderCustomers();}));
$('#btnExportCust').addEventListener('click',()=>{const list=custFiltered();exportCSV('customers_'+D.generated+'.csv',CUST_HEADERS,custExportRows(list));logAudit('Export CSV','รายชื่อลูกค้า '+list.length+' ราย');});
$('#auditSearch')&&$('#auditSearch').addEventListener('input',renderAudit);

// queue actions
$('#qSearch').addEventListener('click',()=>{queuePage=0;renderQueue();});
$('#qExport').addEventListener('click',()=>{const list=queueFiltered();exportExcel('call_queue.xls','คิวโทร ('+list.length+' ราย)',['แบรนด์','ชื่อ','เบอร์โทร','ผลการโทร','login','นัดโทร','ยอดฝากกลับ'],list.map(c=>[c.b,cname(c),c.p,c.r,c.lg,c.next,c.dep]));logAudit('Export Excel','คิวโทร '+list.length+' ราย');});
$('#qCsv').addEventListener('click',()=>{const list=queueFiltered();exportCSV('call_queue.csv',CUST_HEADERS,custExportRows(list));});
$$('#qResults,#qBrands').forEach(()=>{});

// agents export
$('#btnAgentXls').addEventListener('click',()=>{const r=agentRows();exportExcel('agent_performance.xls','ผลงานพนักงาน',['พนักงาน','งานทั้งหมด','รับสาย','รับสาย%','ส่ง SMS','เสนอโปร 20%','ดึงกลับได้','%สำเร็จ','ยอดฝากกลับ'],r.map(a=>[a.caller,a.total,a.ans,a.pctAns+'%',a.sms,a.promo,a.ret,a.pctRet+'%',a.dep]));logAudit('Export Excel','ผลงานพนักงาน');});

// reports export
$('#repXls').addEventListener('click',()=>{const r=reportData(repMode);exportExcel('report_'+repMode+'.xls','รายงาน'+(repMode==='week'?'รายสัปดาห์':'รายเดือน'),[repMode==='week'?'สัปดาห์':'เดือน','โทร','รับสาย','รับสาย%','ไม่รับ','ไม่รับ%','SMS','กลับมาฝาก','ยอดฝากกลับ','โบนัส','โบนัส/ยอดฝาก%','ROI'],r.map(x=>[x.lbl,x.calls,x.ans,x.pctAns+'%',x.noans,x.pctNoAns+'%',x.sms,x.ret,x.dep,x.bonus,x.bonusPct+'%',x.roi+'x']));logAudit('Export Excel','รายงาน'+repMode);});
$('#repCsv').addEventListener('click',()=>{const r=reportData(repMode);exportCSV('report_'+repMode+'.csv',['period','calls','answered','pctAns','noanswer','pctNoAns','sms','returned','deposit','bonus','bonusPct','roi'],r.map(x=>[x.lbl,x.calls,x.ans,x.pctAns,x.noans,x.pctNoAns,x.sms,x.ret,x.dep,x.bonus,x.bonusPct,x.roi]));});

// audit export/clear
$('#auditXls').addEventListener('click',()=>{exportExcel('audit_log.xls','Audit Log',['เวลา','ผู้ใช้','การกระทำ','รายละเอียด'],getAudit().map(x=>[x.ts,x.user,x.action,x.detail]));});
$('#auditClear').addEventListener('click',()=>{if(confirm('ล้าง Audit Log ทั้งหมด?')){localStorage.removeItem(AUDIT_KEY);logAudit('ล้าง Log','เริ่มบันทึกใหม่');renderAudit();}});

/* =====================================================================
   CUSTOMER MODAL
   ===================================================================== */
let editIdx=-1;
function openCustModal(idx){
  editIdx=idx;
  const c=idx>=0?D.customers[idx]:{b:'',p:'',name:'',surname:'',d:'',t:'',r:'',dep:0,bn:0,lg:0,a:0,na:0,sm:0,caller:'',reason:'',next:'',note:'',dnc:0};
  $('#custModalTitle').textContent=idx>=0?'แก้ไขลูกค้า / Edit':'เพิ่มลูกค้าใหม่ / Add';
  const set=(id,v)=>$(id).value=v==null?'':v;
  set('#m_name',c.name);set('#m_surname',c.surname);set('#m_b',c.b);set('#m_p',c.p);set('#m_d',c.d);set('#m_t',c.t);
  set('#m_r',c.r);set('#m_dep',c.dep||0);set('#m_bn',c.bn||0);set('#m_lg',c.lg||0);set('#m_caller',c.caller);set('#m_reason',c.reason);set('#m_next',c.next);set('#m_note',c.note);
  $('#m_a').value=c.a?'1':'0';$('#m_dnc').checked=!!c.dnc;
  $('#m_dncReason').value='';$('#m_dncReasonWrap').style.display=c.dnc?'none':'none';
  // ประวัติเปลี่ยนสถานะ (ข้อ 7)
  const log=c.statusLog||[];
  $('#m_statusHistory').innerHTML=log.length?`<div class="status-hist"><b>ประวัติเปลี่ยนสถานะ</b>${log.slice().reverse().map(h=>`<div class="sh-row">${esc(h.ts)} · ${esc(h.user)} : ${esc(h.from)} → <b>${esc(h.to)}</b>${h.reason?' ('+esc(h.reason)+')':''}</div>`).join('')}</div>`:'';
  // ส่ง SMS (ข้อ 11)
  const tpls=window._smsTemplates?window._smsTemplates():[];
  $('#m_smsTpl').innerHTML=tpls.length?tpls.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join(''):'<option value="">— ยังไม่มีข้อความ (เพิ่มที่เมนูข้อความ SMS) —</option>';
  $('#m_smsSent').checked=!!c.sm; updateMsPreview();
  $('#custDelete').style.display=idx>=0?'':'none';$('#custError').classList.add('hidden');
  $('#custModal').classList.remove('hidden');
}
function updateMsPreview(){
  const tpls=window._smsTemplates?window._smsTemplates():[];
  const t=tpls.find(x=>String(x.id)===$('#m_smsTpl').value);
  const cobj={name:$('#m_name').value,surname:$('#m_surname').value,b:$('#m_b').value,p:$('#m_p').value};
  $('#m_smsPreview').textContent=t?(window._smsFill?window._smsFill(t.text,cobj):t.text):'—';
}
$('#m_smsTpl')&&$('#m_smsTpl').addEventListener('change',updateMsPreview);
$('#m_smsCopy')&&$('#m_smsCopy').addEventListener('click',()=>{
  const txt=$('#m_smsPreview').textContent; if(!txt||txt==='—')return;
  const done=()=>{$('#m_smsSent').checked=true;const b=$('#m_smsCopy'),o=b.textContent;b.textContent='✓ คัดลอกแล้ว · ติ๊กส่ง SMS ให้แล้ว';setTimeout(()=>b.textContent=o,1800);};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(()=>{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}ta.remove();done();});}
  else{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}ta.remove();done();}
});
$('#m_dnc')&&$('#m_dnc').addEventListener('change',function(){const was=editIdx>=0?!!D.customers[editIdx].dnc:false;$('#m_dncReasonWrap').style.display=(this.checked&&!was)?'':'none';});
function closeCustModal(){$('#custModal').classList.add('hidden');editIdx=-1;}
$('#custClose').onclick=closeCustModal;$('#custCancel').onclick=closeCustModal;
$('#custModal').addEventListener('click',e=>{if(e.target===$('#custModal'))closeCustModal();});
$('#custForm').addEventListener('submit',e=>{
  e.preventDefault();
  const b=$('#m_b').value.trim(),p=$('#m_p').value.trim();
  if(!b&&!p){$('#custError').innerHTML='ต้องมีแบรนด์หรือเบอร์โทร<span class="en">Brand or phone required</span>';$('#custError').classList.remove('hidden');return;}
  const a=$('#m_a').value==='1'?1:0;
  const rec={b,p,name:$('#m_name').value.trim(),surname:$('#m_surname').value.trim(),d:$('#m_d').value.trim(),t:$('#m_t').value.trim(),a,na:a?0:1,sm:$('#m_smsSent').checked?1:0,r:normResult($('#m_r').value.trim()),dep:r2($('#m_dep').value),bn:r2($('#m_bn').value),lg:parseInt($('#m_lg').value)||0,caller:$('#m_caller').value.trim(),reason:$('#m_reason').value.trim(),next:$('#m_next').value.trim(),note:$('#m_note').value.trim(),dnc:$('#m_dnc').checked?1:0};
  rec.ret=rec.dep>0?1:0;
  const old=editIdx>=0?D.customers[editIdx]:null;
  const prevDep=old?(Number(old.dep)||0):0, prevBn=old?(Number(old.bn)||0):0, prevDnc=old?!!old.dnc:false;
  // ข้อ 7: เปลี่ยนเป็นห้ามโทร ต้องมีเหตุผล + บันทึกประวัติ
  rec.statusLog=(old&&old.statusLog)?old.statusLog.slice():[];
  if(rec.dnc&&!prevDnc){
    const reason=$('#m_dncReason').value.trim();
    if(!reason){$('#custError').innerHTML='ต้องกรอกเหตุผลเมื่อตั้งห้ามโทร<span class="en">Reason required to set Do-Not-Call</span>';$('#custError').classList.remove('hidden');return;}
    rec.statusLog.push({ts:new Date().toLocaleString('th-TH'),user:window.CRM_USER||'-',from:'ปกติ',to:'ห้ามโทร',reason});
  } else if(!rec.dnc&&prevDnc){
    rec.statusLog.push({ts:new Date().toLocaleString('th-TH'),user:window.CRM_USER||'-',from:'ห้ามโทร',to:'ปกติ',reason:''});
  }
  if(old){D.customers[editIdx]=Object.assign(old,rec);logAudit('แก้ไขลูกค้า',`${rec.b} ${rec.p}`);}
  else {D.customers.unshift(rec);logAudit('เพิ่มลูกค้า',`${rec.b} ${rec.p}`);}
  // ข้อ 12: trigger Telegram
  if(window.tgNotify){
    const mask=String(rec.p||'').replace(/(\d{3})\d+(\d{4})/,'$1-xxx-$2');
    if(rec.dep>prevDep && rec.dep>=window.tgBig()) window.tgNotify('bigDeposit',`💰 <b>ยอดฝากใหญ่</b>\nเว็บ: ${rec.b}\nเบอร์: ${mask}\nยอด: ฿${fmt(rec.dep)}\nบันทึกโดย: ${window.CRM_USER||'-'}`,'team');
    if(rec.bn>prevBn) window.tgNotify('bonus',`🎁 <b>ปรับโบนัส</b>\nเว็บ: ${rec.b} / ${mask}\nโบนัส: ฿${fmt(rec.bn)}\nโดย: ${window.CRM_USER||'-'}`,'boss');
    if(rec.dnc&&!prevDnc) window.tgNotify('dnc',`🚫 <b>ตั้งห้ามโทร</b>\nเว็บ: ${rec.b} / ${mask}\nโดย: ${window.CRM_USER||'-'}`,'boss');
  }
  closeCustModal();applyChanges();
});
$('#custDelete').addEventListener('click',()=>{if(editIdx<0)return;if(confirm('ลบลูกค้ารายนี้?')){const c=D.customers[editIdx];logAudit('ลบลูกค้า',`${c.b} ${c.p}`);D.customers.splice(editIdx,1);closeCustModal();applyChanges();}});
$('#btnAddCust').addEventListener('click',()=>openCustModal(-1));

/* =====================================================================
   AUTH (multi-user + roles)
   ===================================================================== */
(function(){
  function hash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16);}
  // ลำดับสิทธิ์: ผู้จัดการ(สูงสุด) > หัวหน้าทีม > พนักงานโทร
  const ROLE_LABELS={MANAGER:'ผู้จัดการ',HEAD:'หัวหน้าทีม',ADMIN:'พนักงานโทร'};
  const ROLE_RANK={ADMIN:1,HEAD:2,MANAGER:3};
  function normRole(r){const x=String(r||'').toUpperCase();if(x==='MANAGER')return 'MANAGER';if(x==='HEAD'||x==='SUPERVISOR')return 'HEAD';return 'ADMIN';}
  function badgeClass(role){return role==='MANAGER'?'manager':role==='HEAD'?'admin':'agent';}
  function getUsers(){
    let u;try{u=JSON.parse(localStorage.getItem(USERS_KEY));}catch(e){}
    if(!Array.isArray(u)||!u.length){
      u=[{user:'manager',hash:hash('manager1234'),role:'MANAGER',changed:null},
         {user:'head1',hash:hash('head1234'),role:'HEAD',changed:null},
         {user:'admin',hash:hash('admin1234'),role:'ADMIN',changed:null}];
    }
    u.forEach(x=>x.role=normRole(x.role));
    localStorage.setItem(USERS_KEY,JSON.stringify(u));
    return u;
  }
  function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u));}
  function al(node,th,en,show=true){if(!show){node.classList.add('hidden');node.innerHTML='';return;}node.innerHTML=`${th}<span class="en">${en}</span>`;node.classList.remove('hidden');}
  let cur=null;const overlay=$('#loginOverlay');
  getUsers();$('#loginHint').innerHTML='ทดสอบ: <b>manager/manager1234</b> · <b>head1/head1234</b> · <b>admin/admin1234</b>';
  function rec(){return getUsers().find(u=>u.user===cur);}
  function computeAllowed(r){
    if(r.role==='MANAGER')return new Set(ALL_VIEWS);
    const base=Array.isArray(r.views)?r.views.slice():roleDefaultViews(r.role);
    base.push('overview','settings'); // เข้าแดชบอร์ดและตั้งค่า(เปลี่ยนรหัส)ได้เสมอ
    return new Set(base);
  }
  function refresh(){const r=rec();if(!r)return;$('#userName').textContent=r.user;$('#userAvatar').textContent=(r.user[0]||'A').toUpperCase();$('#userRole').innerHTML=ROLE_LABELS[r.role]+`<span class="role-pill ${badgeClass(r.role)}">${r.role}</span>`;window.CRM_ROLE=r.role;window.CRM_USERNAME=r.user;window.CRM_ALLOWED=computeAllowed(r);applyRoleGating(r.role);renderUsers();}
  function showApp(){overlay.classList.add('hidden');window.CRM_USER=cur;refresh();if(typeof renderAll==='function')renderAll();}
  function showLogin(){overlay.classList.remove('hidden');$('#loginPass').value='';}
  const ses=sessionStorage.getItem(SES_KEY);
  if(ses&&getUsers().some(u=>u.user===ses)){cur=ses;showApp();}else showLogin();
  $('#loginForm').addEventListener('submit',e=>{e.preventDefault();const u=$('#loginUser').value.trim(),p=$('#loginPass').value;if(!u||!p)return al($('#loginAlert'),'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน','Please enter username and password');const r=getUsers().find(x=>x.user===u);if(!r||hash(p)!==r.hash)return al($('#loginAlert'),'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง','Invalid username or password');al($('#loginAlert'),'','',false);cur=u;sessionStorage.setItem(SES_KEY,u);showApp();logAudit('เข้าสู่ระบบ','');});
  $('#logoutBtn').addEventListener('click',()=>{logAudit('ออกจากระบบ','');sessionStorage.removeItem(SES_KEY);cur=null;window.CRM_USER=null;showLogin();});
  ['#loginUser','#loginPass'].forEach(s=>$(s).addEventListener('input',()=>al($('#loginAlert'),'','',false)));
  $('#pwForm').addEventListener('submit',e=>{e.preventDefault();al($('#pwSuccess'),'','',false);const users=getUsers(),r=users.find(u=>u.user===cur),E=$('#pwError');const c=$('#curPass').value,np=$('#newPass').value,cf=$('#confirmPass').value;
    if(!c)return al(E,'กรุณากรอกรหัสผ่านเดิม','Please enter your current password');
    if(hash(c)!==r.hash)return al(E,'รหัสผ่านเดิมไม่ถูกต้อง','Current password is incorrect');
    if(!np)return al(E,'กรุณากรอกรหัสผ่านใหม่','Please enter a new password');
    if(np.length<6)return al(E,'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร','New password must be at least 6 characters');
    if(np===c)return al(E,'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม','New password must be different from the current one');
    if(np!==cf)return al(E,'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน','New password and confirmation do not match');
    r.hash=hash(np);r.changed=new Date().toLocaleString('th-TH');saveUsers(users);al(E,'','',false);al($('#pwSuccess'),'เปลี่ยนรหัสผ่านสำเร็จ','Password changed successfully');$('#pwForm').reset();logAudit('เปลี่ยนรหัสผ่าน','');});
  ['#curPass','#newPass','#confirmPass'].forEach(s=>$(s).addEventListener('input',()=>al($('#pwError'),'','',false)));
  // ---- ตัวเลือกสิทธิ์เข้าถึงเมนูรายคน ----
  const PERM_VIEWS=ALL_VIEWS.filter(v=>v!=='overview'&&v!=='settings');
  function permLabel(v){return (typeof titles!=='undefined'&&titles[v])||v;}
  function renderPermChecks(container,checkedSet){container.innerHTML=PERM_VIEWS.map(v=>`<label><input type="checkbox" class="permChk" value="${esc(v)}" ${checkedSet.has(v)?'checked':''}> ${esc(permLabel(v))}</label>`).join('');}
  function updateAuPerm(){const role=normRole($('#auRole').value);if(role==='MANAGER'){$('#auPermBox').style.display='none';}else{$('#auPermBox').style.display='';renderPermChecks($('#auViews'),new Set(roleDefaultViews(role)));}}
  $('#auRole').addEventListener('change',updateAuPerm);
  function openPermEditor(username){
    const users=getUsers(),u=users.find(x=>x.user===username);if(!u)return;
    const cs=new Set(Array.isArray(u.views)?u.views:roleDefaultViews(u.role));
    const box=$('#permEditor');
    box.innerHTML=`<div class="pe-head">กำหนดสิทธิ์เข้าถึงเมนู: <b>${esc(u.user)}</b> (${ROLE_LABELS[u.role]})</div><div class="perm-grid" id="peViews"></div><div class="pe-actions"><button class="btn-primary" id="peSave">บันทึกสิทธิ์</button><button class="btn-ghost" id="peCancel">ยกเลิก</button></div><div class="muted" style="margin-top:8px">แดชบอร์ดและตั้งค่าเข้าได้เสมอ</div>`;
    renderPermChecks($('#peViews'),cs);
    $('#peCancel').onclick=()=>{box.innerHTML='';};
    $('#peSave').onclick=()=>{u.views=$$('#peViews .permChk:checked').map(c=>c.value);saveUsers(users);logAudit('แก้สิทธิ์ผู้ใช้',u.user+' ('+u.views.length+' เมนู)');box.innerHTML='';renderUsers();if(u.user===cur){window.CRM_ALLOWED=computeAllowed(u);applyRoleGating(u.role);}};
  }
  function renderUsers(){
    const r=rec(),myRank=ROLE_RANK[r?r.role:'ADMIN']||1,canManage=myRank>=2;
    if(!canManage){$('#usersList').innerHTML='<div class="locked-note">🔒 เฉพาะผู้จัดการหรือหัวหน้าทีมเท่านั้นที่จัดการผู้ใช้ได้</div>';$('#addUserForm').style.display='none';return;}
    $('#addUserForm').style.display='';
    // หัวหน้าทีมเพิ่มได้เฉพาะพนักงานโทร · ผู้จัดการเพิ่มได้ทุกระดับ
    const opts=myRank>=3?[['MANAGER','ผู้จัดการ / Manager'],['HEAD','หัวหน้าทีม / Head'],['ADMIN','พนักงานโทร / Agent']]:[['ADMIN','พนักงานโทร / Agent']];
    $('#auRole').innerHTML=opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('');
    const users=getUsers();
    $('#usersList').innerHTML=users.map(u=>{
      const canDel=u.user!==cur&&(myRank>=3||(myRank>=2&&u.role==='ADMIN'));
      const canEdit=u.role!=='MANAGER'&&(myRank>=3||(myRank>=2&&u.role==='ADMIN'));
      const editBtn=canEdit?`<button class="ur-edit" data-perm="${esc(u.user)}">แก้สิทธิ์</button>`:'';
      const delBtn=u.user===cur?'<span class="muted" style="font-size:11px">(คุณ)</span>':(canDel?`<button class="ur-del" data-del="${esc(u.user)}" title="ลบผู้ใช้">🗑️</button>`:'');
      return `<div class="user-row"><div class="ur-av">${(u.user[0]||'?').toUpperCase()}</div><div class="ur-name">${esc(u.user)}</div><span class="role-badge ${badgeClass(u.role)}">${ROLE_LABELS[u.role]}</span>${editBtn}${delBtn}</div>`;
    }).join('');
    $('#usersList').querySelectorAll('[data-perm]').forEach(b=>b.onclick=()=>openPermEditor(b.dataset.perm));
    $('#usersList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(confirm('ลบผู้ใช้ '+b.dataset.del+'?')){saveUsers(getUsers().filter(x=>x.user!==b.dataset.del));logAudit('ลบผู้ใช้',b.dataset.del);renderUsers();}});
    updateAuPerm();
  }
  $('#addUserForm').addEventListener('submit',e=>{e.preventDefault();const U=$('#userError'),S=$('#userSuccess');al(S,'','',false);
    const myRank=ROLE_RANK[rec()?rec().role:'ADMIN']||1;if(myRank<2)return;
    const u=$('#auUser').value.trim(),p=$('#auPass').value,role=normRole($('#auRole').value);
    if(!u||!p)return al(U,'กรอกชื่อผู้ใช้และรหัสผ่าน','Enter username and password');
    if(p.length<6)return al(U,'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร','Password must be at least 6 characters');
    if(myRank<3&&role!=='ADMIN')return al(U,'หัวหน้าทีมเพิ่มได้เฉพาะพนักงานโทร','Head can only create agents');
    const users=getUsers();if(users.some(x=>x.user===u))return al(U,'มีชื่อผู้ใช้นี้แล้ว','Username already exists');
    const rec2={user:u,hash:hash(p),role,changed:null};
    if(role!=='MANAGER')rec2.views=$$('#auViews .permChk:checked').map(c=>c.value); // สิทธิ์เมนูที่ผู้จัดการเลือก
    users.push(rec2);saveUsers(users);al(U,'','',false);al(S,'เพิ่มผู้ใช้สำเร็จ ('+(rec2.views?rec2.views.length+' เมนู':'ทุกเมนู')+')','User added');$('#addUserForm').reset();updateAuPerm();renderUsers();logAudit('เพิ่มผู้ใช้',u+' ('+ROLE_LABELS[role]+')');});
  ['#auUser','#auPass'].forEach(s=>$(s).addEventListener('input',()=>al($('#userError'),'','',false)));
  window._renderUsers=renderUsers;
})();

/* =====================================================================
   SMS templates + send
   ===================================================================== */
(function(){
  function getTpl(){let t;try{t=JSON.parse(localStorage.getItem(SMS_KEY));}catch(e){}if(!Array.isArray(t)){t=[{id:1,name:'โปรโมชั่น 20%',text:'สวัสดีคุณ {name} รับโบนัสพิเศษ 20% เมื่อกลับมาฝากกับ {brand} วันนี้!'},{id:2,name:'ทักทาย/ชวนกลับ',text:'คุณ {name} คิดถึงนะ 😊 {brand} มีกิจกรรมใหม่รออยู่ กดเล่นได้เลย'}];localStorage.setItem(SMS_KEY,JSON.stringify(t));}return t;}
  function saveTpl(t){localStorage.setItem(SMS_KEY,JSON.stringify(t));}
  function render(){const t=getTpl();$('#smsTemplates').innerHTML=t.length?t.map(x=>`<div class="sms-tpl"><div class="st-head"><span class="st-name">${esc(x.name)}</span><button class="ur-del" data-del="${x.id}">🗑️</button></div><div class="st-text">${esc(x.text)}</div></div>`).join(''):'<p class="muted">ยังไม่มีข้อความ</p>';
    $('#smsPick').innerHTML=t.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    $('#smsTemplates').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{saveTpl(getTpl().filter(x=>String(x.id)!==b.dataset.del));render();updatePreview();});
    updatePreview();}
  function audience(){const a=$('#smsAudience').value,brand=$('#smsBrand').value;return D.customers.filter(c=>{if(brand&&c.b!==brand)return false;const ret=(Number(c.dep)||0)>0;if(a==='dnc-safe-pending')return !ret&&!c.dnc;if(a==='answered')return c.a&&!c.dnc;if(a==='returned')return ret;return true;});}
  function fill(text,c){const promo='โบนัส 20%';return String(text)
    .replace(/\{\{?\s*name\s*\}?\}/gi,cname(c)||'ลูกค้า')
    .replace(/\{\{?\s*(brand|เว็บ)\s*\}?\}/gi,c.b||'')
    .replace(/\{\{?\s*(phone|เบอร์)\s*\}?\}/gi,c.p||'')
    .replace(/\{\{?\s*โปร\s*\}?\}/gi,promo);}
  function updatePreview(){const t=getTpl().find(x=>String(x.id)===$('#smsPick').value);const aud=audience();const sample=aud[0];$('#smsPreview').textContent=t?(sample?fill(t.text,sample):t.text)+`\n\n— ผู้รับ ${aud.length.toLocaleString()} ราย`:'(เลือกข้อความ)';}
  $('#smsTplForm').addEventListener('submit',e=>{e.preventDefault();const n=$('#tplName').value.trim(),tx=$('#tplText').value.trim();if(!n||!tx){$('#tplError').textContent='กรอกชื่อและข้อความ';$('#tplError').classList.remove('hidden');return;}$('#tplError').classList.add('hidden');const t=getTpl();t.push({id:Date.now(),name:n,text:tx});saveTpl(t);$('#smsTplForm').reset();render();logAudit('เพิ่มข้อความ SMS',n);});
  $('#smsSendForm').addEventListener('submit',e=>{e.preventDefault();const t=getTpl().find(x=>String(x.id)===$('#smsPick').value);if(!t){return;}const aud=audience();$('#smsResult').innerHTML=`เตรียมส่งสำเร็จ: ${aud.length.toLocaleString()} ข้อความ (บันทึกลง Audit Log แล้ว)<span class="en">Prepared ${aud.length} messages — logged to audit</span>`;$('#smsResult').classList.remove('hidden');logAudit('ส่ง SMS',`"${t.name}" → ${aud.length} ผู้รับ`);});
  ['#smsPick','#smsAudience','#smsBrand'].forEach(s=>$(s).addEventListener('change',updatePreview));
  window._renderSms=render;
  window._smsTemplates=getTpl; window._smsFill=fill;   // ให้ฟอร์มบันทึกผลสายเรียกใช้
})();

/* =====================================================================
   IMPORT CSV
   ===================================================================== */
(function(){
  const SYN={brand:['brand','แบรนด์','เว็บ','เวป','website','site'],phone:['phone','เบอร์','เบอร์โทร','tel','mobile'],name:['name','ชื่อ','firstname'],surname:['surname','นามสกุล','lastname'],date:['date','วันที่','วันที่โทร'],time:['time','เวลา'],answered:['answered','รับสาย','รับ'],noanswer:['noanswer','ไม่รับสาย','ไม่รับ'],sms:['sms','ส่งsms'],result:['result','ผลการโทร','ผล'],deposit:['deposit','ยอดฝาก','ยอดกลับมาฝาก','ยอดฝากกลับ','ยอด'],bonus:['bonus','โบนัส','ยอดที่ปรับ'],logindays:['logindays','login','วันlogin'],caller:['caller','พนักงาน','พนักงานที่โทร'],reason:['reason','สาเหตุ','สาเหตุหยุดฝาก'],next:['next','callback','นัดโทรกลับ','ติดตามครั้งถัดไป'],note:['note','โน้ต','บันทึก'],dnc:['dnc','ห้ามโทร','donotcall']};
  const LBL={brand:'แบรนด์',phone:'เบอร์โทร',name:'ชื่อ',surname:'นามสกุล',date:'วันที่โทร (dd/mm/yyyy)',time:'เวลา',answered:'รับสาย (1/0)',noanswer:'ไม่รับสาย (1/0)',sms:'ส่ง SMS (1/0)',result:'ผลการโทร',deposit:'ยอดกลับมาฝาก',bonus:'โบนัสที่ปรับ',logindays:'จำนวนวัน Login',caller:'พนักงานที่โทร',reason:'สาเหตุหยุดฝาก',next:'นัดโทรกลับ',note:'บันทึก',dnc:'ห้ามโทร'};
  const norm=s=>String(s||'').toLowerCase().replace(/[\s_\-]/g,'');
  const toBool=v=>{const s=String(v||'').trim().toLowerCase();return s!==''&&!['0','false','no','n','-','ไม่','x'].includes(s);};
  const toNum=v=>{const n=parseFloat(String(v||'').replace(/[฿,\s]/g,''));return isNaN(n)?0:n;};
  function parseCSV(text){text=text.replace(/^﻿/,'');const rows=[];let f='',row=[],q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else{if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}}if(f.length||row.length){row.push(f);rows.push(row);}return rows.filter(r=>r.some(c=>String(c).trim()!==''));}
  function mapHeaders(h){const m={};h.forEach((x,i)=>{const nh=norm(x);for(const k in SYN){if(SYN[k].some(s=>norm(s)===nh)){m[k]=i;return;}}for(const k in SYN){if(m[k]===undefined&&SYN[k].some(s=>nh.includes(norm(s)))){m[k]=i;return;}}});return m;}
  function build(records){const monthCount={},customers=[];records.forEach(r=>{const brand=(r.brand||'ไม่ระบุ').trim();if(!r.phone&&brand==='ไม่ระบุ')return;const a=toBool(r.answered)?1:0,na=toBool(r.noanswer)?1:0,sm=toBool(r.sms)?1:0,dep=r2(toNum(r.deposit));customers.push({b:brand,p:(r.phone||'').trim(),name:(r.name||'').trim(),surname:(r.surname||'').trim(),d:(r.date||'').trim(),t:(r.time||'').trim(),a,na,sm,r:normResult(r.result),dep,ret:dep>0?1:0,bn:r2(toNum(r.bonus)),lg:Math.round(toNum(r.logindays)),caller:(r.caller||'').trim(),reason:(r.reason||'').trim(),next:(r.next||'').trim(),note:(r.note||'').trim(),dnc:toBool(r.dnc)?1:0});const mm=parseInt(String(r.date||'').split(/[\/\-.]/)[1]);if(mm>=1&&mm<=12)monthCount[mm]=(monthCount[mm]||0)+1;});let tM=0,bb=0;for(const m in monthCount)if(monthCount[m]>bb){bb=monthCount[m];tM=+m;}const now=new Date();return {customers,month:tM?`${thMonths[tM]} ${now.getFullYear()}`:'ข้อมูลนำเข้า',generated:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`};}
  function setMsg(node,th,en,show=true){if(!show){node.classList.add('hidden');node.innerHTML='';return;}node.innerHTML=`${th}<span class="en">${en}</span>`;node.classList.remove('hidden');}
  const dz=$('#dropzone'),fi=$('#csvFile'),err=$('#importError'),pv=$('#importPreview');let pending=null;
  function handle(file){setMsg(err,'','',false);setMsg($('#importSuccess'),'','',false);pv.innerHTML='';if(!file)return;if(!/\.csv$/i.test(file.name))return setMsg(err,'รองรับเฉพาะ .csv','Only .csv supported');const rd=new FileReader();rd.onload=ev=>{try{const rows=parseCSV(ev.target.result);if(rows.length<2)return setMsg(err,'ไฟล์ว่าง','Empty file');const map=mapHeaders(rows[0]);if(map.brand===undefined&&map.phone===undefined)return setMsg(err,'ไม่พบคอลัมน์ แบรนด์/เบอร์โทร','No brand or phone column');const records=rows.slice(1).map(r=>{const o={};for(const k in map)o[k]=r[map[k]];return o;});const built=build(records);if(!built.customers.length)return setMsg(err,'ไม่พบลูกค้า','No customers');pending=built;const cols=Object.keys(map).map(k=>LBL[k]||k).join(', ');const ds=built.customers.reduce((s,c)=>s+c.dep,0),rt=built.customers.filter(c=>c.ret).length,br=new Set(built.customers.map(c=>c.b)).size;pv.innerHTML=`<div class="preview-box"><div class="pv-stat"><div><b>${built.customers.length.toLocaleString()}</b><span>ลูกค้า</span></div><div><b>${br}</b><span>แบรนด์</span></div><div><b>฿${Math.round(ds).toLocaleString()}</b><span>ยอดฝากกลับ</span></div><div><b>${rt.toLocaleString()}</b><span>กลับมาฝาก</span></div></div><div class="muted" style="margin-bottom:14px">รอบ: ${esc(built.month)} · คอลัมน์: ${esc(cols)}</div><button class="btn-confirm" id="btnConfirm">✓ ยืนยันอัปเดตแดชบอร์ด</button></div>`;$('#btnConfirm').onclick=()=>{D.customers=pending.customers;D.month=pending.month;D.generated=pending.generated;recompute();saveData();renderAll();setMsg($('#importSuccess'),'อัปเดตสำเร็จ ('+pending.customers.length.toLocaleString()+' ราย)','Updated successfully');pv.innerHTML='';logAudit('นำเข้า CSV',pending.customers.length+' ราย / '+pending.month);if(window.tgNotify)window.tgNotify('import',`⬆️ <b>นำเข้าข้อมูลสำเร็จ</b>\nรอบ: ${pending.month}\nลูกค้า: ${fmt(pending.customers.length)} ราย`,'team');};}catch(e){setMsg(err,'อ่านไฟล์ไม่สำเร็จ: '+e.message,'Parse failed');}};rd.onerror=()=>setMsg(err,'เปิดไฟล์ไม่สำเร็จ','Read failed');rd.readAsText(file,'utf-8');}
  dz.onclick=()=>fi.click();fi.onchange=e=>handle(e.target.files[0]);
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
  dz.addEventListener('drop',e=>{if(e.dataTransfer.files[0])handle(e.dataTransfer.files[0]);});
  $('#btnTemplate').onclick=()=>{exportCSV('crm_template.csv',CUST_HEADERS,[]);};
  $('#btnExport').onclick=()=>{exportCSV('crm_export_'+D.generated+'.csv',CUST_HEADERS,custExportRows(D.customers));logAudit('Export CSV','ข้อมูลทั้งหมด');};
  $('#btnReset').onclick=()=>{if(confirm('คืนค่าต้นฉบับ? ข้อมูลนำเข้า/แก้ไขจะหาย')){localStorage.removeItem(DATA_KEY);location.reload();}};
  $('#colSpec').innerHTML='<thead><tr><th>คอลัมน์</th><th>ความหมาย</th><th>ชื่อที่รองรับ</th></tr></thead><tbody>'+Object.keys(SYN).map(k=>`<tr><td><b>${k}</b></td><td>${LBL[k]}</td><td class="muted">${SYN[k].join(', ')}</td></tr>`).join('')+'</tbody>';
  window.updateSourcePill=function(){const im=!!localStorage.getItem(DATA_KEY);$('#dataSource').innerHTML='แหล่งข้อมูลปัจจุบัน: '+(im?'<span class="src-pill imported">นำเข้า/แก้ไข (อัปเดต '+D.generated+')</span>':'<span class="src-pill original">ข้อมูลต้นฉบับจาก Excel</span>');};
})();

/* =====================================================================
   ITEM 12 — Telegram notifications
   ===================================================================== */
(function(){
  const TG_KEY='crm_tg';
  const TYPES=[['bigDeposit','💰 ยอดฝากใหญ่ → ทีม'],['bonus','🎁 ปรับโบนัส → หัวหน้า'],['dnc','🚫 ตั้งห้ามโทร → หัวหน้า'],['import','⬆️ นำเข้าข้อมูล → ทีม'],['daily','🌙 สรุปรายวัน'],['weekly','📅 สรุปรายสัปดาห์'],['slow','🐢 เตือนโทรน้อย']];
  function getTg(){let t;try{t=JSON.parse(localStorage.getItem(TG_KEY));}catch(e){}if(!t||typeof t!=='object')t={token:'',team:'',boss:'',big:5000,minCalls:30,toggles:{}};if(!t.toggles)t.toggles={};TYPES.forEach(([k])=>{if(t.toggles[k]===undefined)t.toggles[k]=true;});return t;}
  function saveTg(t){localStorage.setItem(TG_KEY,JSON.stringify(t));}
  function load(){const t=getTg();$('#tgToken').value=t.token||'';$('#tgTeam').value=t.team||'';$('#tgBoss').value=t.boss||'';$('#tgBig').value=t.big||5000;$('#tgMinCalls').value=t.minCalls||30;
    $('#tgToggles').innerHTML=TYPES.map(([k,l])=>`<label><input type="checkbox" class="tgTg" data-k="${k}" ${t.toggles[k]?'checked':''}> ${l}</label>`).join('');}
  function collect(){const t=getTg();t.token=$('#tgToken').value.trim();t.team=$('#tgTeam').value.trim();t.boss=$('#tgBoss').value.trim();t.big=parseFloat($('#tgBig').value)||5000;t.minCalls=parseInt($('#tgMinCalls').value)||30;$$('.tgTg').forEach(c=>t.toggles[c.dataset.k]=c.checked);return t;}
  async function sendTelegram(chatId,text){
    const t=getTg();
    if(!t.token||!chatId){throw new Error('ยังไม่ได้ตั้ง Token หรือ Chat ID');}
    const res=await fetch(`https://api.telegram.org/bot${t.token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:'HTML'})});
    const j=await res.json().catch(()=>({}));
    if(!res.ok||!j.ok)throw new Error(j.description||('HTTP '+res.status));
    return j;
  }
  function ok(msg){const n=$('#tgResult');n.className='alert success';n.innerHTML=msg;n.classList.remove('hidden');}
  function err(msg){const n=$('#tgResult');n.className='alert error';n.innerHTML=msg;n.classList.remove('hidden');}
  $('#tgForm').addEventListener('submit',e=>{e.preventDefault();saveTg(collect());$('#tgSaved').innerHTML='บันทึกการตั้งค่าแล้ว<span class="en">Settings saved</span>';$('#tgSaved').classList.remove('hidden');logAudit('ตั้งค่า Telegram','');setTimeout(()=>$('#tgSaved').classList.add('hidden'),2500);});
  async function test(group){saveTg(collect());const t=getTg();const chat=group==='team'?t.team:t.boss;try{await sendTelegram(chat,`✅ <b>ทดสอบ CRM</b>\nกลุ่ม${group==='team'?'ทีม':'หัวหน้า'} เชื่อมต่อสำเร็จ`);ok('ส่งทดสอบสำเร็จ ✓');logAudit('ทดสอบส่ง Telegram',group);}catch(e){err('ส่งไม่สำเร็จ: '+e.message+' <span class="en">(Telegram ต้องตั้ง Token+Chat ID ให้ถูก และเครื่องต้องต่อเน็ต)</span>');}}
  $('#tgTestTeam').onclick=()=>test('team');$('#tgTestBoss').onclick=()=>test('boss');

  // summaries (แทน cron)
  function dayCust(){return D.customers.filter(c=>{const dt=pdate(c.d);return dt&&dt.getTime()===DATA_MAX;});}
  function weekCust(){return D.customers.filter(c=>{const dt=pdate(c.d);return dt&&dt.getTime()>=DATA_MAX-6*864e5&&dt.getTime()<=DATA_MAX;});}
  function sumText(title,cs){const a=aggregate(cs),T=a.totals;return `${title}\n━━━━━━━━\n📞 โทร: <b>${fmt(T.calls)}</b> · รับสาย ${T.pctAns}%\n💬 SMS: ${fmt(T.sms)}\n👥 กลับมาฝาก: <b>${fmt(T.ret)}</b> ราย\n💰 ยอดฝากกลับ: <b>฿${fmt(T.dep)}</b>\n🎁 โบนัส: ฿${fmt(T.bonus)} · ROI ${T.roi}x`;}
  function slowText(){const r=agentRows().filter(a=>a.caller!=='(ไม่ระบุ)');const t=getTg();const slow=r.filter(a=>a.total<t.minCalls);return `🐢 <b>พนักงานโทรน้อยกว่าเกณฑ์ (${t.minCalls})</b>\n━━━━━━━━\n`+(slow.length?slow.map(a=>`• ${esc(a.caller)}: ${a.total} สาย`).join('\n'):'ทุกคนถึงเกณฑ์ ✓');}
  async function sendSummary(group,text,type){$('#tgPreview').textContent=text.replace(/<\/?b>/g,'');const t=getTg();if(!t.toggles[type]){err('ปิดการแจ้งเตือนประเภทนี้อยู่ (เปิดในรายการด้านบน)');return;}const chat=group==='team'?t.team:t.boss;try{await sendTelegram(chat,text);ok('ส่งสรุปสำเร็จ ✓');logAudit('ส่งสรุป Telegram',type);}catch(e){err('ส่งไม่สำเร็จ: '+e.message);}}
  $('#tgDaily').onclick=()=>sendSummary('team',sumText('🌙 <b>สรุปรายวัน '+D.generated+'</b>',dayCust()),'daily');
  $('#tgWeekly').onclick=()=>sendSummary('boss',sumText('📅 <b>สรุป 7 วันล่าสุด</b>',weekCust()),'weekly');
  $('#tgSlow').onclick=()=>sendSummary('boss',slowText(),'slow');

  // expose สำหรับ trigger เหตุการณ์
  window.tgBig=()=>getTg().big;
  window.tgNotify=async function(type,text,group){const t=getTg();if(!t.token||!t.toggles[type])return;const chat=group==='boss'?t.boss:t.team;if(!chat)return;try{await sendTelegram(chat,text);logAudit('แจ้งเตือน Telegram',type);}catch(e){/* ห้ามทำงานหลักพัง */console.warn('tg fail',e.message);}};
  window._loadTg=load;
})();

/* =====================================================================
   INIT
   ===================================================================== */
if(typeof window.updateSourcePill!=='function')window.updateSourcePill=function(){};
renderQueueChecks();
if(window._renderSms)window._renderSms();
if(window._loadTg)window._loadTg();
registerMonth();
window.updateSourcePill();
renumberNav();     // ใส่เลขข้อเมนู
setRange('all');   // ตั้งค่าเริ่มต้น + เรนเดอร์ทั้งหมด
