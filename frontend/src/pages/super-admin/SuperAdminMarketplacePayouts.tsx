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
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

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

  // Cashfree settlement/reconciliation details.
  transfer_utr?: string | null;
  transfer_time?: string | null;
  settlement_status?: string | null;
  settlement_eligibility_date?: string | null;

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

const upper = (value?: string | null) =>
  String(value || "").trim().toUpperCase();

const getSettlementState = (item: Item) => {
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

const getSettlementLabel = (item: Item) => {
  const state = getSettlementState(item);

  if (state === "SETTLED") return "SETTLED";
  if (state === "PENDING") return "SETTLEMENT PENDING";
  if (state === "WAITING") return "SPLIT PENDING";
  return "NOT CREATED";
};


export default function SuperAdminMarketplacePayouts() {
  const [items, setItems] = useState<Item[]>([]);
  const [finance, setFinance] =
    useState<Finance | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [busy, setBusy] =
    useState<number | null>(null);


  // ============================================================
  // LOAD
  // ============================================================

  const load = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [payoutResponse, financeResponse] =
        await Promise.all([
          fetch(
            `${API}/marketplace/easy-split/payouts`,
            {
              credentials: "include",
              headers: {
                Accept:
                  "application/json",
              },
            }
          ),

          fetch(
            `${API}/marketplace/easy-split/finance-summary`,
            {
              credentials: "include",
              headers: {
                Accept:
                  "application/json",
              },
            }
          ),
        ]);

      const payoutData =
        await payoutResponse
          .json()
          .catch(
            () => ({})
          );

      const financeData =
        await financeResponse
          .json()
          .catch(
            () => ({})
          );

      if (!payoutResponse.ok) {
        throw new Error(
          payoutData?.detail ||
            payoutData?.message ||
            "Unable to load payouts"
        );
      }

      setItems(
        Array.isArray(
          payoutData?.items
        )
          ? payoutData.items
          : []
      );

      if (financeResponse.ok) {
        setFinance(
          financeData
        );
      }

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
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
  // RETRY
  // ============================================================

  const retry = async (
    id: number
  ) => {
    setBusy(id);
    setMessage("");

    try {
      const response =
        await fetch(
          `${API}/marketplace/easy-split/payouts/${id}/retry`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      await load();

      if (!response.ok) {
        setMessage(
          `❌ ${
            data?.detail ||
            data?.message ||
            data?.error ||
            "Payout retry failed."
          }`
        );

        return;
      }

      const result =
        data?.result || {};

      // --------------------------------------------------------
      // Already processed but no vendor split
      // --------------------------------------------------------

      if (
        result?.already_processed &&
        result?.cashfree_split_confirmed ===
          false
      ) {
        setMessage(
          result?.cashfree_order_id
            ? `⚠️ Cashfree reports ${result.cashfree_order_id} as already processed, but no vendor split was confirmed. The payout remains on hold.`
            : "⚠️ Cashfree reports this transaction as already processed, but no vendor split was confirmed. The payout remains on hold."
        );

        return;
      }

      // --------------------------------------------------------
      // Backend failure
      // --------------------------------------------------------

      if (
        data?.success === false
      ) {
        setMessage(
          `❌ ${
            result?.error ||
            result?.message ||
            result?.reason ||
            data?.error ||
            data?.message ||
            "Cashfree Easy Split rejected the payout."
          }`
        );

        return;
      }

      // --------------------------------------------------------
      // Already processed + confirmed
      // --------------------------------------------------------

      if (
        result?.already_processed &&
        result?.cashfree_split_confirmed ===
          true
      ) {
        setMessage(
          result?.cashfree_order_id
            ? `✅ Cashfree already processed ${result.cashfree_order_id} and the vendor split was confirmed.`
            : "✅ Cashfree already processed the transaction and the vendor split was confirmed."
        );

        return;
      }

      // --------------------------------------------------------
      // Normal successful split
      // --------------------------------------------------------

      if (
        data?.success === true
      ) {
        setMessage(
          result?.cashfree_order_id
            ? `✅ Easy Split created for ${result.cashfree_order_id}.`
            : "✅ Payout retry completed successfully."
        );

        return;
      }

      setMessage(
        `⚠️ Unexpected payout response: ${JSON.stringify(
          data
        )}`
      );

    } catch (error) {
      setMessage(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Backend unavailable"
        }`
      );

    } finally {
      setBusy(null);
    }
  };


  // ============================================================
  // VERIFY CASHFREE
  // ============================================================

  const verifyCashfree = async (
    id: number
  ) => {
    setBusy(id);
    setMessage("");

    try {
      const response =
        await fetch(
          `${API}/marketplace/easy-split/payouts/${id}/verify`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {
        setMessage(
          `❌ ${
            data?.detail ||
            data?.message ||
            data?.error ||
            "Cashfree verification failed"
          }`
        );

        return;
      }

      const local =
        data?.local || {};

      const cashfreeOrderId =
        data?.cashfree_order_id ||
        "order";

      const sellerAmount =
        Number(
          local?.seller_amount || 0
        );

      const confirmed =
        data?.cashfree_split_confirmed ===
        true;

      const reconciliation =
        data?.cashfree?.reconciliation ||
        {};

      const reconciliationData =
        Array.isArray(
          reconciliation?.data
        )
          ? reconciliation.data
          : [];

      const settlement =
        data?.cashfree?.settlement ||
        {};

      const settlementBody =
        settlement?.settlement ||
        {};

      const vendors =
        Array.isArray(
          settlementBody?.vendors
        )
          ? settlementBody.vendors
          : [];

      // --------------------------------------------------------
      // CONFIRMED
      // --------------------------------------------------------

      if (confirmed) {
        const utr =
          data?.cashfree?.transfer_utr ||
          settlementBody?.transfer_utr ||
          null;

        const transferTime =
          data?.cashfree?.transfer_time ||
          settlementBody?.transfer_time ||
          null;

        if (utr && transferTime) {
          setMessage(
            `✅ Cashfree confirmed the vendor split for ${cashfreeOrderId} — Seller ${money(
              sellerAmount
            )} — Settlement SETTLED — UTR ${utr}`
          );
        } else if (utr) {
          setMessage(
            `✅ Cashfree confirmed the vendor split for ${cashfreeOrderId} — Seller ${money(
              sellerAmount
            )} — UTR ${utr}. Settlement time is not reflected yet.`
          );
        } else {
          setMessage(
            `✅ Cashfree confirmed the vendor split for ${cashfreeOrderId} — Seller ${money(
              sellerAmount
            )}. Split is CREATED and settlement is PENDING.`
          );
        }

      } else if (
        reconciliationData.length === 0 &&
        vendors.length === 0
      ) {

        // ------------------------------------------------------
        // NO VENDOR SPLIT
        // ------------------------------------------------------

        setMessage(
          `⚠️ Cashfree payment verified for ${cashfreeOrderId}, but no vendor split is present in Cashfree reconciliation. The local payout has been placed on hold.`
        );

      } else {

        setMessage(
          `⚠️ Cashfree returned transaction data for ${cashfreeOrderId}, but the configured vendor split could not be confirmed. The local payout has been placed on hold.`
        );
      }

      console.log(
        "Cashfree Easy Split verification:",
        data
      );

      // --------------------------------------------------------
      // Refresh database state immediately
      // --------------------------------------------------------

      await load();

    } catch (error) {
      setMessage(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Backend unavailable"
        }`
      );

    } finally {
      setBusy(null);
    }
  };


  // ============================================================
  // REVERSE
  // ============================================================

  const reverse = async (
    item: Item
  ) => {
    const raw =
      window.prompt(
        `Reversal amount in INR. Leave blank for ${money(
          item.seller_amount
        )}.`
      );

    if (raw === null) {
      return;
    }

    const amount =
      raw.trim()
        ? Number(raw)
        : null;

    if (
      amount !== null &&
      (
        !Number.isFinite(amount) ||
        amount <= 0
      )
    ) {
      setMessage(
        "Invalid reversal amount"
      );

      return;
    }

    setBusy(item.id);
    setMessage("");

    try {
      const response =
        await fetch(
          `${API}/marketplace/easy-split/payouts/${item.id}/reverse`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify({
              amount,
              reason:
                "Super Admin marketplace reversal",
            }),
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {
        setMessage(
          `❌ ${
            data?.detail ||
            data?.message ||
            data?.error ||
            "Reversal failed"
          }`
        );

        await load();

        return;
      }

      if (
        data?.success === false
      ) {
        setMessage(
          `❌ ${
            data?.error ||
            data?.message ||
            "Reversal failed"
          }`
        );

        await load();

        return;
      }

      setMessage(
        `✅ Reversal created${
          data?.reversal_id
            ? `: ${data.reversal_id}`
            : "."
        }`
      );

      await load();

    } catch (error) {
      setMessage(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Backend unavailable"
        }`
      );

    } finally {
      setBusy(null);
    }
  };


  // ============================================================
  // ACTION
  // ============================================================

  const action = (
    item: Item
  ) => {

    // ----------------------------------------------------------
    // VERIFY ONLY
    // ----------------------------------------------------------

    if (
      item.action ===
      "VERIFY"
    ) {
      return (
        <div className="sa-action-group">

          <button
            className="sa-action secondary"
            disabled={
              busy === item.id
            }
            onClick={() =>
              verifyCashfree(
                item.id
              )
            }
            title="Verify the actual Cashfree vendor split"
          >
            <Search
              size={14}
            />

            {busy === item.id
              ? "Checking…"
              : "Verify Cashfree"}
          </button>

        </div>
      );
    }


    // ----------------------------------------------------------
    // REVERSE
    // ----------------------------------------------------------

    if (
      item.action ===
      "REVERSE"
    ) {
      return (
        <div className="sa-action-group">

          <button
            className="sa-action secondary"
            disabled={
              busy === item.id
            }
            onClick={() =>
              verifyCashfree(
                item.id
              )
            }
            title="Check the actual Cashfree Easy Split state"
          >
            <Search
              size={14}
            />

            {busy === item.id
              ? "Checking…"
              : "Verify Cashfree"}
          </button>

          {getSettlementState(item) === "SETTLED" && (
            <button
              className="sa-action danger"
              disabled={
                busy === item.id
              }
              onClick={() =>
                reverse(item)
              }
              title="Reverse only after Cashfree confirms settlement"
            >
              <RotateCcw
                size={14}
              />

              {busy === item.id
                ? "Working…"
                : "Reverse"}
            </button>
          )}

        </div>
      );
    }


    // ----------------------------------------------------------
    // RETRY
    // ----------------------------------------------------------

    if (
      item.action ===
      "RETRY"
    ) {
      return (
        <div className="sa-action-group">

          <button
            className="sa-action primary"
            disabled={
              busy === item.id
            }
            onClick={() =>
              retry(item.id)
            }
          >
            <Play
              size={14}
            />

            {busy === item.id
              ? "Working…"
              : "Retry"}
          </button>

          <button
            className="sa-action secondary"
            disabled={
              busy === item.id
            }
            onClick={() =>
              verifyCashfree(
                item.id
              )
            }
            title="Check the actual Cashfree Easy Split state"
          >
            <Search
              size={14}
            />

            {busy === item.id
              ? "Checking…"
              : "Verify"}
          </button>

        </div>
      );
    }


    // ----------------------------------------------------------
    // SELLER ONBOARDING REQUIRED
    // ----------------------------------------------------------

    if (
      item.action ===
      "SELLER_ONBOARDING_REQUIRED"
    ) {
      return (
        <span className="sa-muted">
          Seller onboarding required
        </span>
      );
    }


    // ----------------------------------------------------------
    // DEFAULT
    // ----------------------------------------------------------

    return (
      <span className="sa-muted">
        Waiting
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
            <ShieldCheck
              size={23}
            />

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
          <RefreshCw
            size={16}
          />

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
            <span>
              Gross Sales
            </span>

            <strong>
              {money(
                finance.gross_sales
              )}
            </strong>
          </div>

          <div>
            <span>
              EduSphere Fees
            </span>

            <strong>
              {money(
                finance.platform_fees
              )}
            </strong>
          </div>

          <div>
            <span>
              Seller Earnings
            </span>

            <strong>
              {money(
                finance.seller_earnings
              )}
            </strong>
          </div>

          <div>
            <span>
              Refunds
            </span>

            <strong>
              {money(
                finance.refunds
              )}
            </strong>
          </div>

          <div>
            <span>
              Pending Payouts
            </span>

            <strong>
              {money(
                finance.pending_payouts
              )}
            </strong>
          </div>

          <div>
            <span>
              Settled Payouts
            </span>

            <strong>
              {money(
                finance.settled_payouts
              )}
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
          TABLE
      ====================================================== */}

      <div className="sa-payout-table">

        <table>

          <thead>

            <tr>

              <th>
                Seller
              </th>

              <th>
                Order
              </th>

              <th>
                Gross
              </th>

              <th>
                5% Fee
              </th>

              <th>
                Seller Net
              </th>

              <th>
                Status
              </th>

              <th>
                Cashfree Vendor
              </th>

              <th>
                Action
              </th>

            </tr>

          </thead>


          <tbody>

            {loading ? (

              <tr>
                <td colSpan={8}>
                  Loading…
                </td>
              </tr>

            ) : items.length === 0 ? (

              <tr>
                <td colSpan={8}>
                  No marketplace payouts.
                </td>
              </tr>

            ) : (

              items.map(
                (item) => (
                  <tr
                    key={item.id}
                  >

                    {/* SELLER */}

                    <td>

                      <strong>
                        {
                          item.seller_name
                        }
                      </strong>

                      <small>
                        {
                          item.seller_email
                        }
                      </small>

                    </td>


                    {/* ORDER */}

                    <td>
                      #{item.order_id}
                    </td>


                    {/* GROSS */}

                    <td>
                      {money(
                        item.gross_amount
                      )}
                    </td>


                    {/* FEE */}

                    <td>
                      {money(
                        item.platform_fee_amount
                      )}
                    </td>


                    {/* SELLER NET */}

                    <td>
                      {money(
                        item.seller_amount
                      )}
                    </td>


                    {/* STATUS / SETTLEMENT */}

                    <td>

                      {(() => {
                        const settlementState =
                          getSettlementState(item);

                        const displayStatus =
                          settlementState === "SETTLED"
                            ? "SETTLED"
                            : settlementState === "PENDING"
                              ? "SETTLEMENT PENDING"
                              : item.status;

                        return (
                          <>
                            <span
                              className={`sa-pill ${String(
                                item.status
                              ).toLowerCase()}`}
                              title={
                                settlementState === "PENDING"
                                  ? "Cashfree vendor split is created; seller settlement has not completed yet."
                                  : undefined
                              }
                            >
                              {String(
                                displayStatus
                              ).replaceAll(
                                "_",
                                " "
                              )}
                            </span>

                            {item.failure_reason && (
                              <small
                                className="sa-failure"
                              >
                                {
                                  item.failure_reason
                                }
                              </small>
                            )}

                            {item.cashfree_split_status && (
                              <small>
                                Split:{" "}
                                {
                                  item.cashfree_split_status
                                }
                              </small>
                            )}

                            <small>
                              Settlement:{" "}
                              {getSettlementLabel(item)}
                            </small>

                            {item.transfer_utr && (
                              <small>
                                UTR: {item.transfer_utr}
                              </small>
                            )}

                            {item.transfer_time && (
                              <small>
                                Transfer time:{" "}
                                {item.transfer_time}
                              </small>
                            )}

                            {item.settlement_eligibility_date && (
                              <small>
                                Eligible:{" "}
                                {item.settlement_eligibility_date}
                              </small>
                            )}
                          </>
                        );
                      })()}

                    </td>


                    {/* CASHFREE */}

                    <td>

                      <small>
                        {
                          item.cashfree_vendor_id ||
                          item.razorpay_linked_account_id ||
                          "Not connected"
                        }
                      </small>


                      {item.cashfree_vendor_status && (
                        <small>
                          Status:{" "}
                          {
                            item.cashfree_vendor_status
                          }
                        </small>
                      )}


                      {item.cashfree_transfer_id && (
                        <small>
                          Transfer:{" "}
                          {
                            item.cashfree_transfer_id
                          }
                        </small>
                      )}


                      {item.cashfree_settlement_id && (
                        <small>
                          Settlement ID:{" "}
                          {
                            item.cashfree_settlement_id
                          }
                        </small>
                      )}

                      <small>
                        Settlement:{" "}
                        {getSettlementLabel(item)}
                      </small>

                      {item.transfer_utr && (
                        <small>
                          UTR: {item.transfer_utr}
                        </small>
                      )}

                    </td>


                    {/* ACTION */}

                    <td>
                      {action(item)}
                    </td>

                  </tr>
                )
              )
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}