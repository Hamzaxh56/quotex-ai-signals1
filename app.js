
const canvas=document.getElementById("chart"),ctx=canvas.getContext("2d");
const state={symbol:"EURUSD",tf:60,candles:[],tick:null,provider:"",score:null};
const names={EURUSD:["🇪🇺🇺🇸","EUR/USD"],GBPUSD:["🇬🇧🇺🇸","GBP/USD"],USDJPY:["🇺🇸🇯🇵","USD/JPY"],AUDUSD:["🇦🇺🇺🇸","AUD/USD"],EURGBP:["🇪🇺🇬🇧","EUR/GBP"],GBPJPY:["🇬🇧🇯🇵","GBP/JPY"],XAUUSD:["🟡","XAU/USD"],BTCUSD:["₿","BTC/USD"],ETHUSD:["Ξ","ETH/USD"]};
const otc={EURUSD:"EURUSD_otc",GBPUSD:"GBPUSD_otc",USDJPY:"USDJPY_otc",AUDUSD:"AUDUSD_otc",EURGBP:"EURGBP_otc",GBPJPY:"GBPJPY_otc",XAUUSD:"XAUUSD_otc",BTCUSD:"BTCUSD_otc",ETHUSD:"ETHUSD_otc"};
let ws;

function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);draw()}
window.addEventListener("resize",resize);

function fmt(p){if(!Number.isFinite(p))return "—"; return p>=1000?p.toFixed(2):p>=10?p.toFixed(3):p>=1?p.toFixed(5):p.toFixed(6)}
function calcSignal(c){
  if(c.length<25)return {sig:"WAIT",score:"—",reason:"Waiting for enough closed candles…"};
  const closes=c.map(x=>x.close), n=closes.length;
  const ema=(period)=>{let a=2/(period+1),e=closes[0];for(let i=1;i<n;i++)e=closes[i]*a+e*(1-a);return e};
  const e9=ema(9),e21=ema(21);
  let gains=0,losses=0;for(let i=n-14;i<n;i++){let d=closes[i]-closes[i-1];if(d>0)gains+=d;else losses-=d}
  const rs=losses?gains/losses:99, rsi=100-(100/(1+rs));
  const last=c[n-1], range=last.high-last.low||1, body=Math.abs(last.close-last.open)/range;
  let call=0,put=0;
  if(e9>e21){call+=35}else{put+=35}
  if(rsi<45)call+=25; if(rsi>55)put+=25;
  if(last.close>last.open && body>.45)call+=20;
  if(last.close<last.open && body>.45)put+=20;
  const d=closes[n-1]-closes[n-4]; if(d>0)call+=20; else if(d<0)put+=20;
  const score=Math.min(99,Math.max(51,Math.round(Math.max(call,put))));
  const sig=call>put?"BUY":"SELL";
  return {sig,score:`${score}%`,reason:`EMA ${e9>e21?"up":"down"} • RSI ${rsi.toFixed(1)} • candle ${body>.45?"strong":"weak"}`};
}

function draw(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  ctx.clearRect(0,0,w,h); if(!state.candles.length)return;
  const c=state.candles.slice(-45), hi=Math.max(...c.map(x=>x.high)),lo=Math.min(...c.map(x=>x.low)),pad=(hi-lo)*.08||.0001;
  const H=hi+pad,L=lo-pad,span=H-L;
  const xstep=w/(c.length+1),cw=Math.max(4,xstep*.48);
  c.forEach((b,i)=>{
    const x=(i+1)*xstep, y=v=>h-(v-L)/span*h;
    const up=b.close>=b.open;
    ctx.strokeStyle=up?"#10b85c":"#ed5b54";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x,y(b.high));ctx.lineTo(x,y(b.low));ctx.stroke();
    ctx.fillStyle=up?"#10b85c":"#ed5b54";
    const top=y(Math.max(b.open,b.close)),bot=y(Math.min(b.open,b.close));
    ctx.fillRect(x-cw/2,top,cw,Math.max(2,bot-top));
  });
  const latest=state.tick?.price ?? c[c.length-1].close;
  const py=h-(latest-L)/span*h;
  const line=document.getElementById("priceLine");line.style.top=`${Math.max(3,Math.min(97,py/h*100))}%`;line.setAttribute("data-price",fmt(latest));
}

function connect(){
  ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host);
  ws.onopen=()=>{load(); if(state.provider==="otcharts") ws.send(JSON.stringify({type:"symbols"}));};
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.type==="status"){state.provider=m.provider;document.getElementById("provider").textContent=m.connected?`● LIVE • ${m.provider.toUpperCase()}`:`○ OFFLINE • ${m.provider?.toUpperCase()||""}`;return}
    if(m.type==="candles"){state.candles=m.candles||[];state.symbol=m.symbol||state.symbol;updateSignal();draw();return}
    if(m.type==="tick"){const sym=m.symbol||"";const selected=state.provider==="otcharts"?otc[state.symbol]:names[state.symbol]?.[1];if(sym===selected||sym===state.symbol){state.tick={price:Number(m.price),time:Number(m.time)};draw();document.getElementById("clock").textContent=new Date(m.time*1000).toLocaleTimeString([], {hour12:false})}}
    if(m.type==="error"){document.getElementById("signalReason").textContent=m.message;document.getElementById("provider").textContent="DATA ERROR";}
  };
  ws.onclose=()=>{document.getElementById("provider").textContent="RECONNECTING…";setTimeout(connect,2000)};
}
function load(){
  const symbol=state.provider==="otcharts"?(otc[state.symbol]||"EURUSD_otc"):(names[state.symbol]?.[1]||"EUR/USD");
  ws.send(JSON.stringify({type:"load",symbol,timeframe:state.tf}));
}
function updateSignal(){
  const r=calcSignal(state.candles);state.score=r.score;
  document.getElementById("score").textContent=r.score;document.getElementById("signal").textContent=r.sig;
  document.getElementById("signalReason").textContent=r.reason;
}
document.querySelectorAll("[data-symbol]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-symbol]").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.symbol=b.dataset.symbol;state.tick=null;document.getElementById("assetFlag").textContent=names[state.symbol][0];document.getElementById("assetLabel").textContent=names[state.symbol][1];load()});
document.querySelectorAll("[data-tf]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tf]").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.tf=Number(b.dataset.tf);load()});
setInterval(()=>{const now=Date.now()/1000, next=Math.ceil(now/state.tf)*state.tf;const left=Math.max(0,next-now);document.getElementById("candleCountdown").textContent=`00:${String(Math.ceil(left)).padStart(2,"0")}`},200);
resize();connect();
