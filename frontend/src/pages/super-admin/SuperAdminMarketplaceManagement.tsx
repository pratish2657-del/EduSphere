import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import "./super-admin-marketplace-management.css";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Product = {
  id: number;
  name: string;
  description?: string | null;
  preview_image_path?: string | null;
  category?: string | null;
  product_type?: string | null;
  condition_type?: string | null;
  price: number;
  quantity: number;
  is_active: boolean;
  seller_id?: number;
  seller_name?: string | null;
  seller_email?: string | null;
  institution_name?: string | null;
  digital_file_attached?: boolean | number;
};

type Order = {
  id: number;
  buyer_id?: number;
  buyer_name?: string | null;
  buyer_email?: string | null;
  institution_name?: string | null;
  total_amount: number;
  status: string;
  payment_id?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
};

type Summary = {
  products?: number;
  active_listings?: number;
  sellers?: number;
  orders?: number;
  confirmed_sales?: number;
  pending_orders?: number;
};

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`,
    );
  }

  return data;
}

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dateTime = (value?: string | null) => {
  if (!value) return "—";

  const raw = String(value).trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized =
    !hasTimezone &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw)
      ? `${raw.replace(" ", "T")}Z`
      : raw;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SuperAdminMarketplaceManagement() {
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [summary, setSummary] = useState<Summary>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [summaryResponse, productsResponse, ordersResponse] =
        await Promise.all([
          apiRequest<Summary>("/super-admin/marketplace/summary"),
          apiRequest<{ products?: Product[] }>(
            "/super-admin/marketplace/products",
          ),
          apiRequest<{ orders?: Order[] }>(
            "/super-admin/marketplace/orders",
          ),
        ]);

      setSummary(summaryResponse || {});
      setProducts(productsResponse?.products || []);
      setOrders(ordersResponse?.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load marketplace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [
          product.name,
          product.category,
          product.product_type,
          product.condition_type,
          product.seller_name,
          product.seller_email,
          product.institution_name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && product.is_active) ||
        (statusFilter === "HIDDEN" && !product.is_active);

      const matchesType =
        typeFilter === "ALL" ||
        String(product.product_type || "").toUpperCase() === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [products, search, statusFilter, typeFilter]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        [
          order.id,
          order.buyer_name,
          order.buyer_email,
          order.institution_name,
          order.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      return (
        matchesSearch &&
        (statusFilter === "ALL" ||
          String(order.status || "").toUpperCase() === statusFilter)
      );
    });
  }, [orders, search, statusFilter]);

  const toggleProduct = async (product: Product) => {
    setBusyId(product.id);
    setError("");

    try {
      await apiRequest(
        `/super-admin/marketplace/products/${product.id}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ is_active: !product.is_active }),
        },
      );

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, is_active: !item.is_active }
            : item,
        ),
      );

      setSummary((current) => ({
        ...current,
        active_listings:
          Number(current.active_listings || 0) +
          (product.is_active ? -1 : 1),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update product");
    } finally {
      setBusyId(null);
    }
  };

  const updateOrder = async (orderId: number, status: string) => {
    setBusyId(orderId);
    setError("");

    try {
      await apiRequest(
        `/super-admin/marketplace/orders/${orderId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status }),
        },
      );

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status } : order,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order");
    } finally {
      setBusyId(null);
    }
  };

  const collectCodPayment = async (order: Order) => {
    if (!order.payment_id) return;
    setBusyId(order.payment_id);
    setError("");
    try {
      await apiRequest(`/marketplace/payments/${order.payment_id}/cod/collect`, { method: "POST" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to collect COD payment.");
    } finally {
      setBusyId(null);
    }
  };

  const activeProducts = Number(summary.active_listings || 0);
  const totalProducts = Number(summary.products || products.length || 0);
  const hiddenProducts = Math.max(totalProducts - activeProducts, 0);

  return (
    <div className="sam-page">
      <div className="sam-shell">
        <header className="sam-header">
          <div className="sam-heading">
            <button
              className="sam-back"
              onClick={() => window.history.back()}
              title="Go back"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="sam-title-wrap">
              <div className="sam-eyebrow">
                <ShieldCheck size={14} />
                SUPER ADMIN • PLATFORM CONTROL
              </div>
              <h1>Marketplace Management</h1>
              <p>
                Global moderation, listing control and order management for the
                shared EduSphere Marketplace.
              </p>
            </div>
          </div>

          <button className="sam-refresh" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} className={loading ? "sam-spin" : ""} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="sam-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        <section className="sam-hero">
          <div className="sam-hero-icon">
            <ShoppingBag size={25} />
          </div>
          <div>
            <span>SHARED EDUSPHERE MARKETPLACE</span>
            <strong>One platform • One product database • One order system</strong>
            <p>
              Changes made here immediately affect the same marketplace used by
              Students, Professors, Admins and Super Admins.
            </p>
          </div>
        </section>

        <section className="sam-stats">
          <StatCard
            icon={<Package size={19} />}
            label="Total Products"
            value={summary.products ?? products.length}
            hint={`${hiddenProducts} hidden`}
          />
          <StatCard
            icon={<Eye size={19} />}
            label="Active Listings"
            value={summary.active_listings ?? activeProducts}
            hint="Visible to buyers"
            positive
          />
          <StatCard
            icon={<Store size={19} />}
            label="Sellers"
            value={summary.sellers ?? "—"}
            hint="Marketplace sellers"
          />
          <StatCard
            icon={<ShoppingCart size={19} />}
            label="Orders"
            value={summary.orders ?? orders.length}
            hint={`${summary.pending_orders ?? 0} pending`}
          />
          <StatCard
            icon={<TrendingUp size={19} />}
            label="Confirmed Sales"
            value={money(Number(summary.confirmed_sales || 0))}
            hint="Completed marketplace sales"
            positive
          />
        </section>

        <div className="sam-toolbar">
          <div className="sam-tabs">
            <button
              className={tab === "products" ? "active" : ""}
              onClick={() => {
                setTab("products");
                setSearch("");
                setStatusFilter("ALL");
              }}
            >
              <Package size={16} />
              Products
              <span>{products.length}</span>
            </button>
            <button
              className={tab === "orders" ? "active" : ""}
              onClick={() => {
                setTab("orders");
                setSearch("");
                setStatusFilter("ALL");
              }}
            >
              <ShoppingCart size={16} />
              Orders
              <span>{orders.length}</span>
            </button>
          </div>

          <div className="sam-filters">
            <label className="sam-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  tab === "products"
                    ? "Search product, seller or category..."
                    : "Search order, buyer or institution..."
                }
              />
            </label>

            <div className="sam-select">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All status</option>
                {tab === "products" ? (
                  <>
                    <option value="ACTIVE">Active</option>
                    <option value="HIDDEN">Hidden</option>
                  </>
                ) : (
                  <>
                    <option value="PENDING">Pending</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="REFUNDED">Refunded</option>
                  </>
                )}
              </select>
              <ChevronDown size={15} />
            </div>

            {tab === "products" && (
              <div className="sam-select">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="ALL">All types</option>
                  <option value="PHYSICAL">Physical</option>
                  <option value="DIGITAL">Digital</option>
                </select>
                <ChevronDown size={15} />
              </div>
            )}
          </div>
        </div>

        {tab === "products" ? (
          <section className="sam-panel">
            <div className="sam-panel-head">
              <div>
                <h2>Product Listings</h2>
                <p>
                  Review marketplace listings and control their visibility.
                </p>
              </div>
              <div className="sam-result-count">
                {filteredProducts.length} results
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                icon={<Package size={28} />}
                title="No products found"
                text="Try changing your search or filters."
              />
            ) : (
              <div className="sam-table-wrap">
                <table className="sam-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>SELLER</th>
                      <th>TYPE</th>
                      <th>PRICE</th>
                      <th>STOCK</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="sam-product">
                            <div className="sam-product-icon">
                              <Package size={17} />
                            </div>
                            <div>
                              <strong>{product.name}</strong>
                              <span>
                                #{product.id}
                                {product.category
                                  ? ` • ${product.category}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="sam-person">
                            <strong>{product.seller_name || "Seller"}</strong>
                            <span>{product.seller_email || "—"}</span>
                          </div>
                        </td>
                        <td>
                          <span className="sam-type">
                            {product.product_type || "—"}
                          </span>
                          {String(product.product_type || "").toUpperCase() === "DIGITAL" && (
                            <small>{Boolean(product.digital_file_attached) ? "File ready" : "File missing"}</small>
                          )}
                        </td>
                        <td className="sam-price">{money(product.price)}</td>
                        <td>
                          <span
                            className={
                              product.quantity > 0
                                ? "sam-stock"
                                : "sam-stock empty"
                            }
                          >
                            {product.quantity}
                          </span>
                        </td>
                        <td>
                          <StatusBadge
                            active={product.is_active}
                            label={product.is_active ? "ACTIVE" : "HIDDEN"}
                          />
                        </td>
                        <td>
                          <button
                            className={
                              product.is_active
                                ? "sam-action danger"
                                : "sam-action success"
                            }
                            disabled={busyId === product.id}
                            onClick={() => toggleProduct(product)}
                          >
                            {busyId === product.id ? (
                              <RefreshCw size={14} className="sam-spin" />
                            ) : product.is_active ? (
                              <>
                                <EyeOff size={14} /> Hide
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={14} /> Activate
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="sam-panel">
            <div className="sam-panel-head">
              <div>
                <h2>Marketplace Orders</h2>
                <p>
                  Review and control order status across the shared platform.
                </p>
              </div>
              <div className="sam-result-count">
                {filteredOrders.length} results
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : filteredOrders.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart size={28} />}
                title="No orders found"
                text="There are no orders matching your current filters."
              />
            ) : (
              <div className="sam-table-wrap">
                <table className="sam-table">
                  <thead>
                    <tr>
                      <th>ORDER</th>
                      <th>BUYER</th>
                      <th>INSTITUTION</th>
                      <th>AMOUNT</th>
                      <th>PAYMENT</th>
                      <th>DATE</th>
                      <th>STATUS</th>
                      <th>UPDATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <div className="sam-order-id">
                            <ShoppingCart size={16} />
                            <strong>#{order.id}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="sam-person">
                            <strong>{order.buyer_name || "Buyer"}</strong>
                            <span>{order.buyer_email || "—"}</span>
                          </div>
                        </td>
                        <td>{order.institution_name || "—"}</td>
                        <td className="sam-price">
                          {money(order.total_amount)}
                        </td>
                        <td>
                          <span className="sam-type">{order.payment_method || "ONLINE"}</span>
                          {String(order.payment_method || "").toUpperCase() === "COD" && String(order.payment_status || "").toUpperCase() === "PENDING" && (
                            <button
                              className="sam-action success"
                              disabled={!order.payment_id || busyId === order.payment_id}
                              onClick={() => collectCodPayment(order)}
                            >
                              {busyId === order.payment_id ? "Saving…" : "Mark Cash Collected"}
                            </button>
                          )}
                        </td>
                        <td className="sam-date">{dateTime(order.created_at)}</td>
                        <td>
                          <OrderBadge status={order.status} />
                        </td>
                        <td>
                          <div className="sam-select sam-order-select">
                            <select
                              value={order.status}
                              disabled={busyId === order.id}
                              onChange={(event) =>
                                updateOrder(order.id, event.target.value)
                              }
                            >
                              <option value="PENDING">Pending</option>
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="CANCELLED">Cancelled</option>
                              <option value="REFUNDED">Refunded</option>
                            </select>
                            <ChevronDown size={14} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <footer className="sam-footer">
          <div>
            <ShieldCheck size={15} />
            Super Admin moderation controls
          </div>
          <span>
            <Users size={14} /> Shared marketplace data
          </span>
        </footer>
      </div>
      <AIChatbot />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  positive = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
  positive?: boolean;
}) {
  return (
    <article className="sam-stat">
      <div className="sam-stat-top">
        <div className="sam-stat-icon">{icon}</div>
        {positive && <span className="sam-live-dot">LIVE</span>}
      </div>
      <span className="sam-stat-label">{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function StatusBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span className={`sam-status ${active ? "active" : "hidden"}`}>
      {active ? <CheckCircle2 size={13} /> : <EyeOff size={13} />}
      {label}
    </span>
  );
}

function OrderBadge({ status }: { status: string }) {
  const normalized = String(status || "").toUpperCase();
  const isGood = normalized === "CONFIRMED";
  const isBad = normalized === "CANCELLED" || normalized === "REFUNDED";

  return (
    <span
      className={`sam-order-badge ${
        isGood ? "good" : isBad ? "bad" : "pending"
      }`}
    >
      {isGood ? (
        <CheckCircle2 size={13} />
      ) : isBad ? (
        <XCircle size={13} />
      ) : (
        <AlertCircle size={13} />
      )}
      {normalized || "UNKNOWN"}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="sam-loading">
      <RefreshCw size={23} className="sam-spin" />
      <strong>Loading marketplace data…</strong>
      <span>Fetching products and orders from the shared platform.</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="sam-empty">
      <div>{icon}</div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
