# Backend API (Express + TypeScript + PostgreSQL)

Full-stack backend for the Wendor vending machine simulation system.

## Tech Stack
- Node.js (ES Modules)
- Express 5
- TypeScript
- PostgreSQL (pg)
- WebSocket (ws) for VMC integration
- Middleware: cors, morgan, dotenv

## Environment
Create a `.env` file with the following variables:
```
PORT=3001
DB_HOST=your_db_host
DB_PORT=5432
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=testdb
VMC_WS_URL=ws://localhost:3002
```

Default port: 3001

## Data Source (JSON-backed)
The backend reads product data from the project-level `data.json` file.  
No external database is required.

### Custom Path
If you need to point to a different JSON file, set the `JSON_DB_PATH` environment variable **relative to the backend folder**:
```
JSON_DB_PATH=../path/to/another-data.json
```

### JSON Structure
The file must export an array of product objects containing at least:
- `product_id`
- `product_name`
- `product_price`

All additional fields are preserved in the `meta_data` payload returned by the API.

## Scripts
| Script | Description |
|--------|-------------|
| `npm start` | Run compiled server (requires build) |
| `npm run dev` | Run server with watch / auto-restart (tsx) |
| `npm run build` | Compile TypeScript to JavaScript |

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API root, lists endpoints |
| GET | `/hello` | Returns greeting + timestamp |
| GET | `/health` | Health check |
| GET | `/api/products` | Fetch all products (backed by `data.json`) |
| GET | `/api/products/:id` | Fetch product by ID |
| POST | `/api/pay` | Process payment and trigger vending |

### Example Response `/hello`
```json
{
  "message": "Hello from Wendor Backend!",
  "timestamp": "2025-11-11T10:00:00.000Z"
}
```

### Example Request `/api/pay`
```json
{
  "productId": 1,
  "items": [1]
}
```

## Run Locally
```bash
cd backend
npm install   # (first time only)
npm run dev   # Development mode with auto-reload
```

Then visit: http://localhost:3001/hello

## Folder Structure
```
backend/
  src/
    config/
      db.ts              # PostgreSQL connection
    routes/
      products.routes.ts # Product routes
    controllers/
      products.controller.ts # Product controllers
    websocket/
      vmc.ts            # VMC WebSocket client
    app.ts              # Express app setup
    server.ts           # Server entry point
  dist/                 # Compiled JavaScript (generated)
  package.json
  tsconfig.json
  .env
  README.md
```

## VMC Integration
The backend connects to the VMC WebSocket server to trigger vending operations. When a payment is processed via `/api/pay`, the backend sends a vend command to the VMC server.
