'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const TD_KEY = process.env.TWELVEDATA_API_KEY || '';
const BINANCE_SYMBOLS = new Set(['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','LINKUSDT','AVAXUSDT','TRXUSDT','DOTUSDT','LTCUSDT']);
const TD_INTERVALS = {
  '1m':'1min', '5m':'5min', '15m':'15min', '30m':'30min',
  '1h':'1h', '4h':'4h', '1d':'1day'
};
const CHART_INTERVALS = new Set(['1m','3m','5m','15m','30m','1h','4h','12h','1d']);
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
function send(res, status, body) {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});
  res.end(JSON.stringify(body));
}
function symbolForTwelveData(category, symbol) {
  if (category === 'CURRENCIES' && /^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0,3)}/${symbol.slice(3)}`;
  if (category === 'STOCKS' && /^[A-Z.]{1,8}$/.test(symbol)) return symbol;
  if (category === 'COMMODITIES') {
    if (symbol === 'XAUUSD') return 'XAU/USD';
    if (symbol === 'XAGUSD') return 'XAG/USD';
    if (symbol === 'OIL') return 'WTI';
    if (symbol === 'NATGAS') return 'NG';
  }
  return null;
}
async function candles(reqUrl, res) {
  const category = (reqUrl.searchParams.get('category') || '').toUpperCase();
  const symbol = (reqUrl.searchParams.get('symbol') || '').toUpperCase();
  const interval = reqUrl.searchParams.get('interval') || '1m';
  if (!CHART_INTERVALS.has(interval)) return send(res, 400, {error:'Unsupported chart interval.'});
  try {
    if (category === 'CRYPTO' && BINANCE_SYMBOLS.has(symbol)) {
      const u = new URL('https://data-api.binance.vision/api/v3/klines');
      u.searchParams.set('symbol', symbol);
      u.searchParams.set('interval', interval);
      u.searchParams.set('limit', '120');
      const r = await fetch(u, {signal: AbortSignal.timeout(10000), headers:{'accept':'application/json'}});
      if (!r.ok) throw new Error(`Binance feed returned HTTP ${r.status}`);
      const raw = await r.json();
      if (!Array.isArray(raw) || !raw.length) throw new Error('No Binance candles returned for this symbol/timeframe.');
      const now = Date.now();
      return send(res, 200, {symbol, category, interval, source:'Binance public spot market', updatedAt:now, candles:raw.map(k=>({time:Number(k[0]),open:Number(k[1]),high:Number(k[2]),low:Number(k[3]),close:Number(k[4]),volume:Number(k[5]),closed:Number(k[6])<now}))});
    }
    const tdSymbol = symbolForTwelveData(category, symbol);
    if (!tdSymbol) return send(res, 400, {error:'This instrument is not supported by the configured live feeds. OTC is not included in public exchange data. Choose a supported real-market symbol.'});
    if (!TD_KEY) return send(res, 503, {error:'Twelve Data key is not configured. Add TWELVEDATA_API_KEY in Render → your service → Environment, then redeploy.'});
    const tdInterval = TD_INTERVALS[interval];
    if (!tdInterval) return send(res, 400, {error:`Twelve Data does not support the ${interval} interval. Choose 1m, 5m, 15m, 30m, 1h, 4h or 1d for this market.`});
    const u = new URL('https://api.twelvedata.com/time_series');
    u.searchParams.set('symbol', tdSymbol);
    u.searchParams.set('interval', tdInterval);
    u.searchParams.set('outputsize', '120');
    u.searchParams.set('timezone', 'UTC');
    u.searchParams.set('apikey', TD_KEY);
    const r = await fetch(u, {signal: AbortSignal.timeout(12000), headers:{'accept':'application/json'}});
    if (!r.ok) throw new Error(`Twelve Data returned HTTP ${r.status}`);
    const raw = await r.json();
    if (raw.status === 'error' || !Array.isArray(raw.values)) throw new Error(raw.message || 'Twelve Data returned no candles. Check your free-plan access, symbol and interval.');
    const parsed = raw.values.map(v=>({time:Date.parse(v.datetime.replace(' ','T')+'Z'),open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close),volume:Number(v.volume||0),closed:true})).filter(c=>Number.isFinite(c.time)&&Number.isFinite(c.close)).reverse();
    if (!parsed.length) throw new Error('Twelve Data returned empty or invalid candle data.');
    return send(res, 200, {symbol:tdSymbol,category,interval,source:'Twelve Data',updatedAt:Date.now(),candles:parsed});
  } catch (e) {
    return send(res, 502, {error:e.message || 'Market data provider error.'});
  }
}
const server = http.createServer(async (req,res)=>{
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (u.pathname === '/api/health') return send(res, 200, {ok:true, binancePublic:true, twelveDataConfigured:Boolean(TD_KEY), time:new Date().toISOString()});
  if (u.pathname === '/api/candles' && req.method === 'GET') return candles(u,res);
  const requested = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
  const full = path.resolve(ROOT, '.' + requested);
  if (!full.startsWith(ROOT + path.sep) && full !== path.join(ROOT,'index.html')) return send(res,403,{error:'Forbidden'});
  fs.readFile(full,(err,data)=>{
    if(err){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});return res.end('Not found');}
    res.writeHead(200,{'content-type':MIME[path.extname(full)]||'application/octet-stream','cache-control':path.extname(full)==='.html'?'no-cache':'public, max-age=300'});res.end(data);
  });
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Quotex Signal Analyzer listening on ${PORT}; Twelve Data configured: ${Boolean(TD_KEY)}`));
