import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchProducts, getCart, clearCart, prepareCheckout, confirmCheckout } from '../services/api';
import type { Product, CartItem } from '../services/api';
import { vmcWebSocket } from '../services/websocket';
import type { VMCStatus } from '../services/websocket';
import ProductCard from '../components/ProductCard';
import './Products.css';

interface VendingState {
  productId: number;
  progress: number;
  startTime: number;
  estimatedTime: number;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendingStates, setVendingStates] = useState<Map<number, VendingState>>(new Map());
  const [searchParams, setSearchParams] = useSearchParams();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  
  // Get page from URL parameter, default to 1
  const pageParam = searchParams.get('page');
  const currentPageFromUrl = useMemo(() => {
    if (!pageParam) return 1;
    const parsed = parseInt(pageParam, 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }, [pageParam]);
  
  const setCurrentPage = useCallback((page: number) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      sp.set('page', page.toString());
      return sp;
    });
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  // Fetch products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data = await fetchProducts();
        setProducts(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products');
        console.error('Error loading products:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error refreshing products:', err);
    }
  }, []);

  // Cart handlers
  const refreshCart = useCallback(async () => {
    try {
      setCartLoading(true);
      const res = await getCart();
      setCartItems(res.items ?? []);
      setCartError(null);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Failed to load cart');
    } finally {
      setCartLoading(false);
    }
  }, []);

  useEffect(() => {
    // load cart initially
    refreshCart();
  }, [refreshCart]);

  const handleClearCart = useCallback(async () => {
    try {
      setCartLoading(true);
      await clearCart();
      await refreshCart();
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Failed to clear cart');
    } finally {
      setCartLoading(false);
    }
  }, [refreshCart]);

  const [paying, setPaying] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<{ orderId: string; total: number } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleCheckout = useCallback(async () => {
    try {
      setCartLoading(true);
      const prep = await prepareCheckout();
      setPaymentSummary({ orderId: prep.orderId, total: prep.total });
      setShowPaymentModal(true);
      setCartError(null);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Failed to initiate payment');
    } finally {
      setCartLoading(false);
    }
  }, []);

  const handlePaymentSuccess = useCallback(async () => {
    try {
      setPaying(true);
      await confirmCheckout();
      setShowPaymentModal(false);
      await refreshCart();
      await refreshProducts();
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Failed to confirm payment');
    } finally {
      setPaying(false);
    }
  }, [refreshCart, refreshProducts]);

  // Compute cart totals
  const cartTotals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    for (const item of cartItems) {
      totalQty += item.quantity;
      const p = products.find(pr => pr.id === item.productId);
      if (p) totalAmount += p.price * item.quantity;
    }
    return { totalQty, totalAmount };
  }, [cartItems, products]);

  // Handle VMC WebSocket messages
  useEffect(() => {
    vmcWebSocket.connect();

    const unsubscribe = vmcWebSocket.onMessage((data: VMCStatus) => {
      console.log('VMC Status Update:', data);

      if (data.type === 'vend-response' && data.success) {
        if (data.items && data.items.length > 0) {
          const productId = data.items[0];
          const estimatedTime = data.estimatedTime || 5000;
          
          setVendingStates((prev) => {
            const newMap = new Map(prev);
            newMap.set(productId, {
              productId,
              progress: 0,
              startTime: Date.now(),
              estimatedTime,
            });
            return newMap;
          });
        }
      } else if (data.type === 'status' && data.status === 'vending') {
        if (data.items && data.items.length > 0 && data.elapsedTime !== undefined) {
          const productId = data.items[0];
          const elapsed = data.elapsedTime;
          const estimatedTime = 5000;
          const progress = Math.min((elapsed / estimatedTime) * 100, 100);

          setVendingStates((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(productId);
            newMap.set(productId, {
              productId,
              progress,
              startTime: existing?.startTime || Date.now() - elapsed,
              estimatedTime,
            });
            return newMap;
          });
        }
      } else if (data.type === 'vend-complete') {
        if (data.vendedItems && data.vendedItems.length > 0) {
          const productId = data.vendedItems[0];
          
          setVendingStates((prev) => {
            const newMap = new Map(prev);
            if (newMap.has(productId)) {
              newMap.set(productId, {
                ...newMap.get(productId)!,
                progress: 100,
              });
            }
            return newMap;
          });

          setTimeout(() => {
            setVendingStates((prev) => {
              const newMap = new Map(prev);
              newMap.delete(productId);
              return newMap;
            });
          }, 1000);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleVendingStart = useCallback((_productId: number) => {
    // Vending state is handled via WebSocket
  }, []);

  const handleVendingComplete = useCallback((_productId: number) => {
    // Vending completion is handled via WebSocket
  }, []);

  // Constants for pagination (must be before any conditional returns)
  const ITEMS_PER_TRAY = 6; // 2 rows × 3 columns
  const ITEMS_PER_PAGE = ITEMS_PER_TRAY; // 1 tray per page

  // Show all products but identify inactive ones and check quantity - must be before any conditional returns
  const allProducts = useMemo(() => {
    return products.map(p => {
      const isActive = p.meta_data?.is_active !== false; // true if active, false if explicitly inactive
      // Quantity comes from shelf_life_count as per data.json; also consider common aliases if present
      const quantity =
        (p.meta_data?.shelf_life_count as unknown) ??
        p.meta_data?.quantity ??
        p.meta_data?.qty ??
        p.meta_data?.stock ??
        p.meta_data?.available_quantity ??
        p.meta_data?.stock_quantity ??
        null;
      const quantityNum = quantity !== null && quantity !== undefined ? Number(quantity) : null;
      const hasQuantity = quantityNum !== null && !isNaN(quantityNum) && quantityNum >= 0;
      // Available if: active AND (no quantity data OR quantity > 0)
      // Unavailable if: inactive OR (has quantity AND quantity === 0)
      const isAvailable = isActive && (!hasQuantity || quantityNum > 0);
      // Normalise product_type for categorisation
      const productTypeRaw = (p.meta_data?.product_type ?? p.meta_data?.type ?? p.meta_data?.category_name ?? '') as string;
      const productType = typeof productTypeRaw === 'string' ? productTypeRaw.toLowerCase().trim() : '';
      
      return {
        ...p,
        isActive,
        quantity: quantityNum,
        isAvailable, // Available for purchase (active AND quantity > 0 if quantity exists)
        productType,
      };
    });
  }, [products]);

  // Categories (tabs)
  const CATEGORIES = ['all', 'drinks', 'snacks', 'bowls', 'salads'] as const;
  type Category = typeof CATEGORIES[number];
  const categoryParam = (searchParams.get('category') ?? 'all').toLowerCase();
  const selectedCategory: Category = (CATEGORIES.includes(categoryParam as Category) ? categoryParam : 'all') as Category;
  const setSelectedCategory = (cat: Category) => {
    setSearchParams({ page: '1', category: cat });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Map productType to our categories (basic contains matching)
  const mapTypeToCategory = (type: string): Category => {
    if (!type) return 'snacks';
    if (type.includes('drink') || type.includes('beverage') || type.includes('juice')) return 'drinks';
    if (type.includes('bowl')) return 'bowls';
    if (type.includes('salad')) return 'salads';
    return 'snacks';
  };

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return allProducts;
    return allProducts.filter(p => mapTypeToCategory((p as typeof p & { productType?: string }).productType ?? '') === selectedCategory);
  }, [allProducts, selectedCategory]);

  // Calculate total pages (1 tray per page) and validate current page (must be before any conditional returns)
  const TOTAL_PAGES = useMemo(() => {
    return Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  }, [filteredProducts.length, ITEMS_PER_PAGE]);

  const validPage = useMemo(() => {
    if (TOTAL_PAGES === 0) return 1;
    return Math.max(1, Math.min(currentPageFromUrl, TOTAL_PAGES));
  }, [currentPageFromUrl, TOTAL_PAGES]);
  
  // Get products for current tray (1 tray per page) - must be before any conditional returns
  const startIndex = useMemo(() => Math.max(0, (validPage - 1) * ITEMS_PER_PAGE), [validPage, ITEMS_PER_PAGE]);
  const endIndex = useMemo(() => Math.min(startIndex + ITEMS_PER_PAGE, filteredProducts.length), [startIndex, ITEMS_PER_PAGE, filteredProducts.length]);
  const trayProducts = useMemo(() => {
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, startIndex, endIndex]);

  // Tray number equals page number - must be before conditional returns
  const trayNumber = useMemo(() => validPage, [validPage]);

  // Item numbering continues across pages (not reset) - must be before conditional returns
  // Page 1 (Tray 1): Items 01-06
  // Page 2 (Tray 2): Items 07-12
  // Page 3 (Tray 3): Items 13-18
  // etc.
  const getItemNumber = useCallback((itemIndex: number): number => {
    return (validPage - 1) * ITEMS_PER_PAGE + itemIndex + 1;
  }, [validPage, ITEMS_PER_PAGE]);

  // Update URL if page is invalid (only when products are loaded and page is out of range)
  // This hook must be called before any conditional returns
  useEffect(() => {
    // Only validate after products have loaded
    if (loading || products.length === 0) return;
    
    // Only update if page is truly out of range
    if (TOTAL_PAGES > 0 && currentPageFromUrl > TOTAL_PAGES) {
      setCurrentPage(TOTAL_PAGES);
    } else if (currentPageFromUrl < 1) {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, products.length, TOTAL_PAGES, setCurrentPage]); // Don't include currentPageFromUrl to prevent loops

  // Now we can do conditional returns AFTER all hooks have been called
  if (loading) {
    return (
      <div className="kiosk-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kiosk-container">
        <div className="error-screen">
          <h2>Error Loading Products</h2>
          <p style={{ marginBottom: '20px', color: '#666', maxWidth: '600px' }}>{error}</p>
          <button 
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchProducts()
                .then(data => {
                  setProducts(data);
                  setError(null);
                })
                .catch(err => {
                  setError(err instanceof Error ? err.message : 'Failed to load products');
                })
                .finally(() => setLoading(false));
            }}
            style={{
              padding: '12px 24px',
              background: '#c62828',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '20px'
            }}
          >
            Retry
          </button>
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#999' }}>
            Backend URL: {import.meta.env.VITE_API_BASE || 'http://localhost:3001'}
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="kiosk-container">
      {/* Header */}
      <header className="kiosk-header">
        <h1 className="brand-name">WENDOR</h1>
        <p className="brand-tagline">Fresh • Fast • Reliable</p>
      </header>

      {/* Category Tabs */}
      <section className="tray-section" style={{ paddingTop: 20, paddingBottom: 0 }}>
        <div className="category-tabs" style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '10px 16px',
                borderRadius: 20,
                border: '2px solid #c62828',
                background: selectedCategory === cat ? '#c62828' : 'white',
                color: selectedCategory === cat ? 'white' : '#c62828',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                cursor: 'pointer'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Tray Section - One tray per page */}
      {trayProducts.length > 0 ? (
        <section className="tray-section">
          <h2 className="tray-title">
            {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} • Tray {trayNumber}
          </h2>
          <div className="tray-grid">
            {trayProducts.map((product, index) => {
              const vendingState = vendingStates.get(product.id);
              const isVending = vendingState !== undefined;
              const progress = vendingState?.progress || 0;
              const productWithStatus = product as typeof product & { 
                isActive?: boolean; 
                isAvailable?: boolean;
                quantity?: number | null;
              };
              const isAvailable = productWithStatus.isAvailable ?? true;
              const quantity = productWithStatus.quantity;
              const inCart = cartItems.find(ci => ci.productId === product.id)?.quantity ?? 0;

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  itemNumber={getItemNumber(index)}
                  onVendingStart={handleVendingStart}
                  onVendingComplete={handleVendingComplete}
                  isVending={isVending}
                  vendingProgress={progress}
                  isActive={isAvailable}
                  quantity={quantity}
                  onAddedToCart={refreshCart}
                  cartQty={inCart}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <section className="tray-section">
          <div className="empty-tray" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '10px', color: '#333' }}>Tray {trayNumber} is Empty</h2>
            <p style={{ color: '#999' }}>No products available in this tray.</p>
          </div>
        </section>
      )}

      {/* No Products Message - Only show if there are no products at all */}
      {filteredProducts.length === 0 && !loading && (
        <section className="tray-section">
          <div className="empty-tray" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '10px', color: '#333' }}>No Products Available</h2>
            <p style={{ color: '#999' }}>There are no products to display for this category.</p>
          </div>
        </section>
      )}

      {/* Pagination */}
      {TOTAL_PAGES > 1 && filteredProducts.length > 0 && (
        <section className="pagination-section">
          <div className="pagination">
            <button
              className="pagination-button"
              onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
              disabled={validPage === 1}
            >
              Previous Tray
            </button>
            <span className="pagination-info">
              Tray {validPage} of {TOTAL_PAGES}
            </span>
            <button
              className="pagination-button"
              onClick={() => setCurrentPage(Math.min(TOTAL_PAGES, validPage + 1))}
              disabled={validPage === TOTAL_PAGES}
            >
              Next Tray
            </button>
          </div>
          <div className="pagination-dots">
            {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`pagination-dot ${validPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
                aria-label={`Go to Tray ${page}`}
                title={`Tray ${page}`}
              />
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '14px', color: '#666' }}>
            Items {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length}
          </p>
        </section>
      )}

      {/* Floating Cart Button */}
      <button
        onClick={() => setCartOpen(true)}
        aria-label="Open cart"
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          background: '#c62828',
          color: 'white',
          border: 'none',
          borderRadius: 28,
          padding: '14px 18px',
          fontWeight: 800,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          zIndex: 9999
        }}
      >
        Cart ({cartTotals.totalQty})
      </button>

      {/* Cart Drawer */}
      {cartOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            height: '100vh',
            width: '360px',
            background: 'white',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.4), -6px 0 16px rgba(0,0,0,0.2)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ padding: 16, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Your Cart</h3>
            <button onClick={() => setCartOpen(false)} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
            {cartLoading ? (
              <p>Loading cart...</p>
            ) : cartItems.length === 0 ? (
              <p style={{ color: '#666' }}>Your cart is empty.</p>
            ) : (
              cartItems.map((ci) => {
                const p = products.find(pr => pr.id === ci.productId);
                return (
                  <div key={ci.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{p?.name ?? `Item #${ci.productId}`}</strong>
                      <span style={{ color: '#999', fontSize: 12 }}>Qty: {ci.quantity}</span>
                    </div>
                    <div style={{ fontWeight: 700 }}>₹{p ? Math.round(p.price * ci.quantity) : '-'}</div>
                  </div>
                );
              })
            )}
            {cartError && <p style={{ color: '#d32f2f', marginTop: 8 }}>{cartError}</p>}
          </div>
          <div style={{ padding: 16, borderTop: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#666' }}>Total Items</span>
              <strong>{cartTotals.totalQty}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ color: '#666' }}>Total Amount</span>
              <strong>₹{Math.round(cartTotals.totalAmount)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={handleClearCart}
                disabled={cartLoading || cartItems.length === 0}
                style={{ padding: '12px', border: '2px solid #c62828', background: 'white', color: '#c62828', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}
              >
                Clear
              </button>
              <button
                onClick={handleCheckout}
                disabled={cartLoading || cartItems.length === 0}
                style={{ padding: '12px', border: 'none', background: '#c62828', color: 'white', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock Payment Modal */}
      {showPaymentModal && paymentSummary && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 11000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ background: 'white', borderRadius: 12, width: 420, maxWidth: '90%', padding: 20, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0 }}>Payment</h3>
            <p style={{ color: '#666' }}>Order: {paymentSummary.orderId}</p>
            <p style={{ fontWeight: 700, fontSize: 18 }}>Amount: ₹{Math.round(paymentSummary.total)}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={paying}
                style={{ padding: 12, background: 'white', border: '2px solid #c62828', color: '#c62828', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentSuccess}
                disabled={paying}
                style={{ padding: 12, background: '#c62828', border: 'none', color: 'white', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}
              >
                {paying ? 'Processing...' : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="kiosk-footer">
        <div className="footer-content">
          <span className="powered-by">Powered By</span>
          <span className="wendor-logo">WENDOR</span>
          <span className="version-info">ID: 2613 v5.0.4</span>
        </div>
      </footer>
    </div>
  );
}
