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
  cashfree_vendor_id?: string | null;
  cashfree_transfer_id?: string | null;
  transfer_status?: string | null;
  settlement_status?: string | null;
  cashfree_split_status?: string | null;
  cashfree_settlement_id?: string | null;
  cashfree_vendor_status?: string | null;
  transfer_utr?: string | null;
  transfer_time?: string | null;
  settlement_eligibility_date?: string | null;
  failure_reason?: string | null;
  payout_status?: string | null;
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

const formatIST = (value?: string | null) => {
  if (!value) return "—";

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

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
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const upper = (value?: string | null) =>
  String(value || "").trim().toUpperCase();

const getSettlementState = (item: Payout) => {
  const status = upper(item.status);
  const splitStatus = upper(item.cashfree_split_status);
  const explicitSettlement = upper(item.settlement_status);

  if (
    status === "SETTLED" ||
    explicitSettlement === "SETTLED" ||
    Boolean(item.transfer_utr && item.transfer_time)
  ) {
    return "SETTLED";
  }

  if (splitStatus === "CREATED") {
    return "PENDING";
  }

  if (splitStatus === "PENDING") {
    return "WAITING";
  }

  return "NOT_CREATED";
};

const getSettlementLabel = (item: Payout) => {
  const state = getSettlementState(item);

  if (state === "SETTLED") return "SETTLED";
  if (state === "PENDING") return "SETTLEMENT PENDING";
  if (state === "WAITING") return "SPLIT PENDING";
  return "NOT CREATED";
};

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
        fetch(`${API}/marketplace/easy-split/payouts`, { credentials: "include" }),
        fetch(`${API}/marketplace/easy-split/finance-summary`, { credentials: "include" }),
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
      const response = await fetch(`${API}/marketplace/easy-split/payouts/${id}/retry`, {
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

  const verifyCashfree = async (item: Payout) => {
    setBusy(item.id);
    setMsg("");

    try {
      const response = await fetch(
        `${API}/marketplace/easy-split/payouts/${item.id}/verify`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Cashfree verification failed");
      }

      const confirmed = Boolean(data.cashfree_split_confirmed);
      const settlement =
        data?.cashfree?.settlement?.settlement || {};

      if (confirmed) {
        const utr =
          data?.cashfree?.transfer_utr ||
          settlement?.transfer_utr ||
          null;
        const transferTime =
          data?.cashfree?.transfer_time ||
          settlement?.transfer_time ||
          null;

        setMsg(
          utr && transferTime
            ? `Cashfree confirmed settlement for #${item.order_id}. UTR: ${utr}`
            : `Cashfree confirmed the vendor split for #${item.order_id}. Settlement is still pending.`
        );
      } else {
        setMsg(
          `Cashfree payment is processed, but no vendor split is confirmed for #${item.order_id}. Payout remains on hold.`
        );
      }

      await load();
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "Cashfree verification failed"
      );
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
      const response = await fetch(`${API}/marketplace/easy-split/payouts/${item.id}/reverse`, {
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
    const settlementState = getSettlementState(item);

    if (item.action === "REVERSE") {
      return (
        <div className="payout-action-group">
          <button
            className="payout-action secondary"
            disabled={busy === item.id}
            onClick={() => verifyCashfree(item)}
            title="Check the actual Cashfree Easy Split state"
          >
            <RefreshCw size={14} />
            {busy === item.id ? "Checking…" : "Verify Cashfree"}
          </button>

          {settlementState === "SETTLED" && (
            <button
              className="payout-action danger"
              disabled={busy === item.id}
              onClick={() => reverse(item)}
              title="Reverse only after Cashfree confirms settlement"
            >
              <RotateCcw size={14} />
              Reverse
            </button>
          )}
        </div>
      );
    }

    if (
      item.action === "VERIFY" ||
      settlementState === "PENDING" ||
      settlementState === "WAITING"
    ) {
      return (
        <button
          className="payout-action secondary"
          disabled={busy === item.id}
          onClick={() => verifyCashfree(item)}
        >
          <RefreshCw size={14} />
          {busy === item.id ? "Checking…" : "Verify Cashfree"}
        </button>
      );
    }

    if (item.action === "RETRY") {
      return (
        <div className="payout-action-group">
          <button
            className="payout-action primary"
            disabled={busy === item.id}
            onClick={() => retry(item.id)}
          >
            <Play size={14} />
            {busy === item.id ? "Working…" : "Retry"}
          </button>

          <button
            className="payout-action secondary"
            disabled={busy === item.id}
            onClick={() => verifyCashfree(item)}
          >
            <RefreshCw size={14} />
            Verify
          </button>
        </div>
      );
    }

    if (item.action === "SELLER_ONBOARDING_REQUIRED") {
      return (
        <span className="action-muted">
          <CircleAlert size={14} /> Seller onboarding required
        </span>
      );
    }

    return <span className="action-muted">Waiting</span>;
  };


  return (
    <div className="payout-page">
      <div className="payout-head">
        <div>
          <h1><WalletCards size={23} /> Admin Marketplace Payouts</h1>
          <p>Shared EduSphere Cashfree Easy Split settlements across Student, Professor and Admin sellers.</p>
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
              <th>Seller Net</th><th>Status</th><th>Cashfree Vendor</th><th>Action</th>
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
                  {(() => {
                    const settlementState = getSettlementState(item);
                    const displayStatus =
                      settlementState === "SETTLED"
                        ? "SETTLED"
                        : settlementState === "PENDING"
                          ? "SETTLEMENT PENDING"
                          : item.status;

                    return (
                      <>
                        <span className={`pill ${String(item.status).toLowerCase()}`}>
                          {String(displayStatus).replaceAll("_", " ")}
                        </span>

                        {item.failure_reason && (
                          <small className="failure">
                            {item.failure_reason}
                          </small>
                        )}

                        {item.cashfree_split_status && (
                          <small>
                            Split: {item.cashfree_split_status}
                          </small>
                        )}

                        <small>
                          Settlement: {getSettlementLabel(item)}
                        </small>

                        {item.transfer_utr && (
                          <small>UTR: {item.transfer_utr}</small>
                        )}

                        {item.transfer_time && (
                          <small>
                            Transfer time: {formatIST(item.transfer_time)}
                          </small>
                        )}

                        {item.settlement_eligibility_date && (
                          <small>
                            Eligible: {formatIST(item.settlement_eligibility_date)}
                          </small>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td>
                  <small>
                    {item.cashfree_vendor_id || "Not connected"}
                  </small>

                  {item.cashfree_vendor_status && (
                    <small>
                      Vendor: {item.cashfree_vendor_status}
                    </small>
                  )}

                  {item.cashfree_transfer_id && (
                    <small className="transfer">
                      Transfer: {item.cashfree_transfer_id}
                    </small>
                  )}

                  {item.cashfree_settlement_id && (
                    <small>
                      Settlement: {item.cashfree_settlement_id}
                    </small>
                  )}
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
