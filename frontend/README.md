# Frontend (React + Vite + TypeScript)

React 19 + Vite 7 + TypeScript frontend for the Wendor vending machine simulation system.

## Tech Stack
- React 19
- Vite 7 (ESBuild + Rollup hybrid)
- TypeScript 5
- React Router DOM
- ESLint (flat config) + React Hooks & Refresh plugins

## Scripts
| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (hot reload) |
| `npm run build` | Type check then production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint over the project |

## Getting Started
```bash
cd frontend
npm install    # if not already
npm run dev
```
Dev server (default): http://localhost:5173

## Environment Variables
Create a `.env.local` file for custom values:
```
VITE_API_BASE=http://localhost:3001
VITE_VMC_WS=ws://localhost:3002
```
Access in code via `import.meta.env.VITE_API_BASE`.

## Build
```bash
npm run build
npm run preview   # serve dist build
```

## Project Structure
```
frontend/
  src/
    components/
      ProductCard.tsx      # Product card component
      ProductCard.css
    pages/
      Products.tsx         # Products listing page
      Products.css
    services/
      api.ts              # API client
      websocket.ts        # VMC WebSocket client
    App.tsx               # Root component with routing
    main.tsx              # App bootstrap
    index.css
    App.css
  public/                 # Static assets
  vite.config.ts
  tsconfig*.json
  eslint.config.js
```

## Features
- **Products Page** (`/products`): Displays all products from the backend
- **Product Cards**: Each card shows product details with a "Pay" button
- **Real-time Vending**: WebSocket integration with VMC for live vending status updates
- **Progress Tracking**: Visual progress bar during vending operations
- **No Re-renders**: Product list doesn't re-render during vending updates (optimized state management)

## Linking to Backend/VMC
Ensure:
- Backend runs on port 3001
- VMC mock server runs on port 3002
- Set environment variables as shown above

## Usage Flow
1. User views products on `/products` page
2. User clicks "Pay" button on a product
3. Frontend sends POST request to `/api/pay`
4. Backend triggers vending via VMC WebSocket
5. Frontend receives real-time status updates via WebSocket
6. Progress bar shows vending progress
7. Vending completes and UI updates accordingly
