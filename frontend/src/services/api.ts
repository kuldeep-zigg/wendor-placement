const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export interface Product {
  id: number;
  name: string;
  price: number;
  image_url: string;
  category: string;
  meta_data?: Record<string, any>;
}

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/products`);
    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format: expected an array');
    }
    return data;
  } catch (error) {
    console.error('Error fetching products:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to backend at ${API_BASE}. Please ensure the backend server is running.`);
    }
    throw error;
  }
};

export const processPayment = async (productId: number, items: number[]): Promise<any> => {
  const response = await fetch(`${API_BASE}/api/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, items }),
  });
  if (!response.ok) {
    throw new Error('Failed to process payment');
  }
  return response.json();
};

export interface CartItem {
  productId: number;
  quantity: number;
}

export interface CartResponse {
  items: CartItem[];
}

export const getCart = async (): Promise<CartResponse> => {
  const response = await fetch(`${API_BASE}/api/cart`);
  if (!response.ok) {
    throw new Error('Failed to fetch cart');
  }
  return response.json();
};

export const addToCart = async (productId: number, quantity: number): Promise<CartResponse | { ok: boolean }> => {
  const response = await fetch(`${API_BASE}/api/cart/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, quantity }),
  });
  if (!response.ok) {
    throw new Error('Failed to add to cart');
  }
  return response.json();
};

export const clearCart = async (): Promise<{ ok: boolean }> => {
  const response = await fetch(`${API_BASE}/api/cart/clear`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to clear cart');
  }
  return response.json();
};

export const prepareCheckout = async (): Promise<{ ok: boolean; orderId: string; items: Array<{productId:number; quantity:number; name:string; price:number; amount:number}>; total: number }> => {
  const response = await fetch(`${API_BASE}/api/cart/checkout/prepare`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to prepare checkout');
  }
  return response.json();
};

export const confirmCheckout = async (): Promise<{ ok: boolean; checkedOut?: CartItem[] }> => {
  const response = await fetch(`${API_BASE}/api/cart/checkout/confirm`, { method: 'POST' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to confirm checkout');
  }
  return response.json();
};

