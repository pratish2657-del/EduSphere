import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  Store,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import "./admin-marketplace-management.css";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Product = {
  product_id: number;
  seller_id: number;
  seller_name?: string | null;
  seller_email?: string | null;
  institution_id: number;
  institution_name?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  product_type: string;
  condition_type?: string | null;
  price: number | string;
  quantity: number;
  is_active: boolean | number;
  created_at: string;
  updated_at?: string;
  digital_file_attached?: boolean | number;
};

type Order = {
  order_id: number;
  buyer_id?: number;
  buyer_name?: string | null;
  seller_id?: number;
  seller_name?: string | null;
  product_id?: number;
  product_name?: string | null;
  quantity?: number;
  amount?: number | string;
  total_amount?: number | string;
  payment_id?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_address?: string | null;
  status?: string | null;
  created_at: string;
};

type Seller = {
  seller_id: number;
  seller_name?: string | null;
  seller_email?: string | null;
  product_count?: number;
  active_product_count?: number;
  sales_count?: number;
  total_sales?: number | string;
  is_suspended?: boolean | number;
};

type Dashboard = {
  institution_id?: number;
  products?: Product[];
  orders?: Order[];
  sellers?: Seller[];
  stats?: {
    total_products?: number;
    active_products?: number;
    inactive_products?: number;
    total_orders?: number;
    pending_orders?: number;
    completed_orders?: number;
    total_sales?: number | string;
  };
};

type Tab = "overview" | "products" | "sellers" | "orders" | "moderation";

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
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

