# MAET Terminal Frontend

Next.js frontend for the trading terminal. Deploy this directory only; the Python backend is not deployed to Vercel.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Vercel Settings

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `.next`
- Development Command: `next dev --port $PORT`
