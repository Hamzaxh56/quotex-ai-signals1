# Quotex Signal Analyzer — free market-data setup (Render)

This version uses real provider responses and fails closed when a feed is missing. It does not invent prices or signals when no supported feed is available.

## Data sources

- **Crypto:** Binance public spot candles through Binance's market-data-only endpoint. No API key is required for public candles.
- **Forex and supported US stocks:** Twelve Data via the Node server. Create a free API key and store it as a Render environment variable named `TWELVEDATA_API_KEY`.
- **Commodities:** The interface offers common symbols, but access depends on Twelve Data's current plan and symbol coverage. If the free plan does not include a symbol, the app displays the provider error instead of fabricating data.
- **Quotex OTC:** Not included. Quotex does not publish an official public API; OTC quotes are broker-specific. A third-party feed would need to be reviewed and integrated separately. This app does not log into Quotex or place trades.

Free tiers and symbol availability can change. Check your provider dashboard for current limits. Twelve Data free-plan requests are limited; the dashboard refreshes every 2 seconds, so do not leave many tabs open or you may use up your quota. Binance candles are polled through the backend and do not need credentials.

## Deploy on Render

This build needs a **Node Web Service**, not a Static Site, because API keys must remain on the server.

1. Extract this ZIP.
2. Upload the **contents** of `quotex-render-ready` to the root of a GitHub repository (`server.js`, `package.json`, `index.html`, `render.yaml`, and `.env.example` at root).
3. In Render choose **New + → Web Service**, connect the repository, and deploy with:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
4. In the Render service, open **Environment → Add Environment Variable**.
   - Key: `TWELVEDATA_API_KEY`
   - Value: your private Twelve Data key
   Save changes and redeploy. Never paste the key into `index.html`, GitHub, or a public chat.
5. Visit `/api/health` on the deployed service. `twelveDataConfigured` should be `true` after the key is added.

If your current Render project is a **Static Site**, it cannot run `server.js`. Create a new **Web Service** from the same repository, or change the service type by creating a new service. Keep the old site until the new service works.

## Supported intervals

Binance supports the chart intervals accepted by its API. Twelve Data interval and instrument support depends on its API plan; some interval/symbol combinations may return a provider error. The app reports that error rather than silently substituting another timeframe.

The UI's indicator score is not a measured probability or guaranteed win rate. The app does not guarantee 90% accuracy. Candle data cannot accurately settle sub-minute expiries if the selected candle interval is longer than the expiry. Verify outcomes using a sufficiently granular matching feed before relying on performance statistics.
