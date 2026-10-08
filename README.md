# Fix for blank chart

Replace the GitHub repository's `server.js` with the included `server.js`, then commit the change.

The frontend already connects to a WebSocket on the same host. The old server only served static files and never created that WebSocket, so the page loaded but the chart stayed empty.

This server keeps the existing UI and supplies candle/tick data from a public Yahoo Finance market-data endpoint. It requires no API key. Data is not Quotex OTC data.
