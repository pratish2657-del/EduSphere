import { useEffect, useState } from "react";
import {
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Play,
  Search,
} from "lucide-react";
import "./super-admin-marketplace-payouts.css";

const API =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Item = {
  id: number;
  order_id: number;
  seller_name: string;
  seller_email: string;

  gross_amount: number;
  platform_fee_amount: number;
  seller_amount: number;

  status: string;

  payout_status?: string | null;

  cashfree_vendor_status?: string | null;
  cashfree_vendor_id?: string | null;

  cashfree_split_status?: string | null;
  cashfree_settlement_id?: string | null;
  cashfree_transfer_id?: string | null;

  route_activation_status?: string | null;

  razorpay_linked_account_id?: string | null;
  razorpay_transfer_id?: string | null;

  action?: string;
  failure_reason?: string | null;
};

type Finance = {
  gross_sales: number;
  platform_fees: number;
  seller_earnings: number;
  refunds: number;
  pending_payouts: number;
  settled_payouts: number;
};

const money = (n: number) =>
  `₹${Number(n || 0).toFixed(2)}`;

export default function SuperAdminMarketplacePayouts() {
  const [items, setItems] = useState<Item[]>([]);
  const [finance, setFinance] =
    useState<Finance | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] =
    useState<number | null>(null);

  // ============================================================
  // LOAD PAYOUTS + FINANCE
  // ============================================================

  const load = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [p, f] = await Promise.all([
        fetch(
          `${API}/marketplace/easy-split/payouts`,
          {
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        ),

        fetch(
          `${API}/marketplace/easy-split/finance-summary`,
          {
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        ),
      ]);

      const pd = await p.json().catch(() => ({}));
      const fd = await f.json().catch(() => ({}));

      if (!p.ok) {
        throw new Error(
          pd?.detail ||
            pd?.message ||
            "Unable to load payouts"
        );
      }

      setItems(pd?.items || []);

      if (f.ok) {
        setFinance(fd);
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Backend unavailable"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ============================================================
  // RETRY PAYOUT
  // ============================================================

  const retry = async (id: number) => {
    setBusy(id);
    setMessage("");

    try {
      const r = await fetch(
        `${API}/marketplace/easy-split/payouts/${id}/retry`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const d = await r.json().catch(() => ({}));

      /*
       * Reload the payout table first.
       *
       * load() clears the message, therefore the
       * result message must be displayed afterwards.
       */
      await load();

      // --------------------------------------------------------
      // HTTP ERROR
      // --------------------------------------------------------

      if (!r.ok) {
        const detail =
          d?.detail ||
          d?.message ||
          d?.error ||
          "Payout retry failed.";

        setMessage(`❌ ${detail}`);
        return;
      }

      // --------------------------------------------------------
      // BACKEND SUCCESS = FALSE
      // --------------------------------------------------------

      if (d?.success === false) {
        const result = d?.result || {};

        const error =
          result?.error ||
          result?.message ||
          result?.reason ||
          d?.error ||
          d?.message ||
          "Cashfree Easy Split rejected the payout.";

        setMessage(
          `❌ Easy Split failed: ${error}`
        );

        return;
      }

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      if (d?.success === true) {
        const result = d?.result || {};

        /*
         * Cashfree may report an already-processed
         * transaction as successfully reconciled by
         * the backend.
         */
        if (result?.already_processed) {
          setMessage(
            result?.cashfree_order_id
              ? `✅ Cashfree transaction already processed for ${result.cashfree_order_id}. Local payout reconciled.`
              : "✅ Cashfree transaction already processed. Local payout reconciled."
          );

          return;
        }

        setMessage(
          result?.cashfree_order_id
            ? `✅ Easy Split created for ${result.cashfree_order_id}.`
            : "✅ Payout retry completed successfully."
        );

        return;
      }

      // --------------------------------------------------------
      // UNEXPECTED RESPONSE
      // --------------------------------------------------------

      setMessage(
        `⚠️ Unexpected payout response: ${JSON.stringify(
          d
        )}`
      );
    } catch (e) {
      setMessage(
        `❌ ${
          e instanceof Error
            ? e.message
            : "Backend unavailable"
        }`
      );
    } finally {
      setBusy(null);
    }
  };

  // ============================================================
  // VERIFY CASHFREE SPLIT
  // ============================================================

  const verifyCashfree = async (id: number) => {
    setBusy(id);
    setMessage("");

    try {
      const r = await fetch(
        `${API}/marketplace/easy-split/payouts/${id}/verify`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const d = await r.json().catch(() => ({}));

      // --------------------------------------------------------
      // HTTP ERROR
      // --------------------------------------------------------

      if (!r.ok) {
        setMessage(
          `❌ ${
            d?.detail ||
            d?.message ||
            d?.error ||
            "Cashfree verification failed"
          }`
        );

        return;
      }

      // --------------------------------------------------------
      // LOCAL DATA
      // --------------------------------------------------------

      const local = d?.local || {};

      // --------------------------------------------------------
      // CASHFREE DATA
      // --------------------------------------------------------

      const cashfreeOrderId =
        d?.cashfree_order_id || "order";

      const sellerAmount = Number(
        local?.seller_amount || 0
      );

      const splitStatus =
        local?.cashfree_split_status ||
        "UNKNOWN";

      // --------------------------------------------------------
      // SUCCESS MESSAGE
      // --------------------------------------------------------

      setMessage(
        `✅ Cashfree verified for ${cashfreeOrderId} — Seller ${money(
          sellerAmount
        )} — Split: ${splitStatus}`
      );

      // --------------------------------------------------------
      // DEBUG RESPONSE
      // --------------------------------------------------------

      console.log(
        "Cashfree Easy Split verification:",
        d
      );
    } catch (e) {
      setMessage(
        `❌ ${
          e instanceof Error
            ? e.message
            : "Backend unavailable"
        }`
      );
    } finally {
      setBusy(null);
    }
  };

  // ============================================================
  // REVERSE PAYOUT
  // ============================================================

  const reverse = async (item: Item) => {
    const raw = window.prompt(
      `Reversal amount in INR. Leave blank for ${money(
        item.seller_amount
      )}.`
    );

    // User cancelled
    if (raw === null) {
      return;
    }

    const amount = raw.trim()
      ? Number(raw)
      : null;

    // Validate amount
    if (
      amount !== null &&
      (!Number.isFinite(amount) ||
        amount <= 0)
    ) {
      setMessage("Invalid reversal amount");
      return;
    }

    setBusy(item.id);
    setMessage("");

    try {
      const r = await fetch(
        `${API}/marketplace/easy-split/payouts/${item.id}/reverse`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            amount,
            reason:
              "Super Admin marketplace reversal",
          }),
        }
      );

      const d = await r.json().catch(() => ({}));

      // --------------------------------------------------------
      // HTTP ERROR
      // --------------------------------------------------------

      if (!r.ok) {
        setMessage(
          `❌ ${
            d?.detail ||
            d?.message ||
            d?.error ||
            "Reversal failed"
          }`
        );

        await load();
        return;
      }

      // --------------------------------------------------------
      // BACKEND SUCCESS = FALSE
      // --------------------------------------------------------

      if (d?.success === false) {
        setMessage(
          `❌ ${
            d?.error ||
            d?.message ||
            "Reversal failed"
          }`
        );

        await load();
        return;
      }

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      setMessage(
        `✅ Reversal created${
          d?.reversal_id
            ? `: ${d.reversal_id}`
            : "."
        }`
      );

      await load();
    } catch (e) {
      setMessage(
        `❌ ${
          e instanceof Error
            ? e.message
            : "Backend unavailable"
        }`
      );
    } finally {
      setBusy(null);
    }
  };

  // ============================================================
  // ACTION BUTTON
  // ============================================================

  const action = (x: Item) => {
    // ----------------------------------------------------------
    // TRANSFER INITIATED / CREATED
    // ----------------------------------------------------------

    if (x.action === "REVERSE") {
      return (
        <div className="sa-action-group">
          <button
            className="sa-action secondary"
            disabled={busy === x.id}
            onClick={() =>
              verifyCashfree(x.id)
            }
            title="Check the actual Cashfree Easy Split state"
          >
            <Search size={14} />

            {busy === x.id
              ? "Checking…"
              : "Verify Cashfree"}
          </button>

          <button
            className="sa-action danger"
            disabled={busy === x.id}
            onClick={() => reverse(x)}
          >
            <RotateCcw size={14} />

            {busy === x.id
              ? "Working…"
              : "Reverse"}
          </button>
        </div>
      );
    }

    // ----------------------------------------------------------
    // PENDING / READY / FAILED PAYOUT
    // ----------------------------------------------------------

    if (x.action === "RETRY") {
      return (
        <div className="sa-action-group">
          <button
            className="sa-action primary"
            disabled={busy === x.id}
            onClick={() => retry(x.id)}
          >
            <Play size={14} />

            {busy === x.id
              ? "Working…"
              : "Retry"}
          </button>

          <button
            className="sa-action secondary"
            disabled={busy === x.id}
            onClick={() =>
              verifyCashfree(x.id)
            }
            title="Check the actual Cashfree Easy Split state"
          >
            <Search size={14} />

            {busy === x.id
              ? "Checking…"
              : "Verify"}
          </button>
        </div>
      );
    }

    // ----------------------------------------------------------
    // SELLER ONBOARDING REQUIRED
    // ----------------------------------------------------------

    return (
      <span className="sa-muted">
        {x.action ===
        "SELLER_ONBOARDING_REQUIRED"
          ? "Seller onboarding required"
          : "Waiting"}
      </span>
    );
  };

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="sa-payout-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="sa-payout-head">
        <div>
          <h1>
            <ShieldCheck size={23} />

            Super Admin · Marketplace Payouts
          </h1>

          <p>
            Platform-wide Cashfree Easy Split
            settlements, fees, refunds and seller
            payout controls.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={16} />

          {loading
            ? "Refreshing…"
            : "Refresh"}
        </button>
      </div>

      {/* ======================================================
          FINANCE SUMMARY
      ====================================================== */}

      {finance && (
        <div className="sa-finance-grid">

          <div>
            <span>Gross Sales</span>

            <strong>
              {money(finance.gross_sales)}
            </strong>
          </div>

          <div>
            <span>EduSphere Fees</span>

            <strong>
              {money(finance.platform_fees)}
            </strong>
          </div>

          <div>
            <span>Seller Earnings</span>

            <strong>
              {money(finance.seller_earnings)}
            </strong>
          </div>

          <div>
            <span>Refunds</span>

            <strong>
              {money(finance.refunds)}
            </strong>
          </div>

          <div>
            <span>Pending Payouts</span>

            <strong>
              {money(finance.pending_payouts)}
            </strong>
          </div>

          <div>
            <span>Settled Payouts</span>

            <strong>
              {money(finance.settled_payouts)}
            </strong>
          </div>

        </div>
      )}

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <div className="sa-payout-msg">
          {message}
        </div>
      )}

      {/* ======================================================
          PAYOUT TABLE
      ====================================================== */}

      <div className="sa-payout-table">
        <table>

          <thead>
            <tr>
              <th>Seller</th>
              <th>Order</th>
              <th>Gross</th>
              <th>5% Fee</th>
              <th>Seller Net</th>
              <th>Status</th>
              <th>Cashfree Vendor</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>

            {/* ==================================================
                LOADING
            ================================================== */}

            {loading ? (
              <tr>
                <td colSpan={8}>
                  Loading…
                </td>
              </tr>

            ) : items.length === 0 ? (

              /* ================================================
                 EMPTY
              ================================================= */

              <tr>
                <td colSpan={8}>
                  No marketplace payouts.
                </td>
              </tr>

            ) : (

              /* ================================================
                 ITEMS
              ================================================= */

              items.map((x) => (
                <tr key={x.id}>

                  {/* ============================================
                      SELLER
                  ============================================= */}

                  <td>
                    <strong>
                      {x.seller_name}
                    </strong>

                    <small>
                      {x.seller_email}
                    </small>
                  </td>

                  {/* ============================================
                      ORDER
                  ============================================= */}

                  <td>
                    #{x.order_id}
                  </td>

                  {/* ============================================
                      GROSS
                  ============================================= */}

                  <td>
                    {money(x.gross_amount)}
                  </td>

                  {/* ============================================
                      PLATFORM FEE
                  ============================================= */}

                  <td>
                    {money(
                      x.platform_fee_amount
                    )}
                  </td>

                  {/* ============================================
                      SELLER NET
                  ============================================= */}

                  <td>
                    {money(x.seller_amount)}
                  </td>

                  {/* ============================================
                      STATUS
                  ============================================= */}

                  <td>
                    <span
                      className={`sa-pill ${String(
                        x.status
                      ).toLowerCase()}`}
                    >
                      {String(
                        x.status
                      ).replaceAll(
                        "_",
                        " "
                      )}
                    </span>

                    {/* Failure reason */}

                    {x.failure_reason && (
                      <small className="sa-failure">
                        {x.failure_reason}
                      </small>
                    )}

                    {/* Cashfree split */}

                    {x.cashfree_split_status && (
                      <small>
                        Split:{" "}
                        {x.cashfree_split_status}
                      </small>
                    )}
                  </td>

                  {/* ============================================
                      CASHFREE VENDOR
                  ============================================= */}

                  <td>

                    <small>
                      {x.cashfree_vendor_id ||
                        x.razorpay_linked_account_id ||
                        "Not connected"}
                    </small>

                    {x.cashfree_vendor_status && (
                      <small>
                        Status:{" "}
                        {
                          x.cashfree_vendor_status
                        }
                      </small>
                    )}

                    {x.cashfree_transfer_id && (
                      <small>
                        Transfer:{" "}
                        {
                          x.cashfree_transfer_id
                        }
                      </small>
                    )}

                    {x.cashfree_settlement_id && (
                      <small>
                        Settlement:{" "}
                        {
                          x.cashfree_settlement_id
                        }
                      </small>
                    )}

                  </td>

                  {/* ============================================
                      ACTION
                  ============================================= */}

                  <td>
                    {action(x)}
                  </td>

                </tr>
              ))
            )}

          </tbody>
        </table>
      </div>
    </div>
  );
}