import { Request, Response } from 'express';
import { getProductFromJson, loadProducts } from '../utils/jsonData.js';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const products = await loadProducts();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: 'Failed to load products from data.json',
      message:
        error instanceof Error ? error.message : 'Unknown error while reading local data source',
    });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const productId = Number.parseInt(id, 10);

    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await getProductFromJson(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found in data.json' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      error: 'Failed to load product from data.json',
      message:
        error instanceof Error ? error.message : 'Unknown error while reading local data source',
    });
  }
};

