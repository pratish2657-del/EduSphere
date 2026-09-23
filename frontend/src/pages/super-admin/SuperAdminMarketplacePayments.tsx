import "./super-admin-marketplace-payments.css";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type PendingPayment = {
  payment_id: number;
  order_id: number;
  buyer_id: number;
  buyer_name?: string | null;
  buyer_email?: string | null;
  payment_method: string;
  status: string;
  amount: number | string;
  currency: string;
  utr_number?: string | null;
  payer_upi_id?: string | null;
  payer_phone?: string | null;
  submitted_at?: string | null;
  institution_name?: string | null;
  order_status?: string | null;
  subtotal_amount?: number | string;
  tax_percent?: number | string;
  tax_amount?: number | string;
  total_amount?: number | string;
};

const money = (value: number | string | null | undefined) =>
  `₹${Number(value || 0).toFixed(2)}`;

export default function SuperAdminMarketplacePayments() {
  const [items, setItems] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/marketplace/payments/admin/pending`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map((item) =>
                typeof item === "string"
                  ? item
                  : item && typeof item === "object" && "msg" in item
                    ? String(item.msg)
                    : JSON.stringify(item)
              )
              .join("; ")
          : detail && typeof detail === "object"
            ? "msg" in detail
              ? String(detail.msg)
              : JSON.stringify(detail)
            : typeof data?.message === "string"
              ? data.message
              : "Unable to load pending UPI payments.";

    throw new Error(message);
      }
      setItems(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pending UPI payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async (paymentId: number) => {
    if (!window.confirm(`Verify payment #${paymentId}? Confirm the transaction against your bank/UPI records first.`)) {
      return;
    }

    setBusyId(paymentId);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${API}/marketplace/payments/admin/verify`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payment_id: paymentId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map((item) =>
                typeof item === "string"
                  ? item
                  : item && typeof item === "object" && "msg" in item
                    ? String(item.msg)
                    : JSON.stringify(item)
              )
              .join("; ")
          : detail && typeof detail === "object"
            ? "msg" in detail
              ? String(detail.msg)
              : JSON.stringify(detail)
            : typeof data?.message === "string"
              ? data.message
              : "Unable to verify payment.";

    throw new Error(message);
      }
      setMessage(`Payment #${paymentId} verified. The order is now confirmed and the receipt is generated.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify payment.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="sapm-page">
      <header className="sapm-head">
        <div>
          <span>SUPER ADMIN · MARKETPLACE PAYMENTS</span>
          <h1>Manual UPI Verification</h1>
          <p>Review submitted UTR details and verify the real payment before an order is confirmed.</p>
        </div>
        <button onClick={load} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      {message && <div className="sapm-success">{message}</div>}
      {error && <div className="sapm-error">{error}</div>}

      <section className="sapm-note">
        <ShieldCheck size={18} />
        <div>
          <strong>Manual verification only</strong>
          <p>Submitting a UTR never marks a payment as paid. Verify it only after checking the actual UPI transaction.</p>
        </div>
      </section>

      {loading ? (
        <div className="sapm-empty">Loading pending payments…</div>
      ) : !items.length ? (
        <div className="sapm-empty">
          <CheckCircle2 size={28} />
          <strong>No pending UPI payments</strong>
          <span>New submitted UTRs will appear here.</span>
        </div>
      ) : (
        <div className="sapm-grid">
          {items.map((item) => (
            <article className="sapm-card" key={item.payment_id}>
              <div className="sapm-card-top">
                <div>
                  <span className="sapm-label">PAYMENT ID #{item.payment_id}</span>
                  <h2>ORDER ID #{item.order_id}</h2>
                </div>
                <strong>{money(item.amount)}</strong>
              </div>

              <div className="sapm-details">
                <div><span>Buyer</span><b>{item.buyer_name || "Buyer"}</b><small>{item.buyer_email || "—"}</small></div>
                <div><span>Institution</span><b>{item.institution_name || "—"}</b></div>
                <div><span>UTR</span><b>{item.utr_number || "—"}</b></div>
                <div><span>Payer UPI</span><b>{item.payer_upi_id || "—"}</b></div>
                <div><span>Payer Phone</span><b>{item.payer_phone || "—"}</b></div>
                <div><span>Order Total</span><b>{money(item.total_amount ?? item.amount)}</b></div>
              </div>

              <button
                className="sapm-verify"
                onClick={() => verify(item.payment_id)}
                disabled={busyId === item.payment_id}
              >
                <CheckCircle2 size={16} />
                {busyId === item.payment_id ? "Verifying…" : "Verify Payment"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