function money(value: number | string | undefined) {
  const amount = Number(value || 0);
  return `₹${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminMarketplaceManagement() {
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<Dashboard>("/admin/marketplace/dashboard");
      setDashboard(data);
      setProducts(data.products || []);
      setSellers(data.sellers || []);
      setOrders(data.orders || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load marketplace management."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !q ||
        [
          product.name,
          product.description,
          product.category,
          product.product_type,
          product.seller_name,
          product.seller_email,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const active = Boolean(product.is_active);
      const matchesStatus =
        status === "ALL" ||
        (status === "ACTIVE" && active) ||
        (status === "INACTIVE" && !active);

      return matchesSearch && matchesStatus;
    });
  }, [products, search, status]);

  const stats = dashboard?.stats || {
    total_products: products.length,
    active_products: products.filter((p) => Boolean(p.is_active)).length,
    inactive_products: products.filter((p) => !p.is_active).length,
    total_orders: orders.length,
    pending_orders: orders.filter((o) =>
      String(o.status || "").toUpperCase().includes("PENDING")
    ).length,
    completed_orders: orders.filter((o) =>
      ["COMPLETED", "DELIVERED", "PAID"].includes(
        String(o.status || "").toUpperCase()
      )
    ).length,
    total_sales: orders.reduce(
      (sum, order) =>
        sum + Number(order.total_amount ?? order.amount ?? 0),
      0
    ),
  };

  const setProductActive = async (product: Product, active: boolean) => {
    setBusyId(product.product_id);
    try {
      await api(`/admin/marketplace/products/${product.product_id}/status`, {
        method: "PUT",
        body: JSON.stringify({ is_active: active }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change listing status.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Remove "${product.name}" from the marketplace?`)) return;

    setBusyId(product.product_id);
    try {
      await api(`/admin/marketplace/products/${product.product_id}`, {
        method: "DELETE",
      });
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove listing.");
    } finally {
      setBusyId(null);
    }
  };

  const suspendSeller = async (seller: Seller) => {
    setBusyId(seller.seller_id);
    try {
      await api(`/admin/marketplace/sellers/${seller.seller_id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          suspended: !Boolean(seller.is_suspended),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change seller status.");
    } finally {
      setBusyId(null);
    }
  };

  const collectCodPayment = async (order: Order) => {
    if (!order.payment_id) return;
    setBusyId(order.payment_id);
    setError("");
    try {
      await api(`/marketplace/payments/${order.payment_id}/cod/collect`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to collect COD payment.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="amm-page">
      <header className="amm-header">
        <div>
          <span className="amm-eyebrow">EDUSPHERE ADMIN · MARKETPLACE</span>
          <h1>Marketplace Management</h1>
          <p>
            Manage institutional listings, sellers, orders and marketplace
            moderation from one place.
          </p>
        </div>
        <button className="amm-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? "amm-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="amm-alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <section className="amm-stats">
        <Stat icon={<Package size={18} />} label="Total Products" value={stats.total_products ?? 0} />
        <Stat icon={<Store size={18} />} label="Active Listings" value={stats.active_products ?? 0} />
        <Stat icon={<ShoppingBag size={18} />} label="Orders" value={stats.total_orders ?? 0} />
        <Stat icon={<BarChart3 size={18} />} label="Marketplace Sales" value={money(stats.total_sales)} />
      </section>

      <nav className="amm-tabs">
        {([
          ["overview", "Overview"],
          ["products", "Products"],
          ["sellers", "Sellers"],
          ["orders", "Orders"],
          ["moderation", "Moderation"],
        ] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="amm-grid-two">
          <ManagementCard title="Marketplace Health">
            <HealthRow label="Active listings" value={stats.active_products ?? 0} />
            <HealthRow label="Inactive listings" value={stats.inactive_products ?? 0} />
            <HealthRow label="Pending orders" value={stats.pending_orders ?? 0} />
            <HealthRow label="Completed orders" value={stats.completed_orders ?? 0} />
            <HealthRow label="Registered sellers" value={sellers.length} />
          </ManagementCard>

          <ManagementCard title="Admin Controls">
            <div className="amm-control-list">
              <button onClick={() => setTab("products")}>
                <Package size={17} /> Manage all listings
              </button>
              <button onClick={() => setTab("sellers")}>
                <UserRound size={17} /> Manage sellers
              </button>
              <button onClick={() => setTab("orders")}>
                <ShoppingBag size={17} /> Review orders
              </button>
              <button onClick={() => setTab("moderation")}>
                <ShieldAlert size={17} /> Marketplace moderation
              </button>
            </div>
          </ManagementCard>
        </section>
      )}

      {(tab === "products" || tab === "moderation") && (
        <section className="amm-panel">
          <div className="amm-panel-head">
            <div>
              <span className="amm-eyebrow">
                {tab === "moderation" ? "MODERATION QUEUE" : "INSTITUTION LISTINGS"}
              </span>
              <h2>{tab === "moderation" ? "Review Listings" : "All Products"}</h2>
            </div>
            <div className="amm-filters">
              <div className="amm-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search product, seller..."
                />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ALL">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="amm-empty">Loading marketplace listings...</div>
          ) : !filteredProducts.length ? (
            <div className="amm-empty">No marketplace listings found.</div>
          ) : (
            <div className="amm-table-wrap">
              <table className="amm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Seller</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.product_id}>
                      <td>
                        <button className="amm-link" onClick={() => setSelected(product)}>
                          {product.name}
                        </button>
                        <small>{product.category || "Uncategorized"}</small>
                      </td>
                      <td>
                        {product.seller_name || "Seller"}
                        <small>{product.seller_email || "—"}</small>
                      </td>
                      <td>
                        {product.product_type}
                        {String(product.product_type).toUpperCase() === "DIGITAL" && (
                          <small>{Boolean(product.digital_file_attached) ? "File ready" : "File missing"}</small>
                        )}
                      </td>
                      <td>{money(product.price)}</td>
                      <td>{product.quantity}</td>
                      <td>
                        <span className={`amm-badge ${Boolean(product.is_active) ? "active" : "inactive"}`}>
                          {Boolean(product.is_active) ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td>
                        <div className="amm-actions">
                          <button onClick={() => setSelected(product)} title="View">
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => setProductActive(product, !Boolean(product.is_active))}
                            disabled={busyId === product.product_id}
                            title={Boolean(product.is_active) ? "Deactivate" : "Activate"}
                          >
                            {Boolean(product.is_active) ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                          </button>
                          <button
                            className="danger"
                            onClick={() => deleteProduct(product)}
                            disabled={busyId === product.product_id}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {tab === "sellers" && (
        <section className="amm-panel">
          <div className="amm-panel-head">
            <div>
              <span className="amm-eyebrow">SELLER MANAGEMENT</span>
              <h2>Marketplace Sellers</h2>
            </div>
          </div>

          {!sellers.length ? (
            <div className="amm-empty">No seller data available.</div>
          ) : (
            <div className="amm-table-wrap">
              <table className="amm-table">
                <thead>
                  <tr>
                    <th>Seller</th>
                    <th>Listings</th>
                    <th>Sales</th>
                    <th>Revenue</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((seller) => (
                    <tr key={seller.seller_id}>
                      <td>
                        <strong>{seller.seller_name || "Seller"}</strong>
                        <small>{seller.seller_email || "—"}</small>
                      </td>
                      <td>
                        {seller.active_product_count ?? 0} active / {seller.product_count ?? 0}
                      </td>
                      <td>{seller.sales_count ?? 0}</td>
                      <td>{money(seller.total_sales)}</td>
                      <td>
                        <span className={`amm-badge ${Boolean(seller.is_suspended) ? "inactive" : "active"}`}>
                          {Boolean(seller.is_suspended) ? "SUSPENDED" : "ACTIVE"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="amm-table-button"
                          onClick={() => suspendSeller(seller)}
                          disabled={busyId === seller.seller_id}
                        >
                          {Boolean(seller.is_suspended) ? "Restore" : "Suspend"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "orders" && (
        <section className="amm-panel">
          <div className="amm-panel-head">
            <div>
              <span className="amm-eyebrow">ORDER MANAGEMENT</span>
              <h2>Institution Orders</h2>
            </div>
          </div>
          {!orders.length ? (
            <div className="amm-empty">No marketplace orders available.</div>
          ) : (
            <div className="amm-table-wrap">
              <table className="amm-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Buyer</th>
                    <th>Seller</th>
                    <th>Product</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.order_id}>
                      <td>#{order.order_id}</td>
                      <td>{order.buyer_name || "Buyer"}</td>
                      <td>{order.seller_name || "Seller"}</td>
                      <td>{order.product_name || "—"}</td>
                      <td>{money(order.total_amount ?? order.amount)}</td>
                      <td>
                        <span className="amm-badge active">{order.payment_method || "ONLINE"}</span>
                        {String(order.payment_method || "").toUpperCase() === "COD" && String(order.payment_status || "").toUpperCase() === "PENDING" && (
                          <button
                            className="amm-table-button"
                            disabled={!order.payment_id || busyId === order.payment_id}
                            onClick={() => collectCodPayment(order)}
                          >
                            {busyId === order.payment_id ? "Saving…" : "Mark Cash Collected"}
                          </button>
                        )}
                      </td>
                      <td>
                <span className="amm-badge active">
                  {order.status || "—"}
                </span>
                {order.payment_status && (
                  <small>Payment: {order.payment_status}</small>
                )}
              </td>
                      <td>{dateTime(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selected && (
        <div className="amm-overlay" onClick={() => setSelected(null)}>
          <div className="amm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="amm-modal-head">
              <div>
                <span className="amm-eyebrow">LISTING DETAILS</span>
                <h2>{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <p>{selected.description || "No description provided."}</p>
            <div className="amm-detail-grid">
              <div><span>Seller</span><strong>{selected.seller_name || "—"}</strong></div>
              <div><span>Email</span><strong>{selected.seller_email || "—"}</strong></div>
              <div><span>Type</span><strong>{selected.product_type}</strong></div>
              <div><span>Category</span><strong>{selected.category || "—"}</strong></div>
              <div><span>Price</span><strong>{money(selected.price)}</strong></div>
              <div><span>Quantity</span><strong>{selected.quantity}</strong></div>
              <div><span>Condition</span><strong>{selected.condition_type || "—"}</strong></div>
              <div><span>Created</span><strong>{dateTime(selected.created_at)}</strong></div>
            </div>
            <div className="amm-modal-footer">
              <button onClick={() => setProductActive(selected, !Boolean(selected.is_active))}>
                {Boolean(selected.is_active) ? "Deactivate Listing" : "Activate Listing"}
              </button>
              <button className="danger-button" onClick={() => deleteProduct(selected)}>
                <Trash2 size={15} /> Delete Listing
              </button>
            </div>
          </div>
        </div>
      )}
      <AIChatbot />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="amm-stat">
      <div className="amm-stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ManagementCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="amm-management-card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="amm-health-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
