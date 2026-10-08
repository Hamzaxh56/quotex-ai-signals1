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
// Free/public provider by default. No API key is required.
const PROVIDER = (process.env.DATA_PROVIDER || "biquote").toLowerCase();

app.use(express.static("public"));
app.get("/", (_req, res) => res.sendFile(require("path").join(__dirname, "public", "index.html")));
app.get("/api/config", (_req, res) => {
  res.json({
    provider: PROVIDER,
    live: true,
    note: PROVIDER === "biquote"
      ? "Free public market data. Prices are not Quotex OTC prices."
      : "Configured market-data provider"
  });
});

const clients = new Set();
const state = {
  symbols: [],
  selected: "EURUSD",
  timeframe: 60,
  candles: [],
  latest: null,
  connected: false
};

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const c of clients) {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  }
}

function normalizeCandle(c) {
  return {
    time: Number(c.time ?? c.timestamp ?? c.openTime ?? 0),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: c.volume == null ? null : Number(c.volume)
  };
}

function validateCandles(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map(normalizeCandle)
    .filter(c => Number.isFinite(c.time) && [c.open, c.high, c.low, c.close].every(Number.isFinite))
    .sort((a, b) => a.time - b.time);
}

function intervalFor(tf) {
  return ({
    60: "1m",
    300: "5m",
    900: "15m",
    1800: "30m",
    3600: "1h",
    14400: "4h",
    86400: "1d"
  })[tf] || "1m";
}

async function biquoteCandles(symbol, tf, limit = 180) {
  const u = new URL(`https://biquote.io/api/${encodeURIComponent(symbol)}/ohlc`);
  u.searchParams.set("interval", intervalFor(tf));
  u.searchParams.set("limit", String(Math.min(limit, 1000)));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Free market data HTTP ${r.status}`);
  const j = await r.json();
  return validateCandles(j.bars || []);
}

async function biquoteLatest(symbols) {
  const u = new URL("https://biquote.io/api/latest");
  for (const symbol of symbols) u.searchParams.append("symbols", symbol);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Free market tick HTTP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : (j.items || j.quotes || Object.values(j));
}

async function loadFree(symbol, tf) {
  const candles = await biquoteCandles(symbol, tf);
  if (!candles.length) throw new Error(`No candle data available for ${symbol}`);
  state.candles = candles;
  state.selected = symbol;
  state.timeframe = tf;
  state.connected = true;
  broadcast({ type: "candles", symbol, timeframe: tf, candles });
  broadcast({ type: "status", connected: true, provider: "biquote" });
}

const symbols = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "EURGBP", "GBPJPY", "XAUUSD", "BTCUSD", "ETHUSD"];

let pollBusy = false;
async function pollFreeTicks() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const quotes = await biquoteLatest(symbols);
    let found = false;
    for (const q of quotes) {
      const symbol = String(q.symbol || q.name || "");
      const price = Number(q.mid ?? q.price ?? q.last ?? ((Number(q.bid) + Number(q.ask)) / 2));
      if (!symbol || !Number.isFinite(price)) continue;
      const time = q.timestamp ? Date.parse(q.timestamp) / 1000 : Date.now() / 1000;
      if (symbol === state.selected) {
        state.latest = { symbol, price, time };
        found = true;
        broadcast({ type: "tick", symbol, price, time });
      }
    }
    if (!found && state.selected) {
      // The selected symbol may be closed. Keep the last candle price visible.
      const last = state.candles[state.candles.length - 1];
      if (last) {
        state.latest = { symbol: state.selected, price: last.close, time: Date.now() / 1000 };
        broadcast({ type: "tick", ...state.latest });
      }
    }
    state.connected = true;
    broadcast({ type: "status", connected: true, provider: "biquote" });
  } catch (e) {
    state.connected = false;
    broadcast({ type: "status", connected: false, provider: "biquote" });
    broadcast({ type: "error", message: `Free market feed: ${e.message}` });
  } finally {
    pollBusy = false;
  }
}

wss.on("connection", socket => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: "status", connected: state.connected, provider: PROVIDER }));

  socket.on("message", async raw => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === "load") {
        const tf = Number(m.timeframe || 60);
        const symbol = String(m.symbol || state.selected);
        if (PROVIDER === "biquote") {
          await loadFree(symbol, tf);
        } else {
          throw new Error(`Unsupported DATA_PROVIDER: ${PROVIDER}. Use biquote.`);
        }
      }
      if (m.type === "symbols") {
        socket.send(JSON.stringify({ type: "symbols", symbols }));
      }
    } catch (e) {
      socket.send(JSON.stringify({ type: "error", message: e.message }));
    }
  });
  socket.on("close", () => clients.delete(socket));
});

server.listen(PORT, () => {
  console.log(`V6 running on http://localhost:${PORT}`);
  console.log(`Data provider: ${PROVIDER} (no API key required)`);
});

// Initial data + free public tick polling. No API key or paid account is needed.
if (PROVIDER === "biquote") {
  loadFree(state.selected, state.timeframe)
    .catch(e => console.error(`Initial market load failed: ${e.message}`));
  setInterval(pollFreeTicks, Number(process.env.POLL_MS || 3000));
}
