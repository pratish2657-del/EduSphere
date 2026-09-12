import { useEffect, useState } from "react";
import { RefreshCw, RotateCcw, WalletCards, Play, CircleAlert } from "lucide-react";
import "./marketplace-payout-management.css";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Payout = {
  id: number;
  order_id: number;
  seller_id: number;
  seller_name: string;
  seller_email: string;
  gross_amount: number;
  platform_fee_amount: number;
  seller_amount: number;
  status: string;
  razorpay_linked_account_id?: string | null;
  razorpay_transfer_id?: string | null;
  transfer_status?: string | null;
  settlement_status?: string | null;
  failure_reason?: string | null;
  payout_status?: string | null;
  route_activation_status?: string | null;
  action?: string;
};

type Finance = {
  gross_sales: number;
  platform_fees: number;
  seller_earnings: number;
  refunds: number;
  pending_payouts: number;
  transferred_payouts: number;
  settled_payouts: number;
};

const money = (value: number) => `₹${Number(value || 0).toFixed(2)}`;

export default function MarketplacePayoutManagement() {
  const [items, setItems] = useState<Payout[]>([]);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [payoutResponse, financeResponse] = await Promise.all([
        fetch(`${API}/marketplace/route/payouts`, { credentials: "include" }),
        fetch(`${API}/marketplace/route/finance-summary`, { credentials: "include" }),
      ]);
      const payouts = await payoutResponse.json().catch(() => ({}));
      const summary = await financeResponse.json().catch(() => ({}));
      if (!payoutResponse.ok) throw new Error(payouts.detail || "Unable to load payouts");
      setItems(payouts.items || []);
      if (financeResponse.ok) setFinance(summary);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Unable to load marketplace payouts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const retry = async (id: number) => {
    setBusy(id);
    try {
      const response = await fetch(`${API}/marketplace/route/payouts/${id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      setMsg(response.ok ? "Payout retry/reconciliation completed." : (data.detail || "Payout retry failed"));
      await load();
    } catch {
      setMsg("Backend unavailable");
    } finally {
      setBusy(null);
    }
  };

  const reverse = async (item: Payout) => {
    const raw = window.prompt(`Reversal amount in INR. Leave blank for ${money(item.seller_amount)} full reversal.`);
    if (raw === null) return;
    const amount = raw.trim() ? Number(raw) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      setMsg("Enter a valid reversal amount.");
      return;
    }

    setBusy(item.id);
    try {
      const response = await fetch(`${API}/marketplace/route/payouts/${item.id}/reverse`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount ?? null,
          reason: "EduSphere marketplace payout reversal",
        }),
      });
      const data = await response.json().catch(() => ({}));
      setMsg(response.ok ? `Reversal created: ${data.reversal_id}` : (data.detail || "Reversal failed"));
      await load();
    } catch {
      setMsg("Backend unavailable");
    } finally {
      setBusy(null);
    }
  };

  const action = (item: Payout) => {
    if (item.action === "REVERSE") {
      return (
        <button className="payout-action danger" disabled={busy === item.id} onClick={() => reverse(item)}>
          <RotateCcw size={14} /> Reverse
        </button>
      );
    }
    if (item.action === "RETRY") {
      return (
        <button className="payout-action primary" disabled={busy === item.id} onClick={() => retry(item.id)}>
          <Play size={14} /> {busy === item.id ? "Working…" : "Retry"}
        </button>
      );
    }
    if (item.action === "SELLER_ONBOARDING_REQUIRED") {
      return <span className="action-muted"><CircleAlert size={14} /> Seller onboarding required</span>;
    }
    return <span className="action-muted">Waiting</span>;
  };

  return (
    <div className="payout-page">
      <div className="payout-head">
        <div>
          <h1><WalletCards size={23} /> Admin Marketplace Payouts</h1>
          <p>Shared EduSphere Route settlements across Student, Professor and Admin sellers.</p>
        </div>
        <button onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </div>

      {finance && (
        <div className="finance-grid">
          <div><span>Gross Sales</span><strong>{money(finance.gross_sales)}</strong></div>
          <div><span>EduSphere Fees</span><strong>{money(finance.platform_fees)}</strong></div>
          <div><span>Seller Earnings</span><strong>{money(finance.seller_earnings)}</strong></div>
          <div><span>Refunds</span><strong>{money(finance.refunds)}</strong></div>
          <div><span>Pending Payouts</span><strong>{money(finance.pending_payouts)}</strong></div>
          <div><span>Settled Payouts</span><strong>{money(finance.settled_payouts)}</strong></div>
        </div>
      )}

      {msg && <div className="payout-msg">{msg}</div>}

      <div className="payout-table">
        <table>
          <thead>
            <tr>
              <th>Seller</th><th>Order</th><th>Gross</th><th>5% Fee</th>
              <th>Seller Net</th><th>Status</th><th>Route</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8}>No marketplace payout transactions.</td></tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td>{item.seller_name}<small>{item.seller_email}</small></td>
                <td>#{item.order_id}</td>
                <td>{money(item.gross_amount)}</td>
                <td>{money(item.platform_fee_amount)}</td>
                <td>{money(item.seller_amount)}</td>
                <td>
                  <span className={`pill ${String(item.status).toLowerCase()}`}>
                    {String(item.status).replaceAll("_", " ")}
                  </span>
                  {item.failure_reason && <small className="failure">{item.failure_reason}</small>}
                </td>
                <td>
                  <small>{item.razorpay_linked_account_id || "Not connected"}</small>
                  {item.razorpay_transfer_id && <small className="transfer">{item.razorpay_transfer_id}</small>}
                </td>
                <td>{action(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
