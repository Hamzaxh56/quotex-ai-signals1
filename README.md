# Quotex-Style Live Market V6 — Free Data Edition

This version removes the OTCharts and Twelve Data API-key requirement.

## Free public market data

The default provider is **biquote**, a public market-data API that documents read-only REST endpoints without an API key or signup. It provides live ticks and OHLC candles for supported Forex, crypto, metals and index/CFD instruments.

Important: these prices are **not Quotex OTC prices**. They come from a separate market-data feed, so they can differ from prices shown by Quotex. This project does not connect to or trade a Quotex account.

The app polls the public latest-price endpoint every few seconds and loads OHLC candles from the public endpoint. No paid subscription or secret key is required.

## Render

Use:

**Build Command**
```text
npm install
```

**Start Command**
```text
npm start
```

**Root Directory:** leave empty.

No environment variable is required. The included `.env.example` is only for optional settings.

## Local run

Requires Node.js 18+.

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Supported app symbols

EUR/USD, GBP/USD, USD/JPY, AUD/USD, EUR/GBP, GBP/JPY, XAU/USD, BTC/USD and ETH/USD, subject to the public feed having current data.

## Signal engine

The BUY/SELL display is an indicator score based on EMA trend, RSI, candle body and recent momentum. It is **not a guaranteed probability or win rate** and should not be treated as financial advice.

The Buy/Sell buttons in this project are UI only. They do not place trades or access a Quotex account.
