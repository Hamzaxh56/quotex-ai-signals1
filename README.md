# Quotex-Style Live Market V6

This version is built to fix the main problem in the previous prototype: **no simulated prices**.

## What is real

### Quotex feed mode (recommended if you want Quotex-style OTC prices)
Set:
- `DATA_PROVIDER=otcharts`
- `OTCHARTS_API_KEY=...`

OTCharts is an independent, unofficial read-only market-data provider. It says it records/serves the Quotex book and provides candles/live prices. It is **not affiliated with Quotex** and is not an official Quotex API.

The browser never receives your API key. The Node server keeps it in `.env`.

### Real institutional market mode
Set:
- `DATA_PROVIDER=twelvedata`
- `TWELVE_DATA_API_KEY=...`

This uses Twelve Data for live market data. These prices can differ from Quotex's own server quote.

## Important

There is no public official Quotex developer API. Therefore this project cannot truthfully claim that it is using Quotex's private server feed unless you use an authorized/available data source that provides the Quotex book.

The BUY/SELL buttons in this project are UI only. They do **not** place trades or access a Quotex account.

## Run

Requires Node.js 18+.

```bash
npm install
cp .env.example .env
# edit .env
npm start
```

Open:
http://localhost:3000

## Environment

See `.env.example`.

For Quotex feed mode:
```env
DATA_PROVIDER=otcharts
OTCHARTS_API_KEY=YOUR_KEY
```

For real institutional FX/crypto data:
```env
DATA_PROVIDER=twelvedata
TWELVE_DATA_API_KEY=YOUR_KEY
```

## Timeframes

Official candle timeframes are provider-dependent. In Quotex/OTCharts mode, use:
1m, 2m, 3m, 5m, 10m, 15m, 30m, 1h, 4h, 1d.

The old 0.5s/1s/5s labels should not be presented as exchange/venue OHLC candles. The app can use tick data for short signal timing, but true OHLC candles at those intervals are not guaranteed by the provider.

## Signal engine

The signal engine is intentionally transparent:
- EMA trend
- RSI
- candle body/wick
- recent momentum
- agreement score

The displayed percentage is a model score, **not a guaranteed probability or win rate**.
