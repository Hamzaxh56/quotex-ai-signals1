const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

// Serve the UI. This works even when Render starts the app from its repository root.
app.use(express.static(PUBLIC_DIR));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/config', (req, res) => res.json({ provider: 'yahoo-public', live: true }));

const clients = new Set();
const symbolMap = {
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'USDJPY=X',
  AUDUSD: 'AUDUSD=X', EURGBP: 'EURGBP=X', GBPJPY: 'GBPJPY=X',
  XAUUSD: 'GC=F', BTCUSD: 'BTC-USD', ETHUSD: 'ETH-USD'
};
const intervalMap = {60:'1m',300:'5m',900:'15m',1800:'30m',3600:'1h',14400:'1h',86400:'1d'};
const rangeMap = {60:'1d',300:'5d',900:'1mo',1800:'1mo',3600:'3mo',14400:'6mo',86400:'1y'};
const state = { connected:false, symbol:'EURUSD', timeframe:60, candles:[], latest:null };

function send(ws, data){ try{ if(ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }catch{} }
function broadcast(data){ for(const ws of clients) send(ws,data); }
function normalize(rows){
  return rows.map(x => ({time:Number(x.time),open:Number(x.open),high:Number(x.high),low:Number(x.low),close:Number(x.close),volume:x.volume==null?null:Number(x.volume)}))
    .filter(x=>Number.isFinite(x.time)&&[x.open,x.high,x.low,x.close].every(Number.isFinite));
}
async function yahoo(symbol, tf){
  const ticker = symbolMap[symbol] || symbol;
  const interval = intervalMap[tf] || '1m';
  const range = rangeMap[tf] || '1d';
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&events=history`;
  const r = await fetch(u, {headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok) throw new Error(`Public market feed HTTP ${r.status}`);
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  if(!result) throw new Error('Public market feed returned no data');
  const q = result.indicators?.quote?.[0] || {};
  const rows = (result.timestamp || []).map((t,i)=>({time:t,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]}));
  return normalize(rows).slice(-180);
}
async function load(symbol, tf){
  const candles = await yahoo(symbol,tf);
  if(!candles.length) throw new Error('No candles returned for '+symbol);
  state.symbol=symbol; state.timeframe=tf; state.candles=candles; state.latest=candles[candles.length-1]; state.connected=true;
  broadcast({type:'status',connected:true,provider:'public'});
  broadcast({type:'candles',symbol,timeframe:tf,candles});
  const last = candles[candles.length-1];
  broadcast({type:'tick',symbol,price:last.close,time:last.time});
}

wss.on('connection', ws=>{
  clients.add(ws);
  send(ws,{type:'status',connected:state.connected,provider:'public'});
  if(state.candles.length) send(ws,{type:'candles',symbol:state.symbol,timeframe:state.timeframe,candles:state.candles});
  ws.on('message', async raw=>{
    try{
      const m=JSON.parse(raw.toString());
      if(m.type==='load') await load(String(m.symbol||'EURUSD'), Number(m.timeframe||60));
    }catch(e){ send(ws,{type:'error',message:e.message}); }
  });
  ws.on('close',()=>clients.delete(ws));
});

// Refresh the selected public feed periodically. This is not a broker/Quotex feed.
setInterval(()=>{ if(state.symbol) load(state.symbol,state.timeframe).catch(e=>broadcast({type:'error',message:e.message})); }, 15000);

server.listen(PORT,'0.0.0.0',()=>console.log(`Server listening on ${PORT}`));
