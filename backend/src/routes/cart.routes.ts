import { Router } from 'express';
import { addToCart, clearCart, getCart, prepareCheckout, confirmCheckout } from '../controllers/cart.controller.js';

const router = Router();

router.get('/', getCart);
router.post('/add', addToCart);
router.post('/clear', clearCart);
router.post('/checkout/prepare', prepareCheckout);
router.post('/checkout/confirm', confirmCheckout);

export default router;


