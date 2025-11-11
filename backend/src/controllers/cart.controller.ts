import { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { invalidateJsonCache, loadProducts } from '../utils/jsonData.js';
import { connectToVMC, sendToVMC } from '../websocket/vmc.js';

type CartItem = { productId: number; quantity: number };
type CartState = { items: Map<number, number> };

const cart: CartState = {
  items: new Map<number, number>(),
};

const DATA_FILE_PATH = (() => {
  const customPath = process.env.JSON_DB_PATH;
  if (customPath) return path.resolve(process.cwd(), customPath);
  return path.resolve(process.cwd(), '..', 'data.json');
})();

export const getCart = (req: Request, res: Response) => {
  const items = Array.from(cart.items.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
  res.json({ items });
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body as { productId?: number; quantity?: number };
    if (!productId || !Number.isFinite(productId) || !quantity || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid productId or quantity' });
    }
    // Check against available shelf_life_count (acts as stock)
    const raw = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    const data = JSON.parse(raw) as Array<Record<string, any>>;
    const idx = data.findIndex(p => Number(p.product_id) === Number(productId));
    if (idx === -1) {
      return res.status(404).json({ error: `Product ${productId} not found` });
    }
    const available = Number(data[idx].shelf_life_count ?? 0);
    if (!Number.isFinite(available)) {
      return res.status(400).json({ error: `Invalid stock for ${productId}` });
    }
    const inCart = cart.items.get(productId) ?? 0;
    if (inCart + quantity > available) {
      return res.status(400).json({
        error: 'INSUFFICIENT_STOCK',
        message: `Cannot add more than available stock`,
        productId,
        available,
        inCart,
        requested: quantity
      });
    }
    cart.items.set(productId, inCart + quantity);
    return res.json({ ok: true, items: Array.from(cart.items.entries()).map(([pid, q]) => ({ productId: pid, quantity: q })) });
  } catch (error) {
    console.error('addToCart error:', error);
    return res.status(500).json({ error: 'Failed to add to cart' });
  }
};

export const clearCart = (req: Request, res: Response) => {
  cart.items.clear();
  res.json({ ok: true });
};

// Step 1: Prepare checkout - returns order summary, no stock modification
export const prepareCheckout = async (req: Request, res: Response) => {
  try {
    const products = await loadProducts();
    const items = Array.from(cart.items.entries()).map(([productId, quantity]) => {
      const p = products.find(pp => pp.id === productId);
      return {
        productId,
        quantity,
        name: p?.name ?? '',
        price: p?.price ?? 0,
        amount: (p?.price ?? 0) * quantity
      };
    });
    const total = items.reduce((s, it) => s + it.amount, 0);
    const orderId = `order_${Date.now()}`;
    res.json({ ok: true, orderId, items, total });
  } catch (error) {
    console.error('prepareCheckout error:', error);
    res.status(500).json({ error: 'Failed to prepare checkout' });
  }
};

// Step 2: Confirm checkout - decrement stock and clear cart (called on payment success)
export const confirmCheckout = async (req: Request, res: Response) => {
  try {
    // Load current file
    const raw = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    const data = JSON.parse(raw) as Array<Record<string, any>>;

    // Build index by product_id
    const idToIndex = new Map<number, number>();
    data.forEach((p, idx) => {
      const idNum = Number(p.product_id);
      if (Number.isFinite(idNum)) idToIndex.set(idNum, idx);
    });

    // Validate availability against shelf_life_count
    for (const [productId, qty] of cart.items.entries()) {
      const idx = idToIndex.get(productId);
      if (idx === undefined) {
        return res.status(400).json({ error: `Product ${productId} not found` });
      }
      const item = data[idx];
      const current = Number(item.shelf_life_count ?? 0);
      if (!Number.isFinite(current) || current < qty) {
        return res.status(400).json({ error: `Insufficient stock for ${productId}`, productId, available: current, requested: qty });
      }
    }

    // Deduct quantities
    for (const [productId, qty] of cart.items.entries()) {
      const idx = idToIndex.get(productId)!;
      const item = data[idx];
      const current = Number(item.shelf_life_count ?? 0);
      item.shelf_life_count = Math.max(0, current - qty);
    }

    // Persist file
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    invalidateJsonCache();

    // Build response and vend items list BEFORE clearing the cart
    const entries = Array.from(cart.items.entries());
    const checkedOut = entries.map(([productId, quantity]) => ({ productId, quantity }));
    const vendItems: number[] = [];
    for (const [productId, qty] of entries) {
      for (let i = 0; i < qty; i++) vendItems.push(productId);
    }

    cart.items.clear();

    // Trigger VMC vend
    const vendMessage = { type: 'vend', items: vendItems };
    const sent = sendToVMC(vendMessage);
    if (!sent) {
      // try to connect and send again shortly
      connectToVMC();
      setTimeout(() => {
        try {
          sendToVMC(vendMessage);
        } catch {
          // swallow secondary failure
        }
      }, 1000);
    }

    res.json({ ok: true, checkedOut, vmc: { sent: !!sent, items: vendItems.length } });
  } catch (error) {
    console.error('confirmCheckout error:', error);
    res.status(500).json({ error: 'Confirm checkout failed', message: (error as Error).message });
  }
};


