
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const dotenv = require("dotenv");
const { URL } = require("url");

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = Number(process.env.PORT || 3000);
const PROVIDER = (process.env.DATA_PROVIDER || "otcharts").toLowerCase();

app.use(express.static("public"));
app.get("/api/config", (_req,res) => {
  res.json({
    provider: PROVIDER,
    live: true,
    note: PROVIDER === "otcharts"
      ? "Unofficial read-only Quotex-book market data"
      : "Twelve Data real market data"
  });
});

const clients = new Set();
const state = {
  symbols: [],
  selected: "EURUSD_otc",
  timeframe: 60,
  candles: [],
  latest: null,
  connected: false
};

function broadcast(payload){
  const msg = JSON.stringify(payload);
  for(const c of clients){
    if(c.readyState === WebSocket.OPEN) c.send(msg);
  }
}

function normalizeCandle(c){
  return {
    time: Number(c.time ?? c.timestamp ?? 0),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: c.volume == null ? null : Number(c.volume)
  };
}

function validateCandles(arr){
  return (Array.isArray(arr) ? arr : [])
    .map(normalizeCandle)
    .filter(c => Number.isFinite(c.time) && [c.open,c.high,c.low,c.close].every(Number.isFinite))
    .sort((a,b)=>a.time-b.time);
}

async function otchartsSymbols(){
  const r = await fetch("https://otcharts.com/v1/symbols?venue=quotex", {
    headers: { Authorization: `Bearer ${process.env.OTCHARTS_API_KEY}` }
  });
  if(!r.ok) throw new Error(`OTCharts symbols HTTP ${r.status}`);
  const j = await r.json();
  return j.symbols || [];
}

async function otchartsCandles(symbol, tf, limit=180){
  const u = new URL("https://otcharts.com/v1/candles");
  u.searchParams.set("venue","quotex");
  u.searchParams.set("symbol",symbol);
  u.searchParams.set("tf",String(tf));
  u.searchParams.set("limit",String(limit));
  const r = await fetch(u, {headers:{Authorization:`Bearer ${process.env.OTCHARTS_API_KEY}`}});
  if(!r.ok) throw new Error(`OTCharts candles HTTP ${r.status}`);
  return validateCandles((await r.json()).candles);
}

async function startOTStream(symbol){
  const u = new URL("https://otcharts.com/v1/stream");
  u.searchParams.set("venue","quotex");
  u.searchParams.set("symbols",symbol);
  const r = await fetch(u, {headers:{Authorization:`Bearer ${process.env.OTCHARTS_API_KEY}`}});
  if(!r.ok) throw new Error(`OTCharts stream HTTP ${r.status}`);
  state.connected = true;
  broadcast({type:"status", connected:true, provider:"otcharts"});
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while(true){
    const {value,done} = await reader.read();
    if(done) break;
    buffer += decoder.decode(value,{stream:true});
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || "";
    for(const part of parts){
      const dataLines = part.split("\n").filter(x=>x.startsWith("data:"));
      if(!dataLines.length) continue;
      const raw = dataLines.map(x=>x.slice(5).trim()).join("\n");
      try{
        const tick = JSON.parse(raw);
        const price = Number(tick.price);
        if(!Number.isFinite(price)) continue;
        state.latest = {symbol, price, time:Number(tick.time || Date.now()/1000)};
        broadcast({type:"tick", ...state.latest});
      }catch{}
    }
  }
  state.connected = false;
  broadcast({type:"status", connected:false, provider:"otcharts"});
}

async function loadOT(symbol, tf){
  if(!process.env.OTCHARTS_API_KEY || process.env.OTCHARTS_API_KEY.includes("YOUR_")){
    throw new Error("Missing OTCHARTS_API_KEY");
  }
  const candles = await otchartsCandles(symbol, tf);
  state.candles = candles;
  state.selected = symbol;
  state.timeframe = tf;
  broadcast({type:"candles", symbol, timeframe:tf, candles});
  // one stream per symbol; restart when selection changes
  startOTStream(symbol).catch(e=>broadcast({type:"error", message:e.message}));
}

