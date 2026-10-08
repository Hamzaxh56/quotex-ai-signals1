const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const SYMBOLS = {
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  AUDUSD: "AUDUSD=X",
  EURGBP: "EURGBP=X",
  GBPJPY: "GBPJPY=X",
  XAUUSD: "GC=F",
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD"
};

const INTERVALS = {
  60: "1m",
  300: "5m",
  900: "15m",
  1800: "30m",
  3600: "1h",
  14400: "1h",
  86400: "1d"
};

function yahooSymbol(display) {
  if (SYMBOLS[display]) return SYMBOLS[display];
  const clean = String(display || "EUR/USD").replace("/", "");
  return SYMBOLS[clean] || "EURUSD=X";
}

function displaySymbol(y) {
  const entry = Object.entries(SYMBOLS).find(([, v]) => v === y);
  return entry ? entry[0] : y;
}

async function fetchYahoo(display, timeframe) {
  const symbol = yahooSymbol(display);
  const interval = INTERVALS[Number(timeframe)] || "1m";
  const range = interval === "1d" ? "1y" : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  if (!response.ok) throw new Error(`Public market feed HTTP ${response.status}`);

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error("No market candles returned");

  const q = result.indicators?.quote?.[0] || {};
  const candles = result.timestamp.map((ts, i) => ({
    time: ts,
    open: Number(q.open?.[i]),
    high: Number(q.high?.[i]),
    low: Number(q.low?.[i]),
    close: Number(q.close?.[i]),
    volume: Number(q.volume?.[i] || 0)
  })).filter(c => [c.open,c.high,c.low,c.close].every(Number.isFinite));

  const meta = result.meta || {};
  const price = Number(meta.regularMarketPrice ?? candles.at(-1)?.close);
  return { candles: candles.slice(-180), price, time: Math.floor(Date.now()/1000), symbol: displaySymbol(symbol) };
}

wss.on("connection", ws => {
  let display = "EURUSD";
  let timeframe = 60;
  let timer = null;

  const send = obj => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  send({ type: "status", provider: "public market data", connected: true });

  const load = async () => {
    try {
      const data = await fetchYahoo(display, timeframe);
      send({ type: "candles", candles: data.candles, symbol: display });
      if (Number.isFinite(data.price)) send({ type: "tick", symbol: displaySymbol(yahooSymbol(display)), price: data.price, time: data.time });
      send({ type: "status", provider: "public market data", connected: true });
    } catch (err) {
      send({ type: "error", message: `Market data unavailable: ${err.message}` });
    }
  };

  ws.on("message", raw => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "load") {
        display = String(msg.symbol || "EUR/USD").replace("/", "");
        timeframe = Number(msg.timeframe) || 60;
        clearInterval(timer);
        load();
        timer = setInterval(load, 15000);
      }
    } catch (_) {
      send({ type: "error", message: "Invalid request" });
    }
  });

  ws.on("close", () => clearInterval(timer));
});

app.get("/health", (req, res) => res.json({ ok: true, provider: "public market data" }));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
