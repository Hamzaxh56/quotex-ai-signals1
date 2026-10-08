const $=id=>document.getElementById(id);
const ticker=$("ticker"), history=$("history");
let data=[27,3,9,22,11,9,3,32,18,19,12,15,29,12];
function drawTicker(){ticker.innerHTML=data.map((n,i)=>`<span class="${i===0?'hot ':''}${n%2?'r':''}">${n}</span>`).join("")}
function chart(call=true){let pts=[],y=150;for(let x=0;x<=800;x+=35){y+=((Math.random()-.48)*32)+(call?-2:2);y=Math.max(35,Math.min(265,y));pts.push(`${x},${y}`)}$("line").setAttribute("points",pts.join(" "));}
function signal(){
 const call=Math.random()>.43,c=90+Math.floor(Math.random()*10);
 $("direction").textContent=call?"CALL ↑":"PUT ↓";$("direction").className="big "+(call?"call":"put");
 $("signalTag").textContent=call?"CALL ↑":"PUT ↓";$("signalTag").style.background=call?"#123d35":"#401e28";$("signalTag").style.color=call?"#37dda8":"#ff6671";
 $("confidence").textContent=c+"%";$("meter").style.width=c+"%";$("trend").textContent=call?"Bullish":"Bearish";
 $("rsi").textContent=(45+Math.random()*30).toFixed(1);$("momentum").textContent=Math.random()>.3?"Strong":"Medium";$("vol").textContent=Math.random()>.65?"High":"Low";
 chart(call);
 const now=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
 const h=document.createElement("div");h.className="hist";h.innerHTML=`<span>${now}</span><b class="${call?'':'p'}">${call?'CALL':'PUT'}</b><span>${$("tf").value}</span><span>${c}%</span>`;history.prepend(h);
 while(history.children.length>6)history.lastChild.remove();
 data.unshift(Math.floor(Math.random()*37));data=data.slice(0,14);drawTicker();
}
$("analyze").onclick=signal;$("marketSelect").onchange=e=>$("asset").textContent=e.target.value;
drawTicker();signal();
let sec=15;setInterval(()=>{sec--;if(sec<0){sec=15;signal()}$("countdown").textContent=`00:${String(sec).padStart(2,"0")}`},1000);