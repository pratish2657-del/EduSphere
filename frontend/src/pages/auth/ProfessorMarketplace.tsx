import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Download,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
  Minus,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type MarketplaceProduct = {
  product_id: number;
  seller_id: number;
  seller_name: string | null;
  institution_id: number;
  institution_name: string | null;
  name: string;
  description: string | null;
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

type MarketplaceCartItem = {
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

type MarketplaceCartResponse = {
  cart_id: number;
  count: number;
  items: MarketplaceCartItem[];
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

type MarketplaceOrdersResponse = {
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

type MarketplacePaymentCreateResponse = {
  message: string;
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
  razorpay_key_id: string | null;
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
  theme?: {
    color?: string;
  };
};

type RazorpayInstance = {
  open: () => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}
type ProfessorDashboardResponse = {
  professor?: {
    professor_id?: number;
    user_id?: number;
    full_name?: string;
    email?: string;
    institution_id?: number;
    institution_name?: string;
    institution_code?: string;
    university_code?: string;
  };
};

export default function ProfessorMarketplace() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<ProfessorDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketplace, setMarketplace] = useState<MarketplaceResponse | null>(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [marketplaceCategory, setMarketplaceCategory] = useState("");
  const [marketplaceType, setMarketplaceType] = useState("");
  const [marketplaceCart, setMarketplaceCart] = useState<MarketplaceCartResponse | null>(null);
  const [marketplaceCartOpen, setMarketplaceCartOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] =
    useState<"ONLINE" | "COD">("ONLINE");
  const [shippingAddress, setShippingAddress] = useState("");

  const [marketplaceOrders, setMarketplaceOrders] = useState<MarketplaceOrdersResponse | null>(null);
  const [sellerOrders, setSellerOrders] = useState<SellerOrdersResponse | null>(null);
  const [marketplacePanel, setMarketplacePanel] =
    useState<"shop" | "sell" | "orders" | "sales">("shop");
  const [showProductForm, setShowProductForm] = useState(false);
  const [marketplaceNotice, setMarketplaceNotice] = useState("");
  const [marketplaceBusy, setMarketplaceBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);

  const apiGet = useCallback(async <T,>(endpoint: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(String(data?.detail || data?.message || `Request failed (${response.status})`));
    }
    return data as T;
  }, []);

  const loadProfessorDashboard = useCallback(async () => {
    try {
      const data = await apiGet<ProfessorDashboardResponse>("/professor/dashboard/");
      setDashboard(data);
    } catch (err) {
      setMarketplaceNotice(
        err instanceof Error
          ? err.message
          : "Unable to load professor institution information."
      );
    } finally {
      setLoading(false);
    }
  }, [apiGet]);

  const loadMarketplace = useCallback(async () => {
    setMarketplaceLoading(true);
    setMarketplaceError("");
    try {
      const params = new URLSearchParams();
      if (marketplaceCategory.trim()) params.set("category", marketplaceCategory.trim());
      if (marketplaceType.trim()) params.set("product_type", marketplaceType.trim());
      if (marketplaceSearch.trim()) params.set("search", marketplaceSearch.trim());

      const query = params.toString();
      const data = await apiGet<MarketplaceResponse>(
        `/marketplace/${query ? `?${query}` : ""}`
      );
      setMarketplace(data);
    } catch (err) {
      setMarketplaceError(
        err instanceof Error ? err.message : "Unable to connect to the marketplace."
      );
    } finally {
      setMarketplaceLoading(false);
    }
  }, [apiGet, marketplaceCategory, marketplaceSearch, marketplaceType]);

  const loadMarketplaceCart = useCallback(async () => {
    try {
      setMarketplaceCart(await apiGet<MarketplaceCartResponse>("/marketplace/cart"));
    } catch (err) {
      setMarketplaceNotice(err instanceof Error ? err.message : "Unable to load cart.");
    }
  }, [apiGet]);

  useEffect(() => {
    const items = marketplaceCart?.items ?? [];
    const isAllPhysical =
      items.length > 0 &&
      items.every(
        (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
      );

    if (!isAllPhysical && checkoutPaymentMethod === "COD") {
      setCheckoutPaymentMethod("ONLINE");
    }
  }, [checkoutPaymentMethod, marketplaceCart]);

  const loadMarketplaceOrders = useCallback(async () => {
    try {
      setMarketplaceOrders(await apiGet<MarketplaceOrdersResponse>("/marketplace/orders"));
    } catch (err) {
      setMarketplaceNotice(err instanceof Error ? err.message : "Unable to load orders.");
    }
  }, [apiGet]);

  const loadSellerOrders = useCallback(async () => {
    try {
      setSellerOrders(await apiGet<SellerOrdersResponse>("/marketplace/seller/orders"));
    } catch (err) {
      setMarketplaceNotice(err instanceof Error ? err.message : "Unable to load seller sales.");
    }
  }, [apiGet]);

  const addMarketplaceToCart = useCallback(async (productId: number) => {
    setMarketplaceBusy(true);
    setMarketplaceNotice("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/marketplace/cart?product_id=${encodeURIComponent(productId)}&quantity=1`,
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(data?.detail || data?.message || "Unable to add product to cart."));
      }
      setMarketplaceNotice("Added to cart.");
      await loadMarketplaceCart();
    } catch (err) {
      setMarketplaceNotice(err instanceof Error ? err.message : "Unable to add to cart.");
    } finally {
      setMarketplaceBusy(false);
    }
  }, [apiGet, loadMarketplaceCart]);

  const updateMarketplaceCartItem = useCallback(async (productId: number, quantity: number) => {
    setMarketplaceBusy(true);
    try {
      await fetch(
        `${API_BASE_URL}/marketplace/cart/items/${encodeURIComponent(productId)}?quantity=${encodeURIComponent(quantity)}`,
        { method: "PUT", credentials: "include", headers: { Accept: "application/json" } }
      ).then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(String(data?.detail || data?.message || "Unable to update cart."));
      });
      await loadMarketplaceCart();
    } catch (err) {
      setMarketplaceNotice(err instanceof Error ? err.message : "Unable to update cart.");
    } finally {
      setMarketplaceBusy(false);
    }
  }, [loadMarketplaceCart]);

  const removeMarketplaceCartItem = useCallback(async (productId: number) => {
    setMarketplaceBusy(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/marketplace/cart/items/${encodeURIComponent(productId)}`,
        { method: "DELETE", credentials: "include", headers: { Accept: "application/json" } }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(String(data?.detail || data?.message || "Unable to remove cart item."));
      await loadMarketplaceCart();
    } catch (err) {
      setMarketplaceNotice(err instanceof Error ? err.message : "Unable to remove cart item.");
    } finally {
      setMarketplaceBusy(false);
    }
  }, [loadMarketplaceCart]);

  const checkoutMarketplace = useCallback(async (paymentMethod: "ONLINE" | "COD", deliveryAddress: string) => {
    const institutionId = dashboard?.professor?.institution_id;
    if (!institutionId) {
      setMarketplaceNotice("Your institution information is not available yet.");
      return;
    }
    if (!marketplaceCart?.items.length) {
      setMarketplaceNotice("Your cart is empty.");
      return;
    }

    const hasDigital = marketplaceCart.items.some(
      (item) => String(item.product_type).toUpperCase() === "DIGITAL"
    );
    if (paymentMethod === "COD" && hasDigital) {
      setMarketplaceNotice(
        "Cash on Delivery is available only when every cart item is physical."
      );
      return;
    }
    const hasPhysical = marketplaceCart.items.some(
      (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
    );
    if (hasPhysical && deliveryAddress.trim().length < 10) {
      setMarketplaceNotice("Enter a valid delivery address for physical products.");
      return;
    }

    setMarketplaceBusy(true);
    setMarketplaceNotice("");
    try {
      const checkoutResponse = await fetch(
        `${API_BASE_URL}/marketplace/checkout?institution_id=${encodeURIComponent(institutionId)}`,
        { method: "POST", credentials: "include", headers: { Accept: "application/json" } }
      );
      const checkoutData = await checkoutResponse.json().catch(() => null);
      if (!checkoutResponse.ok) {
        throw new Error(String(checkoutData?.detail || checkoutData?.message || "Unable to create marketplace order."));
      }

      const orderId = Number(checkoutData?.order_id);
      if (!Number.isFinite(orderId)) throw new Error("Marketplace order ID was not returned.");

      if (paymentMethod === "COD") {
        setMarketplaceNotice(
          `Cash on Delivery order #${orderId} placed successfully. Payment will remain pending until cash is collected.`
        );
        setMarketplacePanel("orders");
        setCheckoutPaymentMethod("ONLINE");
        setShippingAddress("");
        await loadMarketplaceCart();
        await loadMarketplaceOrders();
        setMarketplaceBusy(false);
        return;
      }

      const paymentResponse = await fetch(`${API_BASE_URL}/marketplace/payments/`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      const paymentData = await paymentResponse.json().catch(() => null);
      if (!paymentResponse.ok) {
        throw new Error(String(paymentData?.detail || paymentData?.message || "Unable to create Razorpay payment."));
      }

      const payment = paymentData as MarketplacePaymentCreateResponse;
      if (!payment.razorpay_key_id) throw new Error("Razorpay key is not configured on the server.");

      await ensureRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout could not be loaded.");

      const amountInPaise = Math.round(Number(payment.amount) * 100);
      if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) throw new Error("Invalid payment amount returned by the server.");

      const razorpay = new window.Razorpay({
        key: payment.razorpay_key_id,
        amount: amountInPaise,
        currency: payment.currency || "INR",
        name: "EduSphere Marketplace",
        description: `Professor marketplace order #${orderId}`,
        order_id: payment.gateway_order_id,
        handler: async (razorpayResponse) => {
          try {
            const verifyResponse = await fetch(`${API_BASE_URL}/marketplace/payments/verify`, {
              method: "POST",
              credentials: "include",
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: orderId,
                gateway_order_id: razorpayResponse.razorpay_order_id,
                gateway_payment_id: razorpayResponse.razorpay_payment_id,
                gateway_signature: razorpayResponse.razorpay_signature,
              }),
            });
            const verifyData = await verifyResponse.json().catch(() => null);
            if (!verifyResponse.ok) throw new Error(String(verifyData?.detail || verifyData?.message || "Payment verification failed."));
            setMarketplaceNotice(`Payment successful. Order #${orderId} is confirmed.`);
            setMarketplacePanel("orders");
            setCheckoutPaymentMethod("ONLINE");
            setShippingAddress("");
            await loadMarketplaceCart();
            await loadMarketplaceOrders();
          } catch (err) {
            setMarketplaceNotice(err instanceof Error ? err.message : "Payment verification failed.");
          } finally {
            setMarketplaceBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setMarketplaceBusy(false);
            setMarketplaceNotice("Payment window closed. Your order remains pending.");
          },
        },
        theme: { color: "#6366f1" },
      });

      razorpay.open();
    } catch (err) {
      setMarketplaceNotice(err instanceof Error ? err.message : "Unable to start marketplace payment.");
      setMarketplaceBusy(false);
    }
  }, [dashboard, loadMarketplaceCart, loadMarketplaceOrders, marketplaceCart]);

  useEffect(() => {
    loadProfessorDashboard();
  }, [loadProfessorDashboard]);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  useEffect(() => {
    loadMarketplaceCart();
  }, [loadMarketplaceCart]);

  const professor = dashboard?.professor;
  const professorName = professor?.full_name || "Professor";
  const institutionId = professor?.institution_id ?? null;

  return (
    <div style={styles.page}>
      <style>{`
        .prof-marketplace-shell { min-height:100vh; }
        @media (max-width: 900px) {
          .prof-marketplace-main { padding: 24px 16px !important; }
          .prof-marketplace-header { flex-direction:column !important; align-items:flex-start !important; }
        }
      `}</style>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />
      <div style={styles.grid} />

      <main style={styles.main} className="prof-marketplace-main prof-marketplace-shell">
        <header style={styles.header} className="prof-marketplace-header">
          <div>
            <span style={styles.eyebrow}>PROFESSOR CAMPUS COMMERCE</span>
            <h1 style={styles.pageTitle}>
              Professor <span style={styles.gradientText}>Marketplace</span>
            </h1>
            <p style={styles.pageDescription}>
              Shop and sell academic products across the same EduSphere marketplace used by students.
            </p>
            <div style={styles.heroMetaRow}>
              <span style={styles.metaPill}>Shared student marketplace</span>
              <span style={styles.metaPill}>{professorName}</span>
              {professor?.institution_name && (
                <span style={styles.metaPill}>{professor.institution_name}</span>
              )}
            </div>
          </div>
          <div style={styles.headerProfile}>
            <div style={styles.avatar}>
              {professorName.trim().split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={styles.headerName}>{professorName}</div>
              <div style={styles.headerEmail}>{professor?.email || "Professor account"}</div>
            </div>
          </div>
        </header>

        {loading && !dashboard ? (
          <div style={styles.timetableEmpty}>
            <RefreshCw size={28} style={styles.timetableSpinner} />
            <h3 style={styles.timetableEmptyTitle}>Connecting marketplace</h3>
            <p style={styles.timetableEmptyText}>Loading your professor and institution information...</p>
          </div>
        ) : (
          <MarketplaceView
            marketplace={marketplace}
            loading={marketplaceLoading}
            error={marketplaceError}
            search={marketplaceSearch}
            category={marketplaceCategory}
            productType={marketplaceType}
            onSearchChange={setMarketplaceSearch}
            onCategoryChange={setMarketplaceCategory}
            onProductTypeChange={setMarketplaceType}
            onRefresh={loadMarketplace}
            cart={marketplaceCart}
            cartOpen={marketplaceCartOpen}
            onOpenCart={() => {
              setMarketplaceCartOpen(true);
              loadMarketplaceCart();
            }}
            onCloseCart={() => setMarketplaceCartOpen(false)}
            onAddToCart={addMarketplaceToCart}
            onUpdateCart={updateMarketplaceCartItem}
            onRemoveCart={removeMarketplaceCartItem}
            onCheckout={checkoutMarketplace}
            paymentMethod={checkoutPaymentMethod}
            onPaymentMethodChange={setCheckoutPaymentMethod}
            shippingAddress={shippingAddress}
            onShippingAddressChange={setShippingAddress}
            orders={marketplaceOrders}
            sellerOrders={sellerOrders}
            panel={marketplacePanel}
            onPanelChange={(panel) => {
              setMarketplacePanel(panel);
              if (panel === "orders" && !marketplaceOrders) loadMarketplaceOrders();
              if (panel === "sales" && !sellerOrders) loadSellerOrders();
            }}
            onCreateProduct={() => setShowProductForm(true)}
            notice={marketplaceNotice}
            busy={marketplaceBusy}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
            showProductForm={showProductForm}
            onCloseProductForm={() => setShowProductForm(false)}
            institutionId={institutionId}
            onProductCreated={() => {
              setShowProductForm(false);
              loadMarketplace();
            }}
          />
        )}
      </main>

      <AIChatbot />
      <button
        type="button"
        onClick={() => navigate("/app/professor")}
        style={{
          position: "fixed",
          left: 18,
          bottom: 18,
          zIndex: 20,
          border: "1px solid rgba(129,140,248,.25)",
          background: "rgba(15,23,42,.88)",
          color: "#cbd5e1",
          borderRadius: 12,
          padding: "10px 13px",
          cursor: "pointer",
          backdropFilter: "blur(14px)",
        }}
      >
        ← Professor Dashboard
      </button>
    </div>
  );
}

function MarketplaceView({
  marketplace,
  loading,
  error,
  search,
  category,
  productType,
  onSearchChange,
  onCategoryChange,
  onProductTypeChange,
  onRefresh,
  cart,
  cartOpen,
  onOpenCart,
  onCloseCart,
  onAddToCart,
  onUpdateCart,
  onRemoveCart,
  onCheckout,
  paymentMethod,
  onPaymentMethodChange,
  shippingAddress,
  onShippingAddressChange,
  orders,
  sellerOrders,
  panel,
  onPanelChange,
  onCreateProduct,
  notice,
  busy,
  selectedProduct,
  onSelectProduct,
  showProductForm,
  onCloseProductForm,
  institutionId,
  onProductCreated,
}: {
  marketplace: MarketplaceResponse | null;
  loading: boolean;
  error: string;
  search: string;
  category: string;
  productType: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onProductTypeChange: (value: string) => void;
  onRefresh: () => void;
  cart: MarketplaceCartResponse | null;
  cartOpen: boolean;
  onOpenCart: () => void;
  onCloseCart: () => void;
  onAddToCart: (productId: number) => void;
  onUpdateCart: (productId: number, quantity: number) => void;
  onRemoveCart: (productId: number) => void;
  onCheckout: (paymentMethod: "ONLINE" | "COD", shippingAddress: string) => void;
  paymentMethod: "ONLINE" | "COD";
  onPaymentMethodChange: (method: "ONLINE" | "COD") => void;
  shippingAddress: string;
  onShippingAddressChange: (value: string) => void;
  orders: MarketplaceOrdersResponse | null;
  sellerOrders: SellerOrdersResponse | null;
  panel: "shop" | "sell" | "orders" | "sales";
  onPanelChange: (
    panel: "shop" | "sell" | "orders" | "sales"
  ) => void;
  onCreateProduct: () => void;
  notice: string;
  busy: boolean;
  selectedProduct: MarketplaceProduct | null;
  onSelectProduct: (product: MarketplaceProduct | null) => void;
  showProductForm: boolean;
  onCloseProductForm: () => void;
  institutionId: number | null;
  onProductCreated: () => void;
}) {
  const products = marketplace?.products ?? [];

  const categories = Array.from(
    new Set(products.map((product) => product.category).filter(Boolean))
  ) as string[];

  const visibleProducts = products.filter((product) => {
    if (
      category &&
      String(product.category || "").toLowerCase() !== category.toLowerCase()
    ) {
      return false;
    }

    if (productType && product.product_type !== productType) {
      return false;
    }

    return true;
  });

  return (
    <section>
      <div style={styles.timetableHeader} className="edusphere-timetable-header">
        <div>
          <span style={styles.eyebrow}>CAMPUS COMMERCE</span>
          <h2 style={styles.timetableTitle}>Marketplace</h2>
          <p style={styles.timetableDescription}>
            Buy and sell academic and campus products with secure checkout.
          </p>
        </div>

        <div style={styles.marketplaceHeaderActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => onPanelChange("orders")}
          >
            <Package size={16} />
            Orders
          </button>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => onPanelChange("sales")}
          >
            <WalletCards size={16} />
            My Sales
          </button>

          <button
            type="button"
            style={styles.cartButton}
            onClick={onOpenCart}
          >
            <ShoppingCart size={16} />
            Cart
            <span style={styles.cartCount}>
              {cart?.count ?? 0}
            </span>
          </button>
        </div>
      </div>

      <div style={styles.marketplaceTabs}>
        {[
          ["shop", "Browse"],
          ["sell", "Sell"],
          ["orders", "Orders"],
          ["sales", "My Sales"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              onPanelChange(
                value as "shop" | "sell" | "orders" | "sales"
              )
            }
            style={{
              ...styles.marketplaceTab,
              ...(panel === value ? styles.marketplaceTabActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && <div style={styles.marketplaceNotice}>{notice}</div>}

      {panel === "shop" && (
        <>
          <div style={styles.marketplaceToolbar}>
            <div style={styles.courseSearchBox}>
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search products..."
                style={styles.courseSearchInput}
              />
            </div>

            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              style={styles.marketplaceSelect}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={productType}
              onChange={(event) => onProductTypeChange(event.target.value)}
              style={styles.marketplaceSelect}
            >
              <option value="">All types</option>
              <option value="DIGITAL">Digital</option>
              <option value="PHYSICAL">Physical</option>
            </select>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              style={styles.secondaryButton}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {error ? (
            <div style={styles.timetableError}>
              <div style={styles.errorIcon}>!</div>
              <div>
                <strong>Marketplace unavailable</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : loading && !marketplace ? (
            <div style={styles.timetableEmpty}>
              <RefreshCw size={28} style={styles.timetableSpinner} />
              <span style={styles.cardEyebrow}>LIVE MARKETPLACE DATA</span>
              <h3>Loading marketplace</h3>
              <p>Fetching active listings from EduSphere.</p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div style={styles.timetableEmpty}>
              <div style={styles.emptyCalendarIcon}>
                <Store size={28} />
              </div>
              <span style={styles.cardEyebrow}>NO ACTIVE LISTINGS</span>
              <h3 style={styles.timetableEmptyTitle}>
                Marketplace is empty
              </h3>
              <p style={styles.timetableEmptyText}>
                No active products match your current filters.
              </p>
            </div>
          ) : (
            <div
              style={styles.marketplaceGrid}
              className="edusphere-marketplace-grid"
            >
              {visibleProducts.map((product) => (
                <MarketplaceProductCard
                  key={product.product_id}
                  product={product}
                  busy={busy}
                  onSelect={() => onSelectProduct(product)}
                  onAddToCart={() => onAddToCart(product.product_id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {panel === "sell" && (
        <div style={styles.sellPanel}>
          <div>
            <span style={styles.eyebrow}>SELLER SPACE</span>
            <h3 style={styles.sellTitle}>List a product</h3>
            <p style={styles.sellDescription}>
              Completed EduSphere users can create their own marketplace
              listings. Digital products can include private downloadable
              files.
            </p>
          </div>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={onCreateProduct}
          >
            <Plus size={16} />
            Create Listing
          </button>
        </div>
      )}

      {panel === "orders" && (
        <MarketplaceOrders orders={orders} />
      )}

      {panel === "sales" && (
        <MarketplaceSales orders={sellerOrders} />
      )}

      {selectedProduct && (
        <MarketplaceProductModal
          product={selectedProduct}
          onClose={() => onSelectProduct(null)}
          onAddToCart={() => {
            onAddToCart(selectedProduct.product_id);
            onSelectProduct(null);
          }}
          busy={busy}
        />
      )}

      {cartOpen && cart && (
        <MarketplaceCartModal
          cart={cart}
          onClose={onCloseCart}
          onUpdate={onUpdateCart}
          onRemove={onRemoveCart}
          onCheckout={onCheckout}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={onPaymentMethodChange}
          shippingAddress={shippingAddress}
          onShippingAddressChange={onShippingAddressChange}
          busy={busy}
        />
      )}

      {showProductForm && institutionId && (
        <MarketplaceProductForm
          institutionId={institutionId}
          onClose={onCloseProductForm}
          onCreated={onProductCreated}
        />
      )}
    </section>
  );
}

function MarketplaceProductCard({
  product,
  onSelect,
  onAddToCart,
  busy,
}: {
  product: MarketplaceProduct;
  onSelect: () => void;
  onAddToCart: () => void;
  busy: boolean;
}) {
  const price = Number(product.price);

  return (
    <article style={styles.marketplaceProductCard}>
      <button
        type="button"
        style={styles.marketplaceProductMain}
        onClick={onSelect}
      >
        <div style={styles.marketplaceProductIcon}>
          {product.product_type === "DIGITAL" ? (
            <BookOpen size={22} />
          ) : (
            <Package size={22} />
          )}
        </div>

        <div style={styles.marketplaceProductBadgeRow}>
          <span style={styles.marketplaceTypeBadge}>
            {product.product_type}
          </span>
          {product.category && (
            <span style={styles.marketplaceCategoryBadge}>
              {product.category}
            </span>
          )}
        </div>

        <h3 style={styles.marketplaceProductTitle}>{product.name}</h3>

        <p style={styles.marketplaceProductDescription}>
          {product.description
            ? product.description.length > 105
              ? `${product.description.slice(0, 105)}…`
              : product.description
            : "No description provided."}
        </p>

        <div style={styles.marketplaceProductSeller}>
          <UserRound size={13} />
          <span>{product.seller_name || "EduSphere seller"}</span>
        </div>

        <div style={styles.marketplaceProductBottom}>
          <strong style={styles.marketplacePrice}>
            ₹{Number.isFinite(price) ? price.toFixed(2) : "0.00"}
          </strong>
          <span style={styles.marketplaceStock}>
            {product.product_type === "DIGITAL"
              ? "Digital delivery"
              : `${product.quantity} available`}
          </span>
        </div>
      </button>

      <button
        type="button"
        style={styles.addToCartButton}
        onClick={onAddToCart}
        disabled={busy || product.quantity <= 0}
      >
        <ShoppingCart size={15} />
        {product.quantity <= 0 ? "Out of stock" : "Add to cart"}
      </button>
    </article>
  );
}

function MarketplaceProductModal({
  product,
  onClose,
  onAddToCart,
  busy,
}: {
  product: MarketplaceProduct;
  onClose: () => void;
  onAddToCart: () => void;
  busy: boolean;
}) {
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={styles.eventModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.cardEyebrow}>
              {product.product_type}
            </span>
            <h2 style={styles.modalTitle}>{product.name}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.modalCloseButton}
            aria-label="Close product"
          >
            <X size={18} />
          </button>
        </div>

        <div style={styles.modalBody}>
          <p style={styles.modalDescription}>
            {product.description || "No description provided."}
          </p>

          <div style={styles.modalInfoGrid}>
            <div style={styles.modalInfoCard}>
              <WalletCards size={17} />
              <div>
                <span style={styles.modalInfoLabel}>PRICE</span>
                <strong style={styles.modalInfoValue}>
                  ₹{Number(product.price).toFixed(2)}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <UserRound size={17} />
              <div>
                <span style={styles.modalInfoLabel}>SELLER</span>
                <strong style={styles.modalInfoValue}>
                  {product.seller_name || "EduSphere seller"}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <Store size={17} />
              <div>
                <span style={styles.modalInfoLabel}>CATEGORY</span>
                <strong style={styles.modalInfoValue}>
                  {product.category || "Uncategorized"}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <Package size={17} />
              <div>
                <span style={styles.modalInfoLabel}>AVAILABILITY</span>
                <strong style={styles.modalInfoValue}>
                  {product.product_type === "DIGITAL"
                    ? "Digital"
                    : `${product.quantity} available`}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={onAddToCart}
            disabled={busy || product.quantity <= 0}
          >
            <ShoppingCart size={16} />
            {product.quantity <= 0 ? "Out of stock" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketplaceCartModal({
  cart,
  onClose,
  onUpdate,
  onRemove,
  onCheckout,
  busy,
  paymentMethod,
  onPaymentMethodChange,
  shippingAddress,
  onShippingAddressChange,
}: {
  cart: MarketplaceCartResponse;
  onClose: () => void;
  onUpdate: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: (paymentMethod: "ONLINE" | "COD", shippingAddress: string) => void;
  busy: boolean;
  paymentMethod: "ONLINE" | "COD";
  onPaymentMethodChange: (method: "ONLINE" | "COD") => void;
  shippingAddress: string;
  onShippingAddressChange: (value: string) => void;
}) {
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={styles.cartModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.cardEyebrow}>BUYER CART</span>
            <h2 style={styles.modalTitle}>Your Cart</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.modalCloseButton}
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        <div style={styles.cartBody}>
          {cart.items.length === 0 ? (
            <div style={styles.timetableEmpty}>
              <ShoppingCart size={30} />
              <h3 style={styles.timetableEmptyTitle}>Cart is empty</h3>
              <p style={styles.timetableEmptyText}>
                Add a marketplace product to begin checkout.
              </p>
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.cart_item_id} style={styles.cartItem}>
                <div style={styles.cartItemMain}>
                  <strong>{item.name}</strong>
                  <span>
                    {item.seller_name || "Seller"} · ₹
                    {Number(item.price).toFixed(2)}
                  </span>
                </div>

                <div style={styles.cartItemActions}>
                  <button
                    type="button"
                    style={styles.quantityButton}
                    onClick={() =>
                      onUpdate(
                        item.product_id,
                        Math.max(1, item.quantity - 1)
                      )
                    }
                    disabled={busy}
                  >
                    <Minus size={13} />
                  </button>

                  <span style={styles.quantityValue}>{item.quantity}</span>

                  <button
                    type="button"
                    style={styles.quantityButton}
                    onClick={() =>
                      onUpdate(
                        item.product_id,
                        Math.min(
                          item.available_quantity,
                          item.quantity + 1
                        )
                      )
                    }
                    disabled={
                      busy ||
                      item.quantity >= item.available_quantity
                    }
                  >
                    <Plus size={13} />
                  </button>

                  <button
                    type="button"
                    style={styles.removeCartButton}
                    onClick={() => onRemove(item.product_id)}
                    disabled={busy}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

          {cart.items.some(
            (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
          ) && cart.items.every(
            (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
          ) && (
            <div style={{ width: "100%", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange("ONLINE")}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: paymentMethod === "ONLINE" ? "1px solid #818cf8" : "1px solid #334155",
                    background: paymentMethod === "ONLINE" ? "#1e1b4b" : "#0f172a",
                    color: "#e2e8f0",
                    fontWeight: 800,
                  }}
                >
                  Online · Razorpay
                </button>
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange("COD")}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: paymentMethod === "COD" ? "1px solid #818cf8" : "1px solid #334155",
                    background: paymentMethod === "COD" ? "#1e1b4b" : "#0f172a",
                    color: "#e2e8f0",
                    fontWeight: 800,
                  }}
                >
                  Cash on Delivery
                </button>
              </div>
              {paymentMethod === "COD" && (
                <textarea
                  value={shippingAddress}
                  onChange={(event) => onShippingAddressChange(event.target.value)}
                  placeholder="Delivery address (house/building, street, area, city, PIN)"
                  rows={3}
                  disabled={busy}
                  style={{ ...styles.formTextarea, width: "100%", boxSizing: "border-box" }}
                />
              )}
            </div>
          )}
          {cart.items.some(
            (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
          ) && !(
            cart.items.every(
              (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
            )
          ) && (
            <div style={{ width: "100%", marginBottom: 12 }}>
              <textarea
                value={shippingAddress}
                onChange={(event) => onShippingAddressChange(event.target.value)}
                placeholder="Delivery address (house/building, street, area, city, PIN)"
                rows={3}
                disabled={busy}
                style={{ ...styles.formTextarea, width: "100%", boxSizing: "border-box" }}
              />
            </div>
          )}
          {cart.items.some(
            (item) => String(item.product_type).toUpperCase() === "DIGITAL"
          ) && (
            <div style={{ width: "100%", marginBottom: 12, color: "#94a3b8", fontSize: 11 }}>
              Digital products require online payment. COD is unavailable for digital items.
            </div>
          )}

        <div style={styles.cartFooter}>
          <div>
            <span style={styles.modalInfoLabel}>BUYER PAYS</span>
            <strong style={styles.cartTotal}>
              ₹{Number(cart.total).toFixed(2)}
            </strong>
            <span style={{ display: "block", marginTop: 5, color: "#7f8aa5", fontSize: 10 }}>
              EduSphere fee: 5% of seller earnings (seller-paid)
            </span>
          </div>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => onCheckout(paymentMethod, shippingAddress)}
            disabled={busy || cart.items.length === 0}
          >
            <WalletCards size={16} />
            {busy
              ? "Processing..."
              : paymentMethod === "COD"
                ? "Place COD Order"
                : "Pay Online with Razorpay"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketplaceOrders({
  orders,
}: {
  orders: MarketplaceOrdersResponse | null;
}) {
  if (!orders) {
    return (
      <div style={styles.timetableEmpty}>
        <Package size={30} />
        <h3 style={styles.timetableEmptyTitle}>No order data loaded</h3>
        <p style={styles.timetableEmptyText}>
          Open Orders from the Marketplace to load your purchase history.
        </p>
      </div>
    );
  }

  if (!orders.orders.length) {
    return (
      <div style={styles.timetableEmpty}>
        <Package size={30} />
        <h3 style={styles.timetableEmptyTitle}>No purchases yet</h3>
        <p style={styles.timetableEmptyText}>
          Your confirmed and pending marketplace orders will appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.orderList}>
      {orders.orders.map((order) => {
        const digitalFiles = order.digital_files || [];
        const canDownload = ["CONFIRMED", "PROCESSING", "COMPLETED"].includes(
          order.status
        );

        return (
          <div key={order.order_id} style={styles.orderRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={styles.cardEyebrow}>ORDER #{order.order_id}</span>
              <strong style={styles.orderTitle}>
                ₹{Number(order.total_amount).toFixed(2)}
              </strong>
              <span style={styles.orderDate}>
                {formatMarketplaceDate(order.created_at)}
              </span>
              <span style={{ display: "block", marginTop: 5, color: "#94a3b8", fontSize: 11 }}>
                Payment: {order.payment_method || "ONLINE"} · {order.payment_status || (order.status === "CONFIRMED" ? "PAID" : "PENDING")}
              </span>

              {canDownload && digitalFiles.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 12,
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
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

            <span style={getMarketplaceStatusStyle(order.status)}>
              {order.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MarketplaceSales({
  orders,
}: {
  orders: SellerOrdersResponse | null;
}) {
  if (!orders) {
    return (
      <div style={styles.timetableEmpty}>
        <WalletCards size={30} />
        <h3 style={styles.timetableEmptyTitle}>No sales data loaded</h3>
        <p style={styles.timetableEmptyText}>
          Open My Sales from the Marketplace to load your seller activity.
        </p>
      </div>
    );
  }

  if (!orders.orders.length) {
    return (
      <div style={styles.timetableEmpty}>
        <WalletCards size={30} />
        <h3 style={styles.timetableEmptyTitle}>No sales yet</h3>
        <p style={styles.timetableEmptyText}>
          Purchases of your products will appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.orderList}>
      {orders.orders.map((order) => (
        <div key={order.order_item_id} style={styles.orderRow}>
          <div>
            <span style={styles.cardEyebrow}>
              ORDER #{order.order_id}
            </span>
            <strong style={styles.orderTitle}>
              {order.product_name}
            </strong>
            <span style={styles.orderDate}>
              {order.quantity} × ₹{Number(order.unit_price).toFixed(2)}
              {" · "}
              Buyer: {order.buyer_name || "Buyer"}
            </span>
          </div>

          <span style={getMarketplaceStatusStyle(order.order_status)}>
            {order.order_status}
          </span>
        </div>
      ))}
    </div>
  );
}

function MarketplaceProductForm({
  institutionId,
  onClose,
  onCreated,
}: {
  institutionId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] =
    useState<"DIGITAL" | "PHYSICAL">("PHYSICAL");
  const [conditionType, setConditionType] = useState("USED");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");

    try {
      const numericPrice = Number(price);
      const numericQuantity = Number(quantity);

      if (!name.trim()) throw new Error("Product name is required.");
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        throw new Error("Enter a valid non-negative price.");
      }
      if (!Number.isInteger(numericQuantity) || numericQuantity < 0) {
        throw new Error("Enter a valid non-negative quantity.");
      }

      if (productType === "DIGITAL") {
        if (!file) {
          throw new Error(
            "A digital product requires a downloadable file."
          );
        }
      }

      const createResponse = await fetch(`${API_BASE_URL}/marketplace/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          institution_id: institutionId,
          name: name.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          product_type: productType,
          condition_type:
            productType === "DIGITAL" ? "DIGITAL" : conditionType,
          price: numericPrice,
          quantity: numericQuantity,
        }),
      });

      const createData = await createResponse.json().catch(() => null);

      if (!createResponse.ok) {
        throw new Error(
          String(
            createData?.detail ||
              createData?.message ||
              "Unable to create listing."
          )
        );
      }

      const productId = Number(createData?.product_id);

      if (productType === "DIGITAL") {
        if (!Number.isFinite(productId)) {
          throw new Error(
            "Product was created but no product ID was returned."
          );
        }

        const formData = new FormData();
        formData.append("file", file as File);

        const uploadResponse = await fetch(
          `${API_BASE_URL}/marketplace/${productId}/attachments`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json().catch(() => null);

        if (!uploadResponse.ok) {
          throw new Error(
            String(
              uploadData?.detail ||
                uploadData?.message ||
                "Product created but file upload failed."
            )
          );
        }
      }

      onCreated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create marketplace listing."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={styles.eventModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.cardEyebrow}>SELLER</span>
            <h2 style={styles.modalTitle}>Create Listing</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.modalCloseButton}
          >
            <X size={18} />
          </button>
        </div>

        <div style={styles.formBody}>
          {error && <div style={styles.formError}>{error}</div>}

          <label style={styles.formLabel}>
            Product name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={styles.formInput}
              placeholder="e.g. Engineering drawing set"
            />
          </label>

          <label style={styles.formLabel}>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              style={styles.formTextarea}
              placeholder="Describe the product..."
              rows={4}
            />
          </label>

          <div style={styles.formTwoColumn}>
            <label style={styles.formLabel}>
              Category
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                style={styles.formInput}
                placeholder="Books, Notes, Electronics..."
              />
            </label>

            <label style={styles.formLabel}>
              Product type
              <select
                value={productType}
                onChange={(event) => {
                  const value = event.target.value as
                    | "DIGITAL"
                    | "PHYSICAL";
                  setProductType(value);
                  if (value === "DIGITAL") {
                    setConditionType("DIGITAL");
                  } else if (conditionType === "DIGITAL") {
                    setConditionType("USED");
                  }
                }}
                style={styles.formInput}
              >
                <option value="PHYSICAL">Physical</option>
                <option value="DIGITAL">Digital</option>
              </select>
            </label>
          </div>

          <div style={styles.formTwoColumn}>
            <label style={styles.formLabel}>
              Condition
              <select
                value={conditionType}
                onChange={(event) => setConditionType(event.target.value)}
                disabled={productType === "DIGITAL"}
                style={styles.formInput}
              >
                <option value="NEW">New</option>
                <option value="USED">Used</option>
                <option value="DIGITAL">Digital</option>
              </select>
            </label>

            <label style={styles.formLabel}>
              Price (INR)
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                style={styles.formInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </label>
          </div>

          <label style={styles.formLabel}>
            Quantity
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              style={styles.formInput}
              type="number"
              min="0"
              step="1"
            />
          </label>

          {productType === "DIGITAL" && (
            <label style={styles.fileDrop}>
              <Upload size={20} />
              <strong>Digital file</strong>
              <span>
                PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, WEBP or TXT · max 10 MB
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                style={{ display: "none" }}
              />
              {file && (
                <small style={styles.selectedFileName}>
                  Selected: {file.name}
                </small>
              )}
            </label>
          )}
        </div>

        <div style={styles.modalFooter}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Creating..." : "Create Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMarketplaceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getMarketplaceStatusStyle(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "CONFIRMED" || normalized === "PAID") {
    return {
      ...styles.marketplaceStatus,
      color: "#67e8f9",
      background: "rgba(34,211,238,0.08)",
    };
  }

  if (normalized === "FAILED" || normalized === "CANCELLED") {
    return {
      ...styles.marketplaceStatus,
      color: "#fda4af",
      background: "rgba(244,63,94,0.08)",
    };
  }

  return {
    ...styles.marketplaceStatus,
    color: "#fcd34d",
    background: "rgba(245,158,11,0.08)",
  };
}

async function ensureRazorpayScript() {
  if (window.Razorpay) return;

  const existing = document.querySelector(
    'script[data-edusphere-razorpay="true"]'
  );

  if (existing) {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Razorpay script load timed out.")),
        10000
      );

      existing.addEventListener("load", () => {
        window.clearTimeout(timeout);
        resolve();
      });
      existing.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("Unable to load Razorpay checkout."));
      });
    });

    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.edusphereRazorpay = "true";

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load Razorpay checkout."));

    document.body.appendChild(script);
  });
}

/* =============================================================
   EVENTS VIEW
============================================================= */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 15% 10%, rgba(99,102,241,0.13), transparent 32%), radial-gradient(circle at 85% 20%, rgba(34,211,238,0.10), transparent 28%), #050711",
    color: "#f8fafc",
    position: "relative",
    overflow: "hidden",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },

  backgroundGlowOne: {
    position: "fixed",
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "rgba(99,102,241,0.08)",
    filter: "blur(100px)",
    top: -220,
    left: 240,
    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "fixed",
    width: 430,
    height: 430,
    borderRadius: "50%",
    background: "rgba(34,211,238,0.06)",
    filter: "blur(100px)",
    bottom: -180,
    right: -100,
    pointerEvents: "none",
  },

  grid: {
    position: "fixed",
    inset: 0,
    opacity: 0.12,
    pointerEvents: "none",
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)",
    backgroundSize: "42px 42px",
    maskImage:
      "linear-gradient(to bottom, black, transparent 80%)",
    WebkitMaskImage:
      "linear-gradient(to bottom, black, transparent 80%)",
  },

  appShell: {
    minHeight: "100vh",
    display: "flex",
    position: "relative",
    zIndex: 1,
  },

  sidebar: {
    width: 250,
    minHeight: "100vh",
    padding: "28px 18px",
    boxSizing: "border-box",
    background: "rgba(7,10,22,0.82)",
    borderRight: "1px solid rgba(148,163,184,0.12)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    display: "flex",
    flexDirection: "column",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "0 10px 28px",
  },

  brandOrb: {
    width: 42,
    height: 42,
    borderRadius: 13,
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(34,211,238,0.16))",
    border: "1px solid rgba(129,140,248,0.35)",
    boxShadow: "0 0 28px rgba(99,102,241,0.18)",
  },

  brandName: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.16em",
  },

  brandSubtitle: {
    color: "#64748b",
    fontSize: 9,
    letterSpacing: "0.08em",
    marginTop: 3,
  },

  navigation: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  navLabel: {
    color: "#475569",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.18em",
    padding: "18px 11px 7px",
  },

  navItem: {
    width: "100%",
    border: "1px solid transparent",
    background: "transparent",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    textAlign: "left",
  },

  navItemActive: {
    color: "#f8fafc",
    background: "rgba(99,102,241,0.13)",
    borderColor: "rgba(129,140,248,0.18)",
    boxShadow: "inset 3px 0 0 #818cf8",
  },

  sidebarBottom: {
    marginTop: "auto",
  },

  connectionStatus: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.10)",
  },

  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#34d399",
    boxShadow: "0 0 12px rgba(52,211,153,0.8)",
  },

  connectionTitle: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.12em",
    color: "#cbd5e1",
  },

  connectionSubtitle: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 3,
  },

  logoutButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.15)",
    background: "rgba(127,29,29,0.10)",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 12,
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: "38px 42px",
    boxSizing: "border-box",
    maxWidth: 1500,
    margin: "0 auto",
    width: "100%",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 30,
    marginBottom: 30,
  },

  eyebrow: {
    display: "block",
    color: "#818cf8",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.20em",
    marginBottom: 9,
  },

  pageTitle: {
    margin: 0,
    fontSize: "clamp(30px, 4vw, 48px)",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  gradientText: {
    background:
      "linear-gradient(90deg, #a5b4fc, #67e8f9)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },

  pageDescription: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  headerProfile: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "9px 12px 9px 9px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.13)",
    background: "rgba(15,23,42,0.52)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 800,
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.34), rgba(34,211,238,0.18))",
    border: "1px solid rgba(129,140,248,0.3)",
  },

  headerName: {
    fontSize: 12,
    fontWeight: 700,
  },

  headerEmail: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 3,
  },

  heroCard: {
    minHeight: 230,
    borderRadius: 24,
    padding: "30px 34px",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 30,
    background:
      "linear-gradient(135deg, rgba(30,41,84,0.58), rgba(15,23,42,0.66))",
    border: "1px solid rgba(129,140,248,0.20)",
    boxShadow:
      "0 25px 80px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
    marginBottom: 18,
  },

  heroContent: {
    position: "relative",
    zIndex: 2,
  },

  cardEyebrow: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.18em",
  },

  heroTitle: {
    margin: "8px 0 5px",
    fontSize: "clamp(26px, 3vw, 38px)",
    letterSpacing: "-0.035em",
  },

  heroSubtitle: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 14,
  },

  heroMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 22,
  },

  metaPill: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.13)",
    color: "#cbd5e1",
    fontSize: 10,
  },

  heroOrb: {
    width: 170,
    height: 170,
    flexShrink: 0,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle, rgba(129,140,248,0.24), rgba(34,211,238,0.08) 42%, transparent 68%)",
    border: "1px solid rgba(129,140,248,0.18)",
    boxShadow:
      "0 0 80px rgba(99,102,241,0.16), inset 0 0 45px rgba(34,211,238,0.06)",
  },

  heroOrbInner: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#a5b4fc",
    background:
      "linear-gradient(145deg, rgba(99,102,241,0.24), rgba(34,211,238,0.10))",
    border: "1px solid rgba(165,180,252,0.30)",
    boxShadow: "0 0 45px rgba(99,102,241,0.22)",
  },

  heroCube: {
  width: 260,
  height: 260,
  flexShrink: 0,
  position: "relative",
},

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },

  dataCard: {
    minWidth: 0,
    padding: 18,
    borderRadius: 17,
    background: "rgba(15,23,42,0.60)",
    border: "1px solid rgba(148,163,184,0.11)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025)",
  },

  dataCardIcon: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(129,140,248,0.13)",
    marginBottom: 15,
  },

  dataCardLabel: {
    color: "#64748b",
    fontSize: 10,
    marginBottom: 6,
  },

  dataCardValue: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 18,
    marginBottom: 18,
  },

  panel: {
    padding: 23,
    borderRadius: 20,
    background: "rgba(15,23,42,0.58)",
    border: "1px solid rgba(148,163,184,0.11)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    color: "#94a3b8",
    marginBottom: 18,
  },

  panelTitle: {
    margin: "6px 0 0",
    fontSize: 18,
    letterSpacing: "-0.025em",
    color: "#f8fafc",
  },

  infoList: {
    display: "flex",
    flexDirection: "column",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    padding: "12px 0",
    borderBottom:
      "1px solid rgba(148,163,184,0.08)",
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 11,
  },

  infoValue: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 600,
    textAlign: "right",
    maxWidth: "65%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  statusBlock: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 13,
    background: "rgba(16,185,129,0.07)",
    border: "1px solid rgba(52,211,153,0.12)",
    marginBottom: 9,
  },

  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    color: "#6ee7b7",
    background: "rgba(16,185,129,0.12)",
    fontWeight: 800,
  },

  statusTitle: {
    color: "#d1fae5",
    fontSize: 11,
    fontWeight: 700,
  },

  statusText: {
    color: "#64748b",
    fontSize: 9,
    marginTop: 3,
  },

  modulesPanel: {
    padding: 23,
    borderRadius: 20,
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.11)",
  },

  modulesDescription: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.6,
    maxWidth: 650,
  },

  moduleGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginTop: 20,
  },

  moduleCard: {
    minWidth: 0,
    width: "100%",
    border: "1px solid rgba(148,163,184,0.08)",
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 13,
    background: "rgba(2,6,23,0.38)",
    textAlign: "left",
    fontFamily: "inherit",
    color: "inherit",
    cursor: "pointer",
  },

  moduleIcon: {
    width: 35,
    height: 35,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.09)",
  },

  moduleTitle: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 700,
  },

  moduleDescription: {
    color: "#64748b",
    fontSize: 9,
    marginTop: 3,
    lineHeight: 1.4,
  },

  moduleArrow: {
    marginLeft: "auto",
    color: "#475569",
    flexShrink: 0,
  },

  marketplaceHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  marketplaceTabs: {
    display: "flex",
    gap: 6,
    padding: 5,
    marginBottom: 16,
    overflowX: "auto",
    borderRadius: 13,
    background: "rgba(15,23,42,0.56)",
    border: "1px solid rgba(148,163,184,0.09)",
  },

  marketplaceTab: {
    border: 0,
    borderRadius: 9,
    padding: "9px 13px",
    color: "#64748b",
    background: "transparent",
    fontFamily: "inherit",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  marketplaceTabActive: {
    color: "#e2e8f0",
    background: "rgba(99,102,241,0.14)",
    boxShadow: "inset 0 0 0 1px rgba(129,140,248,0.12)",
  },

  marketplaceNotice: {
    marginBottom: 14,
    padding: "10px 13px",
    borderRadius: 11,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(129,140,248,0.12)",
    fontSize: 10,
  },

  marketplaceToolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap",
  },

  marketplaceSelect: {
    minWidth: 145,
    padding: "11px 12px",
    borderRadius: 11,
    border: "1px solid rgba(148,163,184,0.10)",
    outline: "none",
    background: "rgba(15,23,42,0.70)",
    color: "#cbd5e1",
    fontFamily: "inherit",
    fontSize: 10,
  },

  cartButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 13px",
    borderRadius: 10,
    border: "1px solid rgba(34,211,238,0.15)",
    background: "rgba(34,211,238,0.07)",
    color: "#67e8f9",
    fontFamily: "inherit",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  },

  cartCount: {
    minWidth: 18,
    height: 18,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "rgba(34,211,238,0.14)",
    color: "#e0f2fe",
    fontSize: 8,
  },

  marketplaceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
  },

  marketplaceProductCard: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.80), rgba(8,12,28,0.74))",
    border: "1px solid rgba(129,140,248,0.13)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.15)",
  },

  marketplaceProductMain: {
    width: "100%",
    minWidth: 0,
    padding: 18,
    textAlign: "left",
    border: 0,
    background: "transparent",
    color: "inherit",
    fontFamily: "inherit",
    cursor: "pointer",
  },

  marketplaceProductIcon: {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    marginBottom: 14,
    borderRadius: 13,
    color: "#67e8f9",
    background:
      "linear-gradient(135deg, rgba(34,211,238,0.12), rgba(99,102,241,0.12))",
    border: "1px solid rgba(34,211,238,0.12)",
  },

  marketplaceProductBadgeRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 9,
  },

  marketplaceTypeBadge: {
    padding: "5px 7px",
    borderRadius: 6,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.09)",
    fontSize: 7,
    fontWeight: 900,
    letterSpacing: "0.09em",
  },

  marketplaceCategoryBadge: {
    padding: "5px 7px",
    borderRadius: 6,
    color: "#64748b",
    background: "rgba(148,163,184,0.06)",
    fontSize: 7,
    fontWeight: 800,
  },

  marketplaceProductTitle: {
    margin: "0 0 8px",
    color: "#f8fafc",
    fontSize: 17,
    lineHeight: 1.3,
  },

  marketplaceProductDescription: {
    minHeight: 46,
    margin: "0 0 13px",
    color: "#64748b",
    fontSize: 10,
    lineHeight: 1.5,
  },

  marketplaceProductSeller: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#94a3b8",
    fontSize: 9,
  },

  marketplaceProductBottom: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
    paddingTop: 13,
    borderTop: "1px solid rgba(148,163,184,0.08)",
  },

  marketplacePrice: {
    color: "#e0f2fe",
    fontSize: 20,
    lineHeight: 1,
  },

  marketplaceStock: {
    color: "#475569",
    fontSize: 8,
    fontWeight: 800,
    textAlign: "right",
  },

  addToCartButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    margin: "0 14px 14px",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(34,211,238,0.12)",
    background: "rgba(34,211,238,0.06)",
    color: "#67e8f9",
    fontFamily: "inherit",
    fontSize: 9,
    fontWeight: 800,
    cursor: "pointer",
  },

  sellPanel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: 24,
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.80), rgba(8,12,28,0.74))",
    border: "1px solid rgba(129,140,248,0.13)",
  },

  sellTitle: {
    margin: "7px 0 8px",
    color: "#f8fafc",
    fontSize: 22,
  },

  sellDescription: {
    maxWidth: 680,
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.6,
  },

  orderList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  orderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
    borderRadius: 14,
    background: "rgba(15,23,42,0.60)",
    border: "1px solid rgba(148,163,184,0.08)",
  },

  orderTitle: {
    display: "block",
    marginTop: 5,
    color: "#e2e8f0",
    fontSize: 14,
  },

  orderDate: {
    display: "block",
    marginTop: 5,
    color: "#64748b",
    fontSize: 9,
  },

  marketplaceStatus: {
    padding: "7px 9px",
    borderRadius: 8,
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },

  cartModal: {
    width: "min(760px, 100%)",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 22,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(8,12,28,0.99))",
    border: "1px solid rgba(129,140,248,0.18)",
    boxShadow: "0 30px 100px rgba(0,0,0,0.48)",
  },

  cartBody: {
    padding: 20,
    overflowY: "auto",
  },

  cartItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    padding: "14px 0",
    borderBottom: "1px solid rgba(148,163,184,0.07)",
  },

  cartItemMain: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  cartItemMainStrong: {},

  cartItemActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },

  quantityButton: {
    width: 28,
    height: 28,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.10)",
    background: "rgba(15,23,42,0.65)",
    color: "#94a3b8",
    cursor: "pointer",
  },

  quantityValue: {
    minWidth: 20,
    textAlign: "center",
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: 800,
  },

  removeCartButton: {
    width: 30,
    height: 30,
    display: "grid",
    placeItems: "center",
    marginLeft: 6,
    borderRadius: 8,
    border: "1px solid rgba(244,63,94,0.10)",
    background: "rgba(244,63,94,0.05)",
    color: "#fda4af",
    cursor: "pointer",
  },

  cartFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: "17px 22px",
    borderTop: "1px solid rgba(148,163,184,0.09)",
  },

  cartTotal: {
    display: "block",
    marginTop: 4,
    color: "#f8fafc",
    fontSize: 23,
  },

  formBody: {
    display: "flex",
    flexDirection: "column",
    gap: 15,
    padding: 24,
    overflowY: "auto",
    maxHeight: "65vh",
  },

  formTwoColumn: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 13,
  },

  formLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.06em",
  },

  formInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.10)",
    outline: "none",
    background: "rgba(2,6,23,0.50)",
    color: "#e2e8f0",
    fontFamily: "inherit",
    fontSize: 11,
  },

  formTextarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.10)",
    outline: "none",
    background: "rgba(2,6,23,0.50)",
    color: "#e2e8f0",
    fontFamily: "inherit",
    fontSize: 11,
  },

  formError: {
    padding: 11,
    borderRadius: 10,
    color: "#fda4af",
    background: "rgba(244,63,94,0.07)",
    border: "1px solid rgba(244,63,94,0.12)",
    fontSize: 10,
  },

  fileDrop: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 24,
    borderRadius: 13,
    border: "1px dashed rgba(34,211,238,0.22)",
    background: "rgba(34,211,238,0.04)",
    color: "#67e8f9",
    textAlign: "center",
    cursor: "pointer",
    fontSize: 10,
  },

  selectedFileName: {
    color: "#cbd5e1",
    fontSize: 9,
  },

  eventGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },

  eventCard: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    alignItems: "stretch",
    padding: 0,
    textAlign: "left",
    fontFamily: "inherit",
    color: "inherit",
    cursor: "pointer",
    overflow: "hidden",
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.80), rgba(8,12,28,0.72))",
    border: "1px solid rgba(129,140,248,0.13)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025), 0 18px 50px rgba(0,0,0,0.16)",
  },

  eventDateBlock: {
    width: 82,
    minWidth: 82,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    background:
      "linear-gradient(180deg, rgba(99,102,241,0.15), rgba(34,211,238,0.06))",
    borderRight: "1px solid rgba(129,140,248,0.12)",
  },

  eventMonth: {
    color: "#67e8f9",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.14em",
  },

  eventDay: {
    margin: "3px 0",
    color: "#f8fafc",
    fontSize: 30,
    lineHeight: 1,
  },

  eventWeekday: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.10em",
  },

  eventCardBody: {
    minWidth: 0,
    flex: 1,
    padding: 18,
  },

  eventCardTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  eventTypeBadge: {
    padding: "5px 8px",
    borderRadius: 7,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.09)",
    border: "1px solid rgba(129,140,248,0.12)",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },

  upcomingBadge: {
    padding: "5px 8px",
    borderRadius: 7,
    color: "#67e8f9",
    background: "rgba(34,211,238,0.07)",
    border: "1px solid rgba(34,211,238,0.12)",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },

  eventTitle: {
    margin: "0 0 8px",
    color: "#f8fafc",
    fontSize: 18,
    lineHeight: 1.25,
    letterSpacing: "-0.02em",
  },

  eventDescription: {
    margin: "0 0 13px",
    color: "#64748b",
    fontSize: 10,
    lineHeight: 1.55,
  },

  eventMetaList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  eventMetaRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 1.4,
  },

  eventCardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 15,
    paddingTop: 12,
    borderTop: "1px solid rgba(148,163,184,0.08)",
    color: "#67e8f9",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.10em",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    background: "rgba(2,6,23,0.78)",
    backdropFilter: "blur(12px)",
  },

  eventModal: {
    width: "min(720px, 100%)",
    maxHeight: "min(760px, 90vh)",
    overflowY: "auto",
    borderRadius: 22,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.97), rgba(8,12,28,0.98))",
    border: "1px solid rgba(129,140,248,0.18)",
    boxShadow: "0 30px 100px rgba(0,0,0,0.48)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    padding: 24,
    borderBottom: "1px solid rgba(148,163,184,0.09)",
  },

  modalTitle: {
    margin: "7px 0 0",
    color: "#f8fafc",
    fontSize: 25,
    lineHeight: 1.2,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.72)",
    color: "#94a3b8",
    cursor: "pointer",
  },

  modalBody: {
    padding: 24,
  },

  modalDescription: {
    margin: "0 0 22px",
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
  },

  modalInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  modalInfoCard: {
    display: "flex",
    gap: 11,
    padding: 14,
    borderRadius: 13,
    background: "rgba(2,6,23,0.40)",
    border: "1px solid rgba(148,163,184,0.08)",
    color: "#67e8f9",
  },

  modalInfoLabel: {
    display: "block",
    marginBottom: 4,
    color: "#475569",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },

  modalInfoValue: {
    display: "block",
    color: "#e2e8f0",
    fontSize: 10,
    lineHeight: 1.45,
  },

  registrationDeadline: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    marginTop: 12,
    padding: 14,
    borderRadius: 13,
    color: "#67e8f9",
    background: "rgba(34,211,238,0.05)",
    border: "1px solid rgba(34,211,238,0.10)",
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "17px 24px",
    borderTop: "1px solid rgba(148,163,184,0.09)",
  },

  registrationButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    color: "#e0f2fe",
    background: "rgba(34,211,238,0.10)",
    border: "1px solid rgba(34,211,238,0.16)",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 800,
  },

  noRegistration: {
    color: "#64748b",
    fontSize: 10,
  },

  courseToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 18,
    flexWrap: "wrap",
  },

  courseSearchBox: {
    flex: 1,
    minWidth: 260,
    maxWidth: 620,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 13,
    background: "rgba(15,23,42,0.62)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#64748b",
  },

  courseSearchInput: {
    width: "100%",
    border: 0,
    outline: 0,
    background: "transparent",
    color: "#e2e8f0",
    fontSize: 12,
    fontFamily: "inherit",
  },

  courseCountBadge: {
    padding: "10px 13px",
    borderRadius: 11,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(129,140,248,0.14)",
    fontSize: 11,
    fontWeight: 700,
  },

  courseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
  },

  courseCard: {
    minWidth: 0,
    padding: 20,
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.78), rgba(8,12,28,0.70))",
    border: "1px solid rgba(129,140,248,0.13)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025), 0 18px 50px rgba(0,0,0,0.16)",
  },

  courseCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },

  courseIcon: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    color: "#a5b4fc",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(34,211,238,0.08))",
    border: "1px solid rgba(129,140,248,0.18)",
  },

  courseCodeBadge: {
    padding: "6px 9px",
    borderRadius: 8,
    color: "#67e8f9",
    background: "rgba(34,211,238,0.07)",
    border: "1px solid rgba(34,211,238,0.12)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },

  courseSemester: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.16em",
  },

  courseTitle: {
    margin: "7px 0 17px",
    color: "#f8fafc",
    fontSize: 19,
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
  },

  courseMetaList: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },

  courseMetaRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 1.45,
  },

  courseFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 19,
    paddingTop: 13,
    borderTop: "1px solid rgba(148,163,184,0.08)",
    color: "#475569",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.10em",
  },

  timetableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 22,
  },

  timetableTitle: {
    margin: "7px 0 6px",
    fontSize: "clamp(28px, 3vw, 40px)",
    letterSpacing: "-0.035em",
  },

  timetableDescription: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
  },

  timetableIdentity: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 14,
  },

  timetableIdentityLabel: {
    display: "block",
    color: "#475569",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.16em",
    marginBottom: 6,
  },

  timetableIdentityStrong: {
    color: "#e2e8f0",
    fontSize: 11,
    lineHeight: 1.35,
  },

  dayBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    padding: 8,
    marginBottom: 18,
    borderRadius: 16,
    background: "rgba(15,23,42,0.58)",
    border: "1px solid rgba(148,163,184,0.11)",
  },

  dayButton: {
    border: "1px solid transparent",
    background: "transparent",
    color: "#64748b",
    padding: "9px 13px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  },

  dayButtonActive: {
    color: "#e0e7ff",
    background: "rgba(99,102,241,0.15)",
    borderColor: "rgba(129,140,248,0.24)",
    boxShadow: "0 0 20px rgba(99,102,241,0.08)",
  },

  timetableError: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 22,
    borderRadius: 20,
    background: "rgba(127,29,29,0.12)",
    border: "1px solid rgba(248,113,113,0.15)",
  },

  timetableEmpty: {
    minHeight: 330,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 30,
    boxSizing: "border-box",
    borderRadius: 22,
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.11)",
  },

  emptyCalendarIcon: {
    width: 68,
    height: 68,
    display: "grid",
    placeItems: "center",
    marginBottom: 18,
    borderRadius: 20,
    color: "#a5b4fc",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(34,211,238,0.08))",
    border: "1px solid rgba(129,140,248,0.20)",
    boxShadow: "0 0 45px rgba(99,102,241,0.10)",
  },

  timetableEmptyTitle: {
    margin: "8px 0 7px",
    fontSize: 20,
  },

  timetableEmptyText: {
    maxWidth: 560,
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.6,
  },

  emptyHint: {
    marginTop: 15,
    color: "#475569",
    fontSize: 9,
  },

  timetableSpinner: {
    marginBottom: 15,
    color: "#a5b4fc",
  },

  timetableList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  timetableCard: {
    display: "grid",
    gridTemplateColumns: "92px 18px minmax(0, 1fr)",
    alignItems: "stretch",
    minHeight: 125,
    borderRadius: 18,
    background: "rgba(15,23,42,0.58)",
    border: "1px solid rgba(148,163,184,0.11)",
    overflow: "hidden",
  },

  timeColumn: {
    padding: "22px 10px 22px 20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 5,
  },

  timelineLine: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#818cf8",
    boxShadow: "0 0 16px rgba(129,140,248,0.8)",
    zIndex: 2,
  },

  classContent: {
    padding: "20px 22px",
    borderLeft: "1px solid rgba(148,163,184,0.08)",
  },

  classTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 7,
  },

  classDay: {
    color: "#67e8f9",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  classCode: {
    color: "#818cf8",
    fontSize: 10,
    fontWeight: 800,
  },

  classTitle: {
    margin: 0,
    color: "#f8fafc",
    fontSize: 17,
    letterSpacing: "-0.02em",
  },

  classMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px 18px",
    marginTop: 12,
    color: "#64748b",
    fontSize: 10,
  },

  identityCard: {
    minWidth: 0,
    padding: "14px 15px",
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.09)",
  },

  scheduleSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 14,
  },

  summaryCard: {
    padding: "14px 15px",
    borderRadius: 14,
    background: "rgba(2,6,23,0.42)",
    border: "1px solid rgba(148,163,184,0.09)",
  },

  summaryLabel: {
    display: "block",
    color: "#475569",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.14em",
    marginBottom: 7,
  },

  summaryValue: {
    display: "block",
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 800,
  },

  dayCount: {
    display: "inline-grid",
    placeItems: "center",
    minWidth: 17,
    height: 17,
    padding: "0 4px",
    borderRadius: 999,
    background: "rgba(129,140,248,0.14)",
    color: "#a5b4fc",
    fontSize: 8,
  },

  nextClassBanner: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    marginBottom: 14,
    padding: "14px 16px",
    borderRadius: 16,
    background:
      "linear-gradient(100deg, rgba(99,102,241,0.13), rgba(34,211,238,0.06))",
    border: "1px solid rgba(129,140,248,0.17)",
    boxShadow: "0 0 35px rgba(99,102,241,0.07)",
  },

  nextClassPulse: {
    width: 9,
    height: 9,
    flexShrink: 0,
    borderRadius: "50%",
    background: "#67e8f9",
    boxShadow: "0 0 16px rgba(103,232,249,0.9)",
  },

  nextClassContent: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },

  nextClassEyebrow: {
    color: "#818cf8",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.16em",
  },

  nextClassCode: {
    marginLeft: "auto",
    color: "#67e8f9",
    fontSize: 10,
    fontWeight: 800,
  },

  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(170px, 1fr))",
    gap: 9,
    overflowX: "auto",
    paddingBottom: 5,
    alignItems: "start",
  },

  dayColumn: {
    minWidth: 170,
    minHeight: 330,
    padding: 9,
    borderRadius: 17,
    background: "rgba(15,23,42,0.48)",
    border: "1px solid rgba(148,163,184,0.09)",
  },

  dayColumnSelected: {
    borderColor: "rgba(129,140,248,0.24)",
    boxShadow: "0 0 35px rgba(99,102,241,0.06)",
  },

  dayColumnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: "8px 8px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    marginBottom: 9,
  },

  dayColumnShort: {
    display: "block",
    color: "#67e8f9",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.14em",
    marginBottom: 3,
  },

  dayColumnCount: {
    display: "grid",
    placeItems: "center",
    minWidth: 24,
    height: 24,
    borderRadius: 8,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(129,140,248,0.12)",
    fontSize: 9,
    fontWeight: 800,
  },

  daySchedule: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  classCard: {
    position: "relative",
    overflow: "hidden",
    padding: 13,
    borderRadius: 13,
    background: "rgba(2,6,23,0.50)",
    border: "1px solid rgba(148,163,184,0.09)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
  },

  classCardNext: {
    borderColor: "rgba(103,232,249,0.24)",
    boxShadow:
      "0 0 22px rgba(34,211,238,0.07), inset 0 1px 0 rgba(255,255,255,0.03)",
  },

  classTimeRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 7,
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 10,
  },

  classAccent: {
    width: 26,
    height: 2,
    marginBottom: 10,
    background: "linear-gradient(90deg, #818cf8, #67e8f9)",
    boxShadow: "0 0 10px rgba(129,140,248,0.45)",
  },

  classMetaStack: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 11,
    color: "#64748b",
    fontSize: 9,
  },

  classMetaStackItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  nextBadge: {
    display: "inline-flex",
    alignItems: "center",
    marginTop: 11,
    padding: "4px 7px",
    borderRadius: 999,
    color: "#a5f3fc",
    background: "rgba(34,211,238,0.08)",
    border: "1px solid rgba(103,232,249,0.14)",
    fontSize: 7,
    fontWeight: 800,
    letterSpacing: "0.12em",
  },

  noClassDay: {
    minHeight: 250,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "#334155",
    fontSize: 9,
  },

  noSelectedDay: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 10,
    padding: 16,
    borderRadius: 14,
    color: "#64748b",
    background: "rgba(15,23,42,0.45)",
    border: "1px solid rgba(148,163,184,0.08)",
    fontSize: 10,
  },

  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    marginTop: 8,
    padding: "18px 2px 8px",
    borderTop: "1px solid rgba(148,163,184,0.08)",
    color: "#64748b",
    fontSize: 9,
    letterSpacing: "0.04em",
  },

  footerBrand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  footerLogo: {
    width: 34,
    height: 34,
    flex: "0 0 34px",
    objectFit: "contain",
    borderRadius: "50%",
    filter:
      "drop-shadow(0 0 8px rgba(60,180,255,0.24)) drop-shadow(0 0 14px rgba(105,82,255,0.14))",
  },

  footerBrandName: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },

  footerBrandSubtitle: {
    marginTop: 3,
    color: "#475569",
    fontSize: 7,
    fontWeight: 800,
    letterSpacing: "0.13em",
  },

  footerMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
    color: "#475569",
    fontSize: 8,
  },

  footerDivider: {
    color: "#334155",
  },

  loadingShell: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
  },

  loadingOrb: {
    width: 76,
    height: 76,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#a5b4fc",
    background:
      "radial-gradient(circle, rgba(99,102,241,0.24), rgba(34,211,238,0.08), transparent 70%)",
    border: "1px solid rgba(129,140,248,0.25)",
    boxShadow: "0 0 60px rgba(99,102,241,0.18)",
  },

  loadingTitle: {
    margin: "24px 0 8px",
    fontSize: 24,
  },

  loadingText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
  },

  loadingLine: {
    width: 180,
    height: 2,
    marginTop: 22,
    background:
      "linear-gradient(90deg, transparent, #818cf8, #67e8f9, transparent)",
    boxShadow: "0 0 18px rgba(129,140,248,0.45)",
  },

  errorShell: {
    width: "min(520px, calc(100% - 40px))",
    minHeight: 300,
    margin: "15vh auto 0",
    padding: 34,
    boxSizing: "border-box",
    borderRadius: 22,
    textAlign: "center",
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(248,113,113,0.15)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.35)",
  },

  errorIcon: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    margin: "0 auto 20px",
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.20)",
    color: "#fca5a5",
    fontSize: 24,
    fontWeight: 800,
  },

  errorTitle: {
    margin: "8px 0 10px",
    fontSize: 25,
  },

  errorText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  },

  errorActions: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 25,
    flexWrap: "wrap",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px 16px",
    borderRadius: 10,
    border: "1px solid rgba(129,140,248,0.25)",
    background: "rgba(99,102,241,0.16)",
    color: "#c7d2fe",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px 16px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.13)",
    background: "rgba(15,23,42,0.72)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
  },
};