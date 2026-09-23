import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

type PendingPayment = {
  payment_id: number;
  order_id: number;
  buyer_id: number;
  buyer_name?: string | null;
  buyer_email?: string | null;
  institution_name?: string | null;
  subtotal: number | string;
  tax_percent: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  currency: string;
  utr: string;
  payer_upi_id: string;
  payer_phone: string;
  created_at: string;
};

async function api<T>(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Request failed.");
  }
  return data as T;
}

const money = (value: number | string, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(value || 0));

export default function SuperAdminMarketplacePayouts() {
  const [items, setItems] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await api<{ count: number; payments: PendingPayment[] }>(
        "/marketplace/payments/admin/pending"
      );
      setItems(data.payments || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to load pending UPI payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = async (payment: PendingPayment) => {
    setBusyId(payment.payment_id);
    setMessage("");
    try {
      await api("/marketplace/payments/admin/verify", {
        method: "POST",
        body: JSON.stringify({ payment_id: payment.payment_id }),
      });
      setMessage(`Payment #${payment.payment_id} verified. Order #${payment.order_id} is confirmed.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to verify payment.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="sa-payout-page">
      <div className="sa-payout-head">
        <div>
          <h1><ShieldCheck size={23} /> Super Admin · Manual UPI Payments</h1>
          <p>Review buyer-submitted UTRs and verify actual UPI payments before confirming orders.</p>
        </div>
        <button onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {message && <div className="sa-payout-msg">{message}</div>}

      <div className="sa-payout-table">
        <table>
          <thead>
            <tr>
              <th>Payment</th><th>Order</th><th>Buyer</th><th>Total</th>
              <th>UTR</th><th>Payer UPI</th><th>Phone</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8}>No pending UPI payments.</td></tr>
            ) : items.map((payment) => (
              <tr key={payment.payment_id}>
                <td>#{payment.payment_id}</td>
                <td>#{payment.order_id}</td>
                <td>
                  <strong>{payment.buyer_name || "Unknown buyer"}</strong>
                  <small>{payment.buyer_email || ""}</small>
                </td>
                <td>{money(payment.total_amount, payment.currency)}</td>
                <td><strong>{payment.utr}</strong></td>
                <td>{payment.payer_upi_id}</td>
                <td>{payment.payer_phone}</td>
                <td>
                  <button onClick={() => void verify(payment)} disabled={busyId === payment.payment_id}>
                    <CheckCircle2 size={15} />
                    {busyId === payment.payment_id ? "Verifying…" : "Verify & Confirm"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
