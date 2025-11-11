import { useState } from 'react';
import type { Product } from '../services/api';
import { addToCart } from '../services/api';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  itemNumber: number;
  onVendingStart?: (productId: number) => void;
  onVendingComplete?: (productId: number) => void;
  isVending?: boolean;
  vendingProgress?: number;
  isActive?: boolean;
  quantity?: number | null;
  onAddedToCart?: () => void;
  cartQty?: number;
}

export default function ProductCard({
  product,
  itemNumber,
  onVendingStart: _onVendingStart,
  onVendingComplete: _onVendingComplete,
  isVending = false,
  vendingProgress = 0,
  isActive = true,
  quantity = null,
  onAddedToCart,
  cartQty = 0,
}: ProductCardProps) {
  const [error, setError] = useState<string | null>(null);

  // Calculate discount (show discount for items with price > 100)
  // For demo: items over ₹100 get a 15% discount
  const hasDiscount = product.price > 100;
  const discountPercentage = hasDiscount ? 15 : 0;
  const discountedPrice = product.price;
  const originalPrice = hasDiscount 
    ? Math.round(product.price / (1 - discountPercentage / 100))
    : product.price;

  // Extract nutritional info from meta_data
  const calories = product.meta_data?.calories;
  const weight = product.meta_data?.weight;
  const unitOfWeight = product.meta_data?.unit_of_weight || 'Gram';
  const unitOfMeasurement = product.meta_data?.unit_of_measurement;
  
  // Build nutritional info string
  let nutritionalInfo: string | null = null;
  if (calories !== null && calories !== undefined) {
    nutritionalInfo = `${calories} Kcal`;
    if (weight !== null && weight !== undefined) {
      nutritionalInfo += ` | ${weight} ${unitOfWeight}`;
    } else if (unitOfMeasurement) {
      nutritionalInfo += ` | ${unitOfMeasurement}`;
    }
  } else if (weight !== null && weight !== undefined) {
    nutritionalInfo = `${weight} ${unitOfWeight}`;
  } else if (unitOfMeasurement) {
    nutritionalInfo = unitOfMeasurement;
  }

  // Format image URL - handle blob URLs and invalid images
  const getImageUrl = (): string => {
    if (!product.image_url || product.image_url.trim() === '') {
      return 'https://via.placeholder.com/400x400/F44336/FFFFFF?text=Product';
    }
    
    const url = product.image_url.trim();
    
    // Handle blob URLs
    if (url.startsWith('blob:')) {
      return 'https://via.placeholder.com/400x400/F44336/FFFFFF?text=Product';
    }
    
    // Handle JSON string images
    if (url.startsWith('{') && url.endsWith('}')) {
      try {
        const parsed = JSON.parse(url) as { preview?: string; path?: string };
        if (parsed.preview && typeof parsed.preview === 'string') {
          return parsed.preview;
        }
        if (parsed.path && typeof parsed.path === 'string') {
          if (parsed.path.startsWith('blob:')) {
            return 'https://via.placeholder.com/400x400/F44336/FFFFFF?text=Product';
          }
          return parsed.path;
        }
      } catch {
        // Not valid JSON, continue
      }
    }
    
    // Validate URL format
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Fallback to placeholder
    return 'https://via.placeholder.com/400x400/F44336/FFFFFF?text=Product';
  };

  const [adding, setAdding] = useState(false);
  const handleAddToCart = async () => {
    if (adding || isVending || !isActive) return;
    if (quantity !== null && cartQty >= quantity) {
      setError('Max quantity reached for this item');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await addToCart(product.id, 1);
      if (onAddedToCart) onAddedToCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  // Determine unavailable reason
  const isUnavailable = !isActive;
  const unavailableReason = quantity !== null && quantity === 0 ? 'OUT OF STOCK' : !isActive ? 'INACTIVE' : null;

  return (
    <div className={`kiosk-product-card ${isVending ? 'vending' : ''} ${isUnavailable ? 'inactive' : ''}`}>
      <div className="item-number">{String(itemNumber).padStart(2, '0')}</div>
      {isUnavailable && unavailableReason && (
        <div className="inactive-badge">{unavailableReason}</div>
      )}
      <div className="product-image-container">
        <img 
          src={getImageUrl()} 
          alt={product.name}
          className="product-image"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400/F44336/FFFFFF?text=Product';
          }}
        />
        {isVending && (
          <div className="vending-overlay">
            <div className="vending-progress">
              <div 
                className="progress-bar" 
                style={{ width: `${vendingProgress}%` }}
              />
            </div>
            <p className="vending-text">Vending...</p>
          </div>
        )}
        {isUnavailable && !isVending && (
          <div className="inactive-overlay" />
        )}
      </div>
      <div className="product-details">
        <h3 className="product-name">{product.name}</h3>
        {nutritionalInfo && (
          <p className="nutritional-info">{nutritionalInfo}</p>
        )}
        <p className="quantity-info">
          {quantity !== null ? (
            <>
              Qty: <span className={quantity === 0 ? 'quantity-zero' : 'quantity-available'}>{quantity}</span>
            </>
          ) : (
            <span className="quantity-unknown">Qty: N/A</span>
          )}
        </p>
        <div className="price-section">
          {hasDiscount && (
            <span className="original-price">₹{Math.round(originalPrice)}</span>
          )}
          <span className="current-price">₹{Math.round(discountedPrice)}</span>
        </div>
        <div className="actions-row">
          <button
            className="add-to-cart-button"
            onClick={handleAddToCart}
            disabled={adding || isUnavailable || (quantity !== null && cartQty >= quantity)}
            title={isUnavailable ? (unavailableReason || 'Unavailable') : 'Add to Cart'}
          >
            {isUnavailable
              ? (unavailableReason || 'UNAVAILABLE')
              : (quantity !== null && cartQty >= quantity)
              ? 'MAX REACHED'
              : (adding ? 'ADDING...' : 'ADD TO CART')}
          </button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}
