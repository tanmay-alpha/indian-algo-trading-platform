# LinkedIn Post Draft

## Short Version

I built MAET Terminal, a personal PAPER-mode market analytics workstation for Indian NSE markets.

It uses FastAPI, Next.js, TypeScript, WebSocket, Angel One SmartAPI, C++17, pybind11, and a Python fallback indicator engine. The project helped me learn event-driven architecture, broker data integration, realtime frontend state, technical indicators, offline backtesting, deployment on Vercel/Render, and security basics.

It is a learning/demo project only: no real orders, no financial advice, and live trading is intentionally locked.

GitHub: https://github.com/tanmay-alpha/indian-algo-trading-platform  
Live demo: https://indian-algo-trading-platform.vercel.app/

## Longer Version

I recently finished MAET Terminal, a personal market analytics and execution terminal for Indian NSE markets.

The project started as a way to learn full-stack systems around trading infrastructure. It now includes a FastAPI backend, Next.js + TypeScript frontend, WebSocket market/status streaming, Angel One SmartAPI integration, TickBus/EventBus pipeline, CandleStore, C++17 technical indicator core, pybind11 bridge, Python fallback engine, indicator routes, chart overlays, and offline strategy backtesting.

I also deployed the frontend on Vercel and the backend on Render, then worked through real deployment issues like WebSocket state, backend cold starts, CORS, environment variables, and safe status handling.

This was built with heavy AI assistance as a pair-programming and learning tool. I guided the architecture, reviewed outputs, tested deployments, and learned the system through iterative phases.

Important scope note: this is PAPER/demo mode only. It does not provide financial advice, does not support production trading, and live trading is intentionally disabled/locked.

GitHub: https://github.com/tanmay-alpha/indian-algo-trading-platform  
Live demo: https://indian-algo-trading-platform.vercel.app/

## Hashtags

#FastAPI #NextJS #TypeScript #WebSocket #Python #Cpp #pybind11 #TradingTechnology #SystemDesign #LearningInPublic #OpenSource #FinTech
