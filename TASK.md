# 🧩 TASK.md

## 🎯 Objective
Develop a **Full-Stack Vending Machine Simulation** system with:
- **Backend:** Node.js + Express + PostgreSQL (REST API + WebSocket)
- **Frontend:** React (Vite or CRA)
- **VMC:** WebSocket-based Vending Machine Controller mock  

The goal is to simulate real-world vending operations end-to-end — from UI interaction to real-time machine updates.

---

## 🧰 1. Backend Setup

### Boilerplate
- **Tech Stack:** Node.js (Express 5, ES Modules), TypeScript preferred  
- **Database:** PostgreSQL  
- **Middleware:** `cors`, `morgan`, `dotenv`  
- **Folder:** `/backend`

### Environment
Create `.env` file:
```
PORT=3001
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASS=...
DB_NAME=testdb
```
Default backend port: **3001**

### Example API Route
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/products` | Fetch list of products |
| `GET` | `/health` | Health check |
| `GET` | `/hello` | Returns greeting and timestamp |

**Example Response:**
```json
{
  "message": "Hello from Wendor Backend!",
  "timestamp": "2025-11-11T10:00:00.000Z"
}
```

### Database Configuration
Hosted database: **TestDB**

**Table:** `products`
| Field | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Product ID |
| name | VARCHAR(255) | Product name |
| price | DECIMAL(10,2) | Product price |
| image_url | TEXT | Product image URL |
| category | VARCHAR(100) | Product category |
| meta_data | JSONB | Extra product details |

**Sample Data:**
```sql
INSERT INTO products (name, price, image_url, category, meta_data)
VALUES
('Coca-Cola', 1.99, 'https://picsum.photos/200', 'Drinks', '{"volume":"330ml"}'),
('Snickers', 1.49, 'https://picsum.photos/201', 'Snacks', '{"weight":"50g"}'),
('Pepsi', 1.89, 'https://picsum.photos/202', 'Drinks', '{"volume":"330ml"}');
```

### Backend Scripts
| Script | Description |
|--------|-------------|
| `npm start` | Run server once |
| `npm run dev` | Run with watch/auto-restart |

### Folder Structure
```
backend/
  ├─ src/
  │  ├─ config/db.ts
  │  ├─ routes/products.routes.ts
  │  ├─ controllers/products.controller.ts
  │  ├─ websocket/
  │  │   └─ vmc.ts
  │  ├─ app.ts
  │  └─ server.ts
  ├─ package.json
  ├─ .env
  └─ README.md
```

---

## 🧩 2. Database (PostgreSQL)
Use the provided **TestDB** credentials ("Online Creds").  
The backend should query from the `products` table and serve data via `/api/products`.  

---

## ⚛️ 3. Frontend Setup

### Boilerplate
- **Tech Stack:** React 19 + Vite 7 + TypeScript  
- **Folder:** `/frontend`

### Environment Variables
Create `.env` or `.env.local`:
```
VITE_API_BASE=http://localhost:3001
VITE_VMC_WS=ws://localhost:3002
```
Access in code via:  
```ts
import.meta.env.VITE_API_BASE
```

### Features
- **Route:** `/products` — Display all items fetched from backend (`/api/products`)
- Each item card includes a **"Pay"** button:
  - Calls `/api/pay` endpoint (mock)
  - Sends WebSocket request to VMC to trigger vending simulation
- **Requirement:** Product page **must not re-render** during vending updates.

### Scripts
| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (hot reload) |
| `npm run build` | Type check + build |
| `npm run preview` | Serve production build |
| `npm run lint` | Run ESLint |

### Folder Structure
```
frontend/
  ├─ src/
  │  ├─ components/ProductCard.tsx
  │  ├─ pages/Products.tsx
  │  ├─ services/api.ts
  │  ├─ services/websocket.ts
  │  ├─ App.tsx
  │  └─ main.tsx
  ├─ vite.config.ts
  ├─ tsconfig.json
  └─ README.md
```

---

## ⚙️ 4. Vending Machine Controller (VMC)

### Overview
The **VMC Mock Server** provides a WebSocket-based vending simulation API for real-time updates.

**Default Port:** `3002`

Connect via:
```js
const ws = new WebSocket('ws://localhost:3002');
```

### Supported WebSocket Commands

#### 1. `vend`
Accepts an array of item codes and begins vending simulation.
```json
{
  "type": "vend",
  "items": [101, 202, 105]
}
```
✅ Success Response:
```json
{
  "type": "vend-response",
  "success": true,
  "message": "Vending started",
  "items": [101, 202, 105],
  "estimatedTime": 5000
}
```
❌ Error Response (busy):
```json
{
  "type": "vend-response",
  "success": false,
  "message": "Vending machine is currently busy",
  "currentItems": [101, 202, 105]
}
```

#### 2. `status`
Requests current vending progress.
```json
{
  "type": "status"
}
```
Example Response:
```json
{
  "type": "status",
  "status": "vending",
  "items": [101, 202, 105],
  "elapsedTime": 2340,
  "message": "Vending in progress",
  "timestamp": "2025-11-11T10:30:00.000Z"
}
```

---

## 🧪 Example Interaction Flow
1. Frontend sends `POST /api/pay`
2. Backend emits WebSocket message `{ type: "vend", items: [...] }` to VMC  
3. VMC responds with `"vend-response"`  
4. Backend listens for updates and forwards vending status to frontend  
5. Frontend displays real-time vending progress without re-rendering the entire list  

---

## 🚀 Run Instructions

### Start Backend
```bash
cd backend
npm install
npm run dev
```

### Start VMC
```bash
cd vmc
npm install
npm run dev
```

### Start Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit:
- Backend API → http://localhost:3001  
 
- Frontend UI → http://localhost:5173/products  

---

## 🌟 Extended Goals (Optional)
- 📈 **Connect with WebSocket VMC** → Using WebSocket Mock VMC integration
- 🕒 **Screen Saver / Idle Mode** → Trigger after 2 min inactivity  
- 💳 **Payment Gateway Mock** → Razorpay/Stripe integration  
- 💅 **Enhanced UI/UX** → Animations, responsive layout, smooth transitions  
- 📈 **Analytics** → Log vending events and user actions  


---

## ✅ Deliverables
1. `/backend` → Node.js + PostgreSQL REST API  
2. `/frontend` → React app fetching and vending products  
3. `/vmc` → WebSocket mock for vending simulation  
4. End-to-end vending demo flow working  
5. Optional features (bonus) implemented  
