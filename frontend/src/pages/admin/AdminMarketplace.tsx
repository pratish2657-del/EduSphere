import { load as loadCashfree } from "@cashfreepayments/cashfree-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Download,
  Store,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./admin-marketplace.css";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type AdminProfile = {
  institution_id?: number;
  institution_name?: string;
  profile_photo_url?: string | null;
};

type MarketplaceProduct = {
  product_id: number;
  seller_id: number;
  seller_name: string | null;
  institution_id: number;
  institution_name: string | null;
  name: string;
  description: string | null;
  preview_image_path?: string | null;
  category: string | null;
  product_type: "DIGITAL" | "PHYSICAL" | string;
  condition_type: string | null;
  price: number | string;
  quantity: number;
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
};

type MarketplaceResponse = {
  count: number;
  products: MarketplaceProduct[];
};

type CartItem = {
  cart_item_id: number;
  product_id: number;
  quantity: number;
  seller_id: number;
  seller_name: string | null;
  name: string;
  description: string | null;
  category: string | null;
  product_type: string;
  condition_type: string | null;
  price: number | string;
  available_quantity: number;
  is_active: boolean | number;
  subtotal: number | string;
};

type CartResponse = {
  cart_id: number;
  count: number;
  items: CartItem[];
  total: number | string;
};

type MarketplaceDigitalFile = {
  attachment_id: number;
  product_id: number;
  product_name: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
};

type MarketplaceOrder = {
  order_id: number;
  institution_id: number;
  total_amount: number | string;
  status: string;
  created_at: string;
  updated_at: string;
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_address?: string | null;
  digital_files?: MarketplaceDigitalFile[];
};

type OrdersResponse = {
  count: number;
  orders: MarketplaceOrder[];
};

type SellerOrder = {
  order_item_id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  unit_price: number | string;
  quantity: number;
  subtotal: number | string;
  buyer_id: number;
  buyer_name: string | null;
  order_status: string;
  created_at: string;
};

type SellerOrdersResponse = {
  count: number;
  orders: SellerOrder[];
};

type PaymentResponse = {
  payment_id: number;
  order_id: number;
  gateway: string;
  gateway_order_id: string;
  amount: number | string;
  currency: string;
  status: string;
  platform_fee_percent?: number | string;
  platform_fee_amount?: number | string;
  seller_net_amount?: number | string;
  payment_session_id: string;
};


async function api<T>(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      String(data?.detail || data?.message || `Request failed (${response.status})`)
    );
  }

  return data as T;
}

