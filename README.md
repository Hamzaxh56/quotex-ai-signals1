# Quotex AI Signal Generator — All Market UI

This project recreates the supplied dashboard concept as a responsive web UI.

Included:
- Multiple forex, crypto and gold market cards
- Timeframes from 0.5s through 1d in the interface
- Animated candlestick chart
- CALL / PUT signal panel
- 90%+ confidence filter display
- Live-signal and history tables
- Mobile responsive layout

IMPORTANT:
The candles/signals in this package are simulated front-end data. They are NOT a connection to Quotex and do not execute trades. For genuine live candles, replace the simulation in `app.js` with a lawful/authorized market-data WebSocket/API for each asset class. Do not use the displayed confidence as a guarantee of outcomes.
