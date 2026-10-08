const $=id=>document.getElementById(id);
const markets=[
 ["EUR/USD","90%","1.08965"],["GBP/JPY","87%","192.34"],["BTC/USD","92%","67342.20"],
 ["AUD/USD","88%","0.6598"],["XAU/USD","86%","2348.12"],["EUR/GBP","85%","0.8542"],
 ["USD/JPY","91%","151.62"],["GBP/USD","89%","1.2734"],["USD/CAD","86%","1.3582"],
 ["ETH/USD","93%","3521.40"],["SOL/USD","90%","158.22"],["NZD/USD","84%","0.6121"]
];
const frames=["0.5s","1s","5s","15s","30s","1m","5m","15m","30m","1h","4h","1d"];
let selected=0, timeframe="1m", candles=[], timer=59;

function renderMarkets(){
 $("assetbar").innerHTML=markets.map((m,i)=>`<div class="asset ${i===selected?'active':''}" data-i="${i}"><b>${m[0]}</b><small>${m[1]}</small></div>`).join("");
 document.querySelectorAll(".asset").forEach(x=>x.onclick=()=>{selected=+x.dataset.i;renderMarkets();newMarket()});
 $("timebar").innerHTML=frames.map(x=>`<button class="${x===timeframe?'active':''}">${x}</button>`).join("");
 document.querySelectorAll(".timebar button").forEach(b=>b.onclick=()=>{timeframe=b.textContent;renderMarkets()});
}
function priceBase(){return Number(markets[selected][2])}
function makeCandles(){
 let p=priceBase();candles=[];
 for(let i=0;i<65;i++){let o=p+(Math.random()-.5)*p*.001,c=o+(Math.random()-.47)*p*.0008,h=Math.max(o,c)*(1+Math.random()*.0005),l=Math.min(o,c)*(1-Math.random()*.0005);candles.push({o,c,h,l});p=c}
}
function draw(){
 const c=$("chart"),ctx=c.getContext("2d"),d=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*d;c.height=h*d;ctx.scale(d,d);ctx.clearRect(0,0,w,h);
 const max=Math.max(...candles.map(x=>x.h)),min=Math.min(...candles.map(x=>x.l)),step=w/candles.length;
 candles.forEach((x,i)=>{let X=i*step+step/2,y=v=>h-(v-min)/(max-min)*h*.82-h*.08;ctx.strokeStyle=x.c>=x.o?"#15d79b":"#ff4057";ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(X,y(x.h));ctx.lineTo(X,y(x.l));ctx.stroke();let top=y(Math.max(x.o,x.c)),bot=y(Math.min(x.o,x.c));ctx.fillRect(X-step*.32,top,step*.64,Math.max(2,bot-top))});
 const last=candles[candles.length-1].c;$("last").textContent=last.toFixed(last>100?2:5);$("ohlc").textContent=`O: ${candles[candles.length-1].o.toFixed(5)}  H: ${Math.max(...candles.slice(-8).map(x=>x.h)).toFixed(5)}  L: ${Math.min(...candles.slice(-8).map(x=>x.l)).toFixed(5)}  C: ${last.toFixed(5)}`;
}
function newCandle(){
 const last=candles.at(-1).c, o=last, c=o+(Math.random()-.48)*last*.0008,h=Math.max(o,c)*(1+Math.random()*.00035),l=Math.min(o,c)*(1-Math.random()*.00035);candles.push({o,c,h,l});if(candles.length>65)candles.shift();draw();updateSignal();
}
function updateSignal(){
 const m=markets[selected], call=Math.random()>.43, conf=Math.max(90,Math.min(98,Number(m[1].replace('%',''))+Math.floor(Math.random()*5)-2)),p=candles.at(-1).c;
 $("pair").textContent=m[0];$("confidence").textContent=conf+"%";$("signal").textContent=call?"▲ CALL":"▼ PUT";$("signal").style.color=call?"#15dda0":"#ff5060";$("callTag").textContent=call?"▲ CALL":"▼ PUT";$("callTag").style.background=call?"#05bf84":"#e52f45";$("entry").textContent=p.toFixed(p>100?2:5);$("target").textContent=(p+(call?Math.abs(p*.0008):-Math.abs(p*.0008))).toFixed(p>100?2:5);$("stop").textContent=(p+(call?-Math.abs(p*.0006):Math.abs(p*.0006))).toFixed(p>100?2:5);
}
function addHistory(){
 const call=Math.random()>.43,conf=90+Math.floor(Math.random()*9),m=markets[selected][0],r=document.createElement("div");r.className="row";r.innerHTML=`<span>${m}</span><b class="${call?'green':'red'}">${call?'▲ CALL':'▼ PUT'}</b><span>${timeframe}</span><span>${conf}%</span>`;$("history").prepend(r);while($("history").children.length>7)$("history").lastChild.remove()
}
function renderLive(){
 $("liveSignals").innerHTML=markets.slice(0,6).map((m,i)=>`<div class="row"><span>${m[0]}</span><b class="${i%3?'green':'red'}">${i%3?'CALL':'PUT'}</b><span>${frames[(i+5)%frames.length]}</span><span>${m[1]}</span></div>`).join("");
 $("overview").innerHTML=markets.slice(0,7).map((m,i)=>`<div class="marketRow"><span>${m[0]}</span><span>${m[2]}</span><b class="up">+${(0.25+i*.13).toFixed(2)}%</b></div>`).join("");
}
function newMarket(){makeCandles();draw();updateSignal();addHistory()}
$("call").onclick=()=>updateSignal();$("put").onclick=()=>updateSignal();
renderMarkets();renderLive();newMarket();
setInterval(newCandle,1500);
setInterval(()=>{timer--;if(timer<0){timer=59;addHistory();updateSignal()}$("timer").textContent=`00:${String(timer).padStart(2,"0")}`},1000);
window.addEventListener("resize",draw);
