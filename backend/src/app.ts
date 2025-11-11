import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import productsRoutes from './routes/products.routes.js';
import cartRoutes from './routes/cart.routes.js';
import { connectToVMC, sendToVMC } from './websocket/vmc.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.get('/hello', (req: Request, res: Response) => {
  res.json({
    message: 'Hello from Wendor Backend!',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Wendor Backend',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);

// Payment endpoint - triggers vending
app.post('/api/pay', async (req: Request, res: Response) => {
  try {
    const { productId, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Send vend command to VMC
    const vendMessage = {
      type: 'vend',
      items: items
    };

    const sent = sendToVMC(vendMessage);

    if (!sent) {
      // If not connected, try to connect first
      connectToVMC();
      // Wait a bit and try again
      setTimeout(() => {
        sendToVMC(vendMessage);
      }, 1000);
    }

    res.json({
      success: true,
      message: 'Payment processed, vending initiated',
      items: items
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Wendor Backend API',
    version: '1.0.0',
    endpoints: {
      hello: '/hello',
      health: '/health',
      products: '/api/products',
      cart: {
        get: 'GET /api/cart',
        add: 'POST /api/cart/add',
        clear: 'POST /api/cart/clear',
        checkoutPrepare: 'POST /api/cart/checkout/prepare',
        checkoutConfirm: 'POST /api/cart/checkout/confirm'
      },
      pay: 'POST /api/pay'
    }
  });
});

// Initialize VMC connection
connectToVMC((message) => {
  console.log('VMC Update:', message);
});

export default app;

