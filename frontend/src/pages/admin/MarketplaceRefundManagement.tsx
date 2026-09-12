import { useEffect, useState } from "react";
import {
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import "./marketplace-refunds.css";

const API =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Refund = {
  id: number;
  order_id: number;
  payment_id: number;
  buyer_name: string;
  buyer_email: string;
  amount: number;
  reverse_transfers: boolean;
  cashfree_refund_id?: string | null;
  status: string;
  failure_reason?: string | null;
  created_at: string;
  processed_at?: string | null;
};

const money = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

export default function MarketplaceRefundManagement() {
  const [items, setItems] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Refund modal state
  const [showModal, setShowModal] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reverseTransfers, setReverseTransfers] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage("");

    try {
      const r = await fetch(`${API}/marketplace/easy-split/refunds`, {
        credentials: "include",
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(d.detail || "Unable to load refunds");
      }

      setItems(d.items || []);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Backend unavailable"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openRefundModal = () => {
    setPaymentId("");
    setAmount("");
    setReverseTransfers(false);
    setMessage("");
    setShowModal(true);
  };

  const closeRefundModal = () => {
    if (busy) return;

    setShowModal(false);
    setPaymentId("");
    setAmount("");
    setReverseTransfers(false);
  };

  const submitRefund = async () => {
    const parsedPaymentId = Number(paymentId.trim());

    const parsedAmount =
      amount.trim() === "" ? null : Number(amount.trim());

    // Validation
    if (
      !Number.isInteger(parsedPaymentId) ||
      parsedPaymentId <= 0
    ) {
      setMessage("Enter a valid marketplace payment database ID.");
      return;
    }

    if (
      parsedAmount !== null &&
      (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
    ) {
      setMessage("Enter a valid refund amount.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const r = await fetch(
        `${API}/marketplace/easy-split/payments/${parsedPaymentId}/refund`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: parsedAmount,
            reverse_all: reverseTransfers,
            reason: "EduSphere marketplace refund",
          }),
        }
      );

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        setMessage(d.detail || "Refund failed.");
        return;
      }

      setMessage(`Refund created: ${d.refund_id}`);
      setShowModal(false);

      setPaymentId("");
      setAmount("");
      setReverseTransfers(false);

      await load();
    } catch {
      setMessage("Backend unavailable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="refund-page">
      {/* Header */}
      <div className="refund-head">
        <div>
          <h1>
            <RotateCcw size={23} />
            Marketplace Refunds
          </h1>

          <p>
            Admin and Super Admin refund controls with optional
            Cashfree Easy Split transfer reversal.
          </p>
        </div>

        <div className="refund-head-actions">
          <button onClick={load} disabled={loading || busy}>
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            className="refund-primary"
            disabled={busy}
            onClick={openRefundModal}
          >
            <RotateCcw size={16} />
            Issue Refund
          </button>
        </div>
      </div>

      {/* Information */}
      <div className="refund-note">
        <ShieldAlert size={17} />

        <span>
          Refunding a captured marketplace payment can also
          reverse Cashfree Easy Split vendor transfers. Use the reversal option when
          seller funds have already been transferred.
        </span>
      </div>

      {/* Message */}
      {message && (
        <div className="refund-msg">
          {message}
        </div>
      )}

      {/* Refund table */}
      <div className="refund-table">
        <table>
          <thead>
            <tr>
              <th>Refund</th>
              <th>Order</th>
              <th>Buyer</th>
              <th>Amount</th>
              <th>Route Reversal</th>
              <th>Status</th>
              <th>Cashfree</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>Loading…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8}>No refunds recorded.</td>
              </tr>
            ) : (
              items.map((x) => (
                <tr key={x.id}>
                  <td>
                    #{x.id}
                    <small>Payment #{x.payment_id}</small>
                  </td>

                  <td>#{x.order_id}</td>

                  <td>
                    {x.buyer_name}
                    <small>{x.buyer_email}</small>
                  </td>

                  <td>{money(x.amount)}</td>

                  <td>
                    {x.reverse_transfers ? "Yes" : "No"}
                  </td>

                  <td>
                    <span
                      className={`refund-pill ${String(
                        x.status
                      ).toLowerCase()}`}
                    >
                      {x.status}
                    </span>

                    {x.failure_reason && (
                      <small className="refund-error">
                        {x.failure_reason}
                      </small>
                    )}
                  </td>

                  <td>
                    <small>
                      {x.cashfree_refund_id || "—"}
                    </small>
                  </td>

                  <td>
                    <small>
                      {x.created_at
                        ? new Date(x.created_at).toLocaleString()
                        : "—"}
                    </small>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Refund Modal */}
      {showModal && (
        <div
          className="refund-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeRefundModal();
            }
          }}
        >
          <div
            className="refund-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-modal-title"
          >
            {/* Modal header */}
            <div className="refund-modal-header">
              <div>
                <h2 id="refund-modal-title">
                  <RotateCcw size={20} />
                  Issue Marketplace Refund
                </h2>

                <p>
                  Refund a captured marketplace payment through
                  Cashfree.
                </p>
              </div>

              <button
                className="refund-modal-close"
                onClick={closeRefundModal}
                disabled={busy}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="refund-modal-body">
              <div className="refund-field">
                <label htmlFor="refund-payment-id">
                  Marketplace Payment Database ID
                </label>

                <input
                  id="refund-payment-id"
                  type="number"
                  min="1"
                  step="1"
                  value={paymentId}
                  onChange={(e) =>
                    setPaymentId(e.target.value)
                  }
                  placeholder="Example: 10"
                  disabled={busy}
                  autoFocus
                />

                <small>
                  Enter the EduSphere payment database ID, not
                  the Cashfree payment ID.
                </small>
              </div>

              <div className="refund-field">
                <label htmlFor="refund-amount">
                  Refund Amount (INR)
                </label>

                <input
                  id="refund-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value)
                  }
                  placeholder="Leave blank for full refund"
                  disabled={busy}
                />

                <small>
                  Leave blank to refund the entire remaining
                  refundable amount.
                </small>
              </div>

              <label className="refund-checkbox">
                <input
                  type="checkbox"
                  checked={reverseTransfers}
                  onChange={(e) =>
                    setReverseTransfers(e.target.checked)
                  }
                  disabled={busy}
                />

                <span>
                  <strong>
                    Reverse Cashfree Easy Split seller transfers
                  </strong>

                  <small>
                    Enable this only when seller funds have
                    already been transferred through Route.
                  </small>
                </span>
              </label>

              <div className="refund-modal-warning">
                <ShieldAlert size={17} />

                <span>
                  For the current non-Route test, keep Route
                  reversal disabled.
                </span>
              </div>
            </div>

            {/* Modal footer */}
            <div className="refund-modal-footer">
              <button
                className="refund-secondary"
                onClick={closeRefundModal}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                className="refund-primary"
                onClick={submitRefund}
                disabled={busy}
              >
                <RotateCcw size={16} />

                {busy ? "Processing…" : "Issue Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}