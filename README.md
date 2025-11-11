# Wendor Vending Machine Simulation

A full-stack simulation of a digital vending/kiosk experience with:
- Backend (Node.js + Express + TypeScript) reading from a local `data.json`
- Frontend (React + Vite + TypeScript) kiosk UI
- VMC (Vending Machine Controller) mock (Express + WebSocket)

Key features
- Products are sourced from `data.json` (used as the database)
- Kiosk UI with category tabs: All, Drinks, Snacks, Bowls, Salads (derived from `meta_data.product_type`)
- Trays: 1 tray per page (6 items per tray), pagination persists the category via `?category=` and `?page=`
- Each product shows name, price, optional nutrition, and quantity (from `shelf_life_count`)
- Inactive items and items with zero quantity are greyed out (INACTIVE / OUT OF STOCK), cannot be added
- Cart with drawer UI: add items, view totals, clear, and checkout
- Checkout is split into two steps:
  1) Prepare (no stock change)
  2) Confirm (stock decremented in `data.json` and vend request sent to VMC)
- VMC mock provides WebSocket status updates and HTTP endpoints for manual control

Project structure
```
backend/                # Express (TS) API
  src/
    app.ts              # Registers routes and VMC connection
    server.ts           # Server entrypoint
    routes/
      products.routes.ts
      cart.routes.ts
    controllers/
      products.controller.ts
      cart.controller.ts
    utils/
      jsonData.ts       # Loads/transforms data from data.json (with caching)
    websocket/
      vmc.ts            # Backend <-> VMC WebSocket client

frontend/               # React (Vite + TS) UI
  src/
    pages/Products.tsx  # Kiosk screen with category tabs, trays, cart drawer
    components/
      ProductCard.tsx   # Item card with Add to Cart
      ProductCard.css
    services/
      api.ts            # REST API client (products, cart, checkout)
      websocket.ts      # Frontend <-> VMC WebSocket client

vmc/                    # VMC Mock (Express + ws)
  server.js             # WebSocket + minimal HTTP API

data.json               # Local JSON DB (array of products)
```

Prerequisites
- Node.js 18+ recommended

Environment
- Backend: `VITE` not required; uses `.env` optional
  - `JSON_DB_PATH` (optional): override path to `data.json` (default: project root `../data.json` from `backend/`)
- Frontend:
  - `VITE_API_BASE` (optional): API base (default: `http://localhost:3001`)
  - `VITE_VMC_WS` (optional): VMC WebSocket URL (default: `ws://localhost:3002`)

Install and run (in separate terminals)
1) VMC (mock)
```
cd vmc
npm i
node server.js
# HTTP: http://localhost:3002
# WS:   ws://localhost:3002
```

2) Backend (Express + TS)
```
cd backend
npm i
npm run dev
# REST: http://localhost:3001
```

3) Frontend (React + Vite)
```
cd frontend
npm i
npm run dev
# App: http://localhost:5173 (or 517x if occupied)
```

Data source
- `data.json` in the project root is used as the local database for products
- Important fields:
  - `product_id` (string): unique ID
  - `product_name` (string)
  - `product_price` (number|string)
  - `image` (string|JSON-string): image URL/path
  - `is_active` (boolean): inactive items are greyed out
  - `shelf_life_count` (number): used as stock/quantity
  - `product_type` (string): used to derive category (drinks/bowls/salads/snacks)

API overview (Backend)
Products
- GET `/api/products` → `[Product]`

Cart
- GET `/api/cart` → `{ items: [{ productId, quantity }] }`
- POST `/api/cart/add` `{ productId, quantity }`
  - Validates against `shelf_life_count` and current cart quantity
- POST `/api/cart/clear` → `{ ok: true }`
- POST `/api/cart/checkout/prepare` → `{ ok, orderId, items, total }`
  - No stock change
- POST `/api/cart/checkout/confirm` → `{ ok, checkedOut, vmc }`
  - Deducts from `shelf_life_count` and triggers VMC vend

VMC mock
- WebSocket: `ws://localhost:3002` broadcasts:
  - `status` (vending updates) / `vend-complete` (when done)
- HTTP:
  - GET `/` → landing JSON
  - GET `/status` → current vending status
  - POST `/vend` `{ items: number[] }` → start vending cycle

Frontend UX
- Category tabs (All, Drinks, Snacks, Bowls, Salads) persist in URL: `?category=`
- Pagination is per-tray (6 items): `?page=`
- Quantity rules:
  - Items with `shelf_life_count` = 0 show OUT OF STOCK and can’t be added
  - Add to Cart disabled when current cart quantity reaches `shelf_life_count`
- Cart drawer:
  - Shows items and totals
  - Checkout opens a mock payment modal
  - Pay Now calls backend confirm step, reduces stock in `data.json`, and triggers VMC vend

Customization
- Replace the mock payment modal with your gateway and call:
  - `POST /api/cart/checkout/prepare` before redirect
  - `POST /api/cart/checkout/confirm` on successful payment callback

Notes
- This is a simulation: image URLs and product fields can be inconsistent. The code includes safe image parsing and placeholders.
- The VMC and the backend are decoupled via WebSocket; you can run them independently for testing.

Scripts
Backend
```
npm run dev      # tsx watch
npm run build    # tsc build
npm start        # node dist/server.js
```

Frontend
```
npm run dev
npm run build
npm run preview
```

VMC
```
node server.js
```

License
This repository is provided for demo/simulation purposes.