function money(value: number | string) {
  const amount = Number(value);
  return `₹${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function dateTime(value: string) {
  if (!value) return value;

  /*
   * Marketplace backend timestamps are normalized to UTC when no timezone
   * suffix is present, then explicitly displayed in IST.
   */
  const raw = String(value).trim();

  const hasTimezone =
    /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(raw);

  const normalized =
    !hasTimezone &&
    /^\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}/.test(raw)
      ? `${raw.replace(" ", "T")}Z`
      : raw;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminMarketplace() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [orders, setOrders] = useState<OrdersResponse | null>(null);
  const [sales, setSales] = useState<SellerOrdersResponse | null>(null);

  const [panel, setPanel] = useState<"shop" | "sell" | "orders" | "sales">(
    "shop"
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    const response = await api<AdminProfile | { profile?: AdminProfile }>(
      "/profile/admin"
    );
    const data: AdminProfile | null =
      response && typeof response === "object" && "profile" in response
        ? response.profile ?? null
        : (response as AdminProfile | null);
    setProfile(data ?? null);
  }, []);

  const loadProducts = useCallback(async () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (productType) params.set("product_type", productType);
    if (search.trim()) params.set("search", search.trim());

    const query = params.toString();
    const data = await api<MarketplaceResponse>(
      `/marketplace/${query ? `?${query}` : ""}`
    );
    setProducts(data.products ?? []);
  }, [category, productType, search]);

  const loadCart = useCallback(async () => {
    const data = await api<CartResponse>("/marketplace/cart");
    setCart(data);
  }, []);

  const loadOrders = useCallback(async () => {
    const data = await api<OrdersResponse>("/marketplace/orders");
    setOrders(data);
  }, []);

  const loadSales = useCallback(async () => {
    const data = await api<SellerOrdersResponse>("/marketplace/seller/orders");
    setSales(data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([loadProfile(), loadProducts(), loadCart()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the marketplace."
      );
    } finally {
      setLoading(false);
    }
  }, [loadCart, loadProducts, loadProfile]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.category).filter(Boolean))
      ) as string[],
    [products]
  );

  const addToCart = async (productId: number) => {
    setBusy(true);
    setNotice("");
    try {
      await api(`/marketplace/cart?product_id=${productId}&quantity=1`, {
        method: "POST",
      });
      await loadCart();
      setNotice("Added to cart.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to add to cart.");
    } finally {
      setBusy(false);
    }
  };

  const updateCart = async (productId: number, quantity: number) => {
    setBusy(true);
    try {
      await api(
        `/marketplace/cart/items/${productId}?quantity=${encodeURIComponent(
          quantity
        )}`,
        { method: "PUT" }
      );
      await loadCart();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to update cart.");
    } finally {
      setBusy(false);
    }
  };

  const removeCartItem = async (productId: number) => {
    setBusy(true);
    try {
      await api(`/marketplace/cart/items/${productId}`, { method: "DELETE" });
      await loadCart();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to remove item.");
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    const institutionId = profile?.institution_id;

    if (!institutionId) {
      setNotice("Your Admin Profile does not have institution information.");
      return;
    }

    if (!cart?.items.length) {
      setNotice("Your cart is empty.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const checkoutData = await api<{ order_id: number }>(
        `/marketplace/checkout?institution_id=${institutionId}`,
        { method: "POST" }
      );

      const orderId = Number(checkoutData.order_id);
      if (!Number.isFinite(orderId)) {
        throw new Error("Marketplace order ID was not returned.");
      }

      const payment = await api<PaymentResponse>("/marketplace/payments/", {
        method: "POST",
        body: JSON.stringify({ order_id: orderId }),
      });

      if (!payment.payment_session_id) {
        throw new Error("Cashfree payment session was not returned by the server.");
      }

      const cashfree = await loadCashfree({ mode: "sandbox" });
      if (!cashfree) {
        throw new Error("Cashfree checkout could not be loaded.");
      }

      await cashfree.checkout({
        paymentSessionId: payment.payment_session_id,
        redirectTarget: "_modal",
      });

      // Cashfree checkout can close before the server has finalized the order.
      // The backend remains authoritative; the buyer can refresh orders if needed.
      try {
        await api("/marketplace/payments/verify", {
          method: "POST",
          body: JSON.stringify({
            order_id: orderId,
            gateway_order_id: payment.gateway_order_id,
          }),
        });
        setNotice(`Payment verification completed. Order #${orderId} is confirmed.`);
        await Promise.all([loadCart(), loadOrders()]);
      } catch (err) {
        setNotice(
          err instanceof Error
            ? err.message
            : "Payment verification is still pending. Please refresh your orders."
        );
      } finally {
        setBusy(false);
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to start marketplace payment."
      );
      setBusy(false);
    }
  };

  const openPanel = async (
    next: "shop" | "sell" | "orders" | "sales"
  ) => {
    setPanel(next);

    if (next === "orders") {
      try {
        await loadOrders();
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Unable to load orders.");
      }
    }

    if (next === "sales") {
      try {
        await loadSales();
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Unable to load sales.");
      }
    }
  };

  const stats = {
    listings: products.length,
    cartItems: cart?.count ?? 0,
    purchases: orders?.count ?? 0,
    sales: sales?.count ?? 0,
  };

  return (
    <div className="admin-marketplace-page">
      <header className="admin-marketplace-header">
        <div>
          <span className="admin-marketplace-eyebrow">CAMPUS COMMERCE</span>
          <h1>Marketplace</h1>
          <p>
            Use EduSphere Marketplace exactly like Student and Professor
            accounts — buy, sell and manage your own marketplace activity.
          </p>
        </div>

        <div className="admin-marketplace-header-actions">
          <button onClick={() => openPanel("orders")}>
            <Package size={16} /> Orders
          </button>
          <button onClick={() => openPanel("sales")}>
            <WalletCards size={16} /> My Sales
          </button>
          <button
            className="admin-marketplace-cart"
            onClick={() => {
              setCartOpen(true);
              loadCart();
            }}
          >
            <ShoppingCart size={16} /> Cart
            <span>{stats.cartItems}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="admin-marketplace-alert">
          <span>{error}</span>
          <button onClick={loadAll}>Retry</button>
        </div>
      )}

      {notice && (
        <div className="admin-marketplace-notice">
          <span>{notice}</span>
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <section className="admin-marketplace-stats">
        <div><span>Listings</span><strong>{loading ? "…" : stats.listings}</strong></div>
        <div><span>Cart Items</span><strong>{stats.cartItems}</strong></div>
        <div><span>Purchases</span><strong>{stats.purchases}</strong></div>
        <div><span>Sales</span><strong>{stats.sales}</strong></div>
      </section>

      <nav className="admin-marketplace-tabs">
        <button className={panel === "shop" ? "active" : ""} onClick={() => openPanel("shop")}>
          <Store size={16} /> Buyer Mode
        </button>
        <button className={panel === "sell" ? "active" : ""} onClick={() => openPanel("sell")}>
          <WalletCards size={16} /> Seller Mode
        </button>
        <button className={panel === "orders" ? "active" : ""} onClick={() => openPanel("orders")}>
          <Package size={16} /> Orders
        </button>
        <button className={panel === "sales" ? "active" : ""} onClick={() => openPanel("sales")}>
          <WalletCards size={16} /> My Sales
        </button>
      </nav>

      {panel === "shop" && (
        <section>
          <div className="admin-marketplace-toolbar">
            <div className="admin-marketplace-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
              />
            </div>

            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>

            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="">All types</option>
              <option value="DIGITAL">Digital</option>
              <option value="PHYSICAL">Physical</option>
            </select>

            <button className="admin-marketplace-refresh" onClick={loadProducts} disabled={loading}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="admin-marketplace-empty">
              <RefreshCw className="spin" size={28} />
              <strong>Loading marketplace</strong>
              <span>Fetching active listings from EduSphere.</span>
            </div>
          ) : products.length === 0 ? (
            <div className="admin-marketplace-empty">
              <Store size={30} />
              <strong>No active listings</strong>
              <span>No products match your current filters.</span>
            </div>
          ) : (
            <div className="admin-marketplace-grid">
              {products.map((product) => {
                const price = Number(product.price);
                return (
                  <article className="admin-marketplace-product" key={product.product_id}>
                    <button
                      className="admin-marketplace-product-main"
                      onClick={() => setSelected(product)}
                    >
                      {product.preview_image_path && (
                        <img
                          src={`${API_BASE_URL}/marketplace/${product.product_id}/preview`}
                          alt={`${product.name} preview`}
                          loading="lazy"
                          className="admin-marketplace-product-preview"
                        />
                      )}
                      <div className="admin-marketplace-product-icon">
                        {product.product_type === "DIGITAL" ? <BookOpen size={23} /> : <Package size={23} />}
                      </div>
                      <div className="admin-marketplace-badges">
                        <span>{product.product_type}</span>
                        {product.category && <small>{product.category}</small>}
                      </div>
                      <h3>{product.name}</h3>
                      <p>{product.description || "No description provided."}</p>
                      <div className="admin-marketplace-seller">
                        <UserRound size={13} /> {product.seller_name || "EduSphere seller"}
                      </div>
                      <div className="admin-marketplace-product-bottom">
                        <strong>{Number.isFinite(price) ? money(price) : "₹0.00"}</strong>
                        <span>
                          {product.product_type === "DIGITAL"
                            ? "Digital delivery"
                            : `${product.quantity} available`}
                        </span>
                      </div>
                    </button>
                    <button
                      className="admin-marketplace-add"
                      onClick={() => addToCart(product.product_id)}
                      disabled={busy || product.quantity <= 0}
                    >
                      <ShoppingCart size={15} />
                      {product.quantity <= 0 ? "Out of stock" : "Add to cart"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {panel === "sell" && (
        <section className="admin-marketplace-seller-panel">
          <div>
            <span className="admin-marketplace-eyebrow">SELLER SPACE</span>
            <h2>Sell on EduSphere</h2>
            <p>
              Admin accounts can sell marketplace products just like Students
              and Professors. Your listings are tied to your own account.
            </p>
          </div>
          <button className="admin-marketplace-primary" onClick={() => setFormOpen(true)}>
            <Plus size={17} /> Create Listing
          </button>
        </section>
      )}

      {panel === "orders" && (
        <section className="admin-marketplace-list-panel">
          <div className="admin-marketplace-section-head">
            <div>
              <span className="admin-marketplace-eyebrow">BUYER ACTIVITY</span>
              <h2>My Orders</h2>
            </div>
            <button onClick={loadOrders}><RefreshCw size={15} /> Refresh</button>
          </div>
          {!orders?.orders.length ? (
            <div className="admin-marketplace-empty">
              <Package size={30} />
              <strong>No purchases yet</strong>
              <span>Your marketplace orders will appear here.</span>
            </div>
          ) : (
            <div className="admin-marketplace-order-list">
              {orders.orders.map((order) => {
                const digitalFiles = order.digital_files || [];
                const canDownload = ["CONFIRMED", "PROCESSING", "COMPLETED"].includes(
                  String(order.status || "").toUpperCase()
                );

                return (
                  <div className="admin-marketplace-order" key={order.order_id}>
                    <div>
                      <span>ORDER #{order.order_id}</span>
                      <strong>{money(order.total_amount)}</strong>
                      <small>
                        {dateTime(order.created_at)}
                        {order.payment_method
                          ? ` · Payment: ${order.payment_method}`
                          : ""}
                      </small>

                      {canDownload && digitalFiles.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginTop: 10,
                          }}
                        >
                          <span
                            style={{
                              color: "#a5b4fc",
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                            }}
                          >
                            DIGITAL FILES — READY TO DOWNLOAD
                          </span>

                          {digitalFiles.map((file) => (
                            <a
                              key={file.attachment_id}
                              href={`${API_BASE_URL}/marketplace/attachments/${file.attachment_id}/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                width: "fit-content",
                                maxWidth: "100%",
                                border: "1px solid #334155",
                                borderRadius: 9,
                                padding: "8px 11px",
                                background: "#0f172a",
                                color: "#e2e8f0",
                                textDecoration: "none",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              <Download size={14} />
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Download {file.file_name}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}

                      {canDownload && digitalFiles.length === 0 && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 10,
                            color: "#94a3b8",
                            fontSize: 11,
                          }}
                        >
                          Digital file is not available yet.
                        </span>
                      )}
                    </div>
                    <b>{order.status}</b>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {panel === "sales" && (
        <section className="admin-marketplace-list-panel">
          <div className="admin-marketplace-section-head">
            <div>
              <span className="admin-marketplace-eyebrow">SELLER ACTIVITY</span>
              <h2>My Sales</h2>
            </div>
            <button onClick={loadSales}><RefreshCw size={15} /> Refresh</button>
          </div>
          {!sales?.orders.length ? (
            <div className="admin-marketplace-empty">
              <WalletCards size={30} />
              <strong>No sales yet</strong>
              <span>Purchases of your products will appear here.</span>
            </div>
          ) : (
            <div className="admin-marketplace-order-list">
              {sales.orders.map((order) => (
                <div className="admin-marketplace-order" key={order.order_item_id}>
                  <div>
                    <span>ORDER #{order.order_id}</span>
                    <strong>{order.product_name}</strong>
                    <small>
                      {order.quantity} × {money(order.unit_price)} · Buyer: {order.buyer_name || "Buyer"}
                    </small>
                  </div>
                  <b>{order.order_status}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {selected && (
        <div className="admin-marketplace-overlay" onClick={() => setSelected(null)}>
          <div className="admin-marketplace-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-marketplace-modal-head">
              <div>
                <span className="admin-marketplace-eyebrow">{selected.product_type}</span>
                <h2>{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <p>{selected.description || "No description provided."}</p>
            <div className="admin-marketplace-detail-grid">
              <div><span>Price</span><strong>{money(selected.price)}</strong></div>
              <div><span>Seller</span><strong>{selected.seller_name || "EduSphere seller"}</strong></div>
              <div><span>Category</span><strong>{selected.category || "Uncategorized"}</strong></div>
              <div><span>Condition</span><strong>{selected.condition_type || "—"}</strong></div>
              <div><span>Availability</span><strong>{selected.product_type === "DIGITAL" ? "Digital" : `${selected.quantity} available`}</strong></div>
              <div><span>Institution</span><strong>{selected.institution_name || profile?.institution_name || "Institution"}</strong></div>
            </div>
            <div className="admin-marketplace-modal-footer">
              <button
                className="admin-marketplace-primary"
                onClick={() => {
                  addToCart(selected.product_id);
                  setSelected(null);
                }}
                disabled={busy || selected.quantity <= 0}
              >
                <ShoppingCart size={16} /> Add to cart
              </button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && cart && (
        <div className="admin-marketplace-overlay" onClick={() => setCartOpen(false)}>
          <div className="admin-marketplace-modal cart" onClick={(e) => e.stopPropagation()}>
            <div className="admin-marketplace-modal-head">
              <div>
                <span className="admin-marketplace-eyebrow">BUYER CART</span>
                <h2>Your Cart</h2>
              </div>
              <button onClick={() => setCartOpen(false)}><X size={18} /></button>
            </div>

            <div className="admin-marketplace-cart-list">
              {!cart.items.length ? (
                <div className="admin-marketplace-empty">
                  <ShoppingCart size={30} />
                  <strong>Cart is empty</strong>
                  <span>Add a marketplace product to begin checkout.</span>
                </div>
              ) : (
                cart.items.map((item) => (
                  <div className="admin-marketplace-cart-item" key={item.cart_item_id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.seller_name || "Seller"} · {money(item.price)}</span>
                    </div>
                    <div className="admin-marketplace-quantity">
                      <button onClick={() => updateCart(item.product_id, Math.max(1, item.quantity - 1))} disabled={busy}>
                        <Minus size={13} />
                      </button>
                      <b>{item.quantity}</b>
                      <button
                        onClick={() => updateCart(item.product_id, Math.min(item.available_quantity, item.quantity + 1))}
                        disabled={busy || item.quantity >= item.available_quantity}
                      >
                        <Plus size={13} />
                      </button>
                      <button onClick={() => removeCartItem(item.product_id)} disabled={busy}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="admin-marketplace-cart-footer">
              <div>
                <span>Total</span>
                <strong>{money(cart.total)}</strong>
                <small className="marketplace-fee-note">5% EduSphere platform fee is deducted from seller earnings.</small>
              </div>
              <button
                className="admin-marketplace-primary"
                onClick={checkout}
                disabled={busy || !cart.items.length}
              >
                <WalletCards size={16} />
                {busy ? "Processing..." : "Pay securely with UPI"}
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && profile?.institution_id && (
        <ProductForm
          institutionId={profile.institution_id}
          onClose={() => setFormOpen(false)}
          onCreated={async () => {
            setFormOpen(false);
            setPanel("shop");
            await loadProducts();
          }}
        />
      )}

      <button
        className="admin-marketplace-back"
        onClick={() => navigate("/app/admin")}
      >
        ← Dashboard
      </button>
      <AIChatbot />
    </div>
  );
}

function ProductForm({
  institutionId,
  onClose,
  onCreated,
}: {
  institutionId: number;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] =
    useState<"PHYSICAL" | "DIGITAL">("PHYSICAL");
  const [condition, setCondition] = useState("USED");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");

    try {
      const numericPrice = Number(price);
      const numericQuantity = Number(quantity);

      if (!name.trim()) throw new Error("Product name is required.");
      if (!Number.isFinite(numericPrice) || numericPrice < 0)
        throw new Error("Enter a valid non-negative price.");
      if (!Number.isInteger(numericQuantity) || numericQuantity < 0)
        throw new Error("Enter a valid non-negative quantity.");

      if (!previewFile) {
        throw new Error("A preview photo is required for every marketplace listing.");
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(previewFile.type)) {
        throw new Error("Preview photo must be JPG, PNG or WEBP.");
      }

      if (previewFile.size > 5 * 1024 * 1024) {
        throw new Error("Preview photo cannot exceed 5 MB.");
      }

      if (productType === "DIGITAL" && !file) {
        throw new Error("A digital product requires a downloadable file.");
      }

      const created = await api<{ product_id: number }>("/marketplace/", {
        method: "POST",
        body: JSON.stringify({
          institution_id: institutionId,
          name: name.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          product_type: productType,
          condition_type: productType === "DIGITAL" ? "DIGITAL" : condition,
          price: numericPrice,
          quantity: numericQuantity,
        }),
      });

      if (productType === "DIGITAL" && file) {
        await api(`/marketplace/${created.product_id}/attachments`, {
          method: "POST",
          body: (() => {
            const form = new FormData();
            form.append("file", file);
            return form;
          })(),
        });
      }

      const previewForm = new FormData();
      previewForm.append("file", previewFile as File);

      await api(`/marketplace/${created.product_id}/preview`, {
        method: "POST",
        body: previewForm,
      });

      await onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create listing."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-marketplace-overlay" onClick={onClose}>
      <div className="admin-marketplace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-marketplace-modal-head">
          <div>
            <span className="admin-marketplace-eyebrow">SELLER MODE</span>
            <h2>Create Listing</h2>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="admin-marketplace-form-error">{error}</div>}

        <div className="admin-marketplace-form">
          <label>
            Product name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering drawing set" />
          </label>

          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the product..." />
          </label>

          <div className="admin-marketplace-form-grid">
            <label>
              Category
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Books, Notes, Electronics..." />
            </label>

            <label>
              Product type
              <select value={productType} onChange={(e) => setProductType(e.target.value as "PHYSICAL" | "DIGITAL")}>
                <option value="PHYSICAL">Physical</option>
                <option value="DIGITAL">Digital</option>
              </select>
            </label>

            <label>
              Condition
              <select value={condition} disabled={productType === "DIGITAL"} onChange={(e) => setCondition(e.target.value)}>
                <option value="NEW">New</option>
                <option value="USED">Used</option>
                <option value="DIGITAL">Digital</option>
              </select>
            </label>

            <label>
              Price (INR)
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </label>

            <label>
              Quantity
              <input type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
          </div>

                    <label className="admin-marketplace-file">
            <Upload size={19} />
            <strong>Preview photo</strong>
            <span>JPG, PNG or WEBP · max 5 MB · required</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
            />
            {previewFile && <small>Selected: {previewFile.name}</small>}
          </label>

{productType === "DIGITAL" && (
            <label className="admin-marketplace-file">
              <Upload size={19} />
              <strong>Digital file</strong>
              <span>PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, WEBP or TXT</span>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          )}
        </div>

        <div className="admin-marketplace-modal-footer">
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button className="admin-marketplace-primary" onClick={submit} disabled={busy}>
            {busy ? "Creating..." : "Create Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}