async function tdCandles(symbol, tf){
  const api = process.env.TWELVE_DATA_API_KEY;
  if(!api || api.includes("YOUR_")) throw new Error("Missing TWELVE_DATA_API_KEY");
  const map = {60:"1min",300:"5min",900:"15min",1800:"30min",3600:"1h",14400:"4h",86400:"1day"};
  const interval = map[tf] || "1min";
  const u = new URL("https://api.twelvedata.com/time_series");
  u.searchParams.set("symbol",symbol);
  u.searchParams.set("interval",interval);
  u.searchParams.set("outputsize","180");
  u.searchParams.set("apikey",api);
  const r = await fetch(u);
  if(!r.ok) throw new Error(`Twelve Data HTTP ${r.status}`);
  const j = await r.json();
  if(j.status === "error") throw new Error(j.message || "Twelve Data error");
  return validateCandles((j.values || []).map(x=>({
    time: Date.parse(x.datetime)/1000, open:x.open, high:x.high, low:x.low, close:x.close, volume:x.volume
  })));
}

function startTD(){
  const api = process.env.TWELVE_DATA_API_KEY;
  if(!api || api.includes("YOUR_")) throw new Error("Missing TWELVE_DATA_API_KEY");
  const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(api)}`);
  ws.on("open",()=>{
    state.connected = true;
    ws.send(JSON.stringify({action:"subscribe",params:{symbols:"EUR/USD,GBP/USD,USD/JPY,AUD/USD,EUR/GBP,GBP/JPY,XAU/USD,BTC/USD,ETH/USD"}}));
    broadcast({type:"status",connected:true,provider:"twelvedata"});
  });
  ws.on("message",(raw)=>{
    try{
      const j=JSON.parse(raw.toString());
      if(j.event==="price"){
        const price=Number(j.price);
        if(!Number.isFinite(price)) return;
        broadcast({type:"tick",symbol:j.symbol,price,time:Number(j.timestamp||Date.now()/1000)});
      }
    }catch{}
  });
  ws.on("close",()=>{state.connected=false;broadcast({type:"status",connected:false,provider:"twelvedata"});setTimeout(startTD,3000)});
  ws.on("error",()=>{});
  return ws;
}

const tdMap = {
  "EURUSD":"EUR/USD","GBPUSD":"GBP/USD","USDJPY":"USD/JPY","AUDUSD":"AUD/USD",
  "EURGBP":"EUR/GBP","GBPJPY":"GBP/JPY","XAUUSD":"XAU/USD","BTCUSD":"BTC/USD","ETHUSD":"ETH/USD"
};

async function loadTD(symbol, tf){
  const realSymbol = tdMap[symbol] || symbol;
  const candles = await tdCandles(realSymbol,tf);
  state.candles=candles; state.selected=symbol; state.timeframe=tf;
  broadcast({type:"candles",symbol,timeframe:tf,candles});
}

wss.on("connection",(socket)=>{
  clients.add(socket);
  socket.send(JSON.stringify({type:"status",connected:state.connected,provider:PROVIDER}));
  socket.on("message", async raw=>{
    try{
      const m=JSON.parse(raw.toString());
      if(m.type==="load"){
        const tf=Number(m.timeframe||60);
        const symbol=String(m.symbol||state.selected);
        if(PROVIDER==="otcharts") await loadOT(symbol,tf);
        else await loadTD(symbol,tf);
      }
      if(m.type==="symbols" && PROVIDER==="otcharts"){
        try{
          const list=await otchartsSymbols();
          state.symbols=list;
          socket.send(JSON.stringify({type:"symbols",symbols:list}));
        }catch(e){socket.send(JSON.stringify({type:"error",message:e.message}))}
      }
    }catch(e){
      socket.send(JSON.stringify({type:"error",message:e.message}));
    }
  });
  socket.on("close",()=>clients.delete(socket));
});

server.listen(PORT,()=>console.log(`V6 running on http://localhost:${PORT}`));

if(PROVIDER==="twelvedata"){
  try{ startTD(); }catch(e){console.error(e.message); }
}
