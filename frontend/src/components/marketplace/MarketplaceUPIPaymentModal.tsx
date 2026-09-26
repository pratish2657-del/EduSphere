import { useMemo, useState } from "react";
import { Copy, ExternalLink, QrCode, X } from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type MarketplacePayment = {
  payment_id?: number | null;
  order_id?: number | null;
  payment_method?: string;
  status: string;
  amount: number | string;
  currency?: string;
  upi_id: string;
  payment_name: string;
  payment_phone?: string;
  utr_number?: string | null;
  payer_upi_id?: string | null;
  payer_phone?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  checkout_institution_id?: number | null;
  checkout_shipping_address?: string | null;
};

type Props = {
  payment: MarketplacePayment;
  onClose: () => void;
  onSubmitted: (data: Partial<MarketplacePayment>) => void;
};

function money(value: number | string) {
  const amount = Number(value);
  return `₹${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function MarketplaceUPIPaymentModal({
  payment,
  onClose,
  onSubmitted,
}: Props) {
  const [utr, setUtr] = useState(payment.utr_number ?? "");
  const [payerUpiId, setPayerUpiId] = useState(payment.payer_upi_id ?? "");
  const [payerPhone, setPayerPhone] = useState(payment.payer_phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);

  const amount = Number(payment.amount || 0);
  const currency = payment.currency || "INR";

  const upiUri = useMemo(() => {
    return (
      `upi://pay?pa=${encodeURIComponent(payment.upi_id)}` +
      `&pn=${encodeURIComponent(payment.payment_name)}` +
      `&am=${encodeURIComponent(amount.toFixed(2))}` +
      `&cu=${encodeURIComponent(currency)}`
    );
  }, [amount, currency, payment.payment_name, payment.upi_id]);

  // QR is generated from the exact UPI deep link. The QR service receives only
  // payment routing data, not the buyer's UTR, phone, or payer UPI ID.
  const qrUrl = useMemo(
    () =>
      `https://quickchart.io/qr?size=280&margin=2&text=${encodeURIComponent(
        upiUri
      )}`,
    [upiUri]
  );

  const mobileDevice = isMobileDevice();

  const copyUpiId = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(payment.upi_id);
      setCopied(true);
      setMessage("UPI ID copied. Open Google Pay and paste it to pay.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy the UPI ID. Please copy it manually.");
    }
  };

  const openUpiApp = () => {
    setError("");
    setMessage("Opening your UPI app...");

    try {
      // Never assign window.location to a upi:// URL. That can navigate the
      // EduSphere page away from the React application and produce a black
      // screen after returning to the browser.
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.border = "0";
      iframe.src = upiUri;
      document.body.appendChild(iframe);

      window.setTimeout(() => iframe.remove(), 2000);
    } catch {
      setError("Unable to open the UPI app. Please use the QR code instead.");
    }
  };

  const submit = async () => {
    const cleanUtr = utr.trim();
    const cleanPayerUpiId = payerUpiId.trim();
    const cleanPayerPhone = payerPhone.trim();

    if (!cleanUtr) {
      setError("Enter the UTR / transaction reference.");
      return;
    }

    if (!cleanPayerUpiId) {
      setError("Enter the UPI ID used for payment.");
      return;
    }

    if (!cleanPayerPhone) {
      setError("Enter the phone number used for payment.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const isCheckoutDraft =
        !Number.isFinite(Number(payment.payment_id)) ||
        Number(payment.payment_id) <= 0;

      const endpoint = isCheckoutDraft
        ? `${API_BASE_URL}/marketplace/payments/submit-checkout`
        : `${API_BASE_URL}/marketplace/payments/${payment.payment_id}/submit-utr`;

      const body = isCheckoutDraft
        ? {
            institution_id: Number(payment.checkout_institution_id),
            shipping_address: payment.checkout_shipping_address ?? null,
            utr_number: cleanUtr,
            payer_upi_id: cleanPayerUpiId,
            payer_phone: cleanPayerPhone,
          }
        : {
            utr_number: cleanUtr,
            payer_upi_id: cleanPayerUpiId,
            payer_phone: cleanPayerPhone,
          };

      if (
        isCheckoutDraft &&
        !Number.isFinite(Number(payment.checkout_institution_id))
      ) {
        throw new Error("Checkout institution information is missing.");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          String(
            data?.detail ||
              data?.message ||
              `Unable to submit payment details (${response.status})`
          )
        );
      }

      onSubmitted({
        ...(data || {}),
        utr_number: cleanUtr,
        payer_upi_id: cleanPayerUpiId,
        payer_phone: cleanPayerPhone,
      });

      setMessage(
        "Payment details submitted successfully. Your payment is now pending Super Admin verification."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit payment details."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="marketplace-upi-overlay-responsive"
      style={styles.overlay}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="marketplace-upi-modal-responsive"
        style={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-upi-payment-title"
      >
        <div style={styles.header}>
          <div>
            <span style={styles.eyebrow}>DIRECT UPI PAYMENT</span>
            <h2 id="marketplace-upi-payment-title" style={styles.title}>
              Complete Payment
            </h2>
            <p style={styles.order}>
              {Number.isFinite(Number(payment.order_id)) && Number(payment.order_id) > 0
                ? `Order #${payment.order_id}`
                : "Order will be created after payment details are submitted"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={styles.closeButton}
            aria-label="Close payment window"
          >
            <X size={19} />
          </button>
        </div>

        <div className="marketplace-upi-summary-responsive" style={styles.summary}>
          <div style={styles.summaryCell}>
            <span style={styles.label}>Amount</span>
            <strong style={styles.value}>{money(payment.amount)}</strong>
          </div>
          <div style={styles.summaryCell}>
            <span style={styles.label}>Pay to</span>
            <strong style={styles.value}>{payment.payment_name}</strong>
          </div>
          <div style={styles.summaryCell}>
            <span style={styles.label}>UPI ID</span>
            <strong style={styles.value}>{payment.upi_id}</strong>
          </div>
          <div style={styles.summaryCell}>
            <span style={styles.label}>Status</span>
            <strong style={styles.value}>{payment.status}</strong>
          </div>
        </div>

        <div className="marketplace-upi-payment-area-responsive" style={styles.paymentArea}>
          <div className="marketplace-upi-qr-section-responsive" style={styles.qrSection}>
            <div style={styles.qrTitleRow}>
              <QrCode size={17} />
              <strong>Scan to pay</strong>
            </div>

            {!qrError ? (
              <img
                src={qrUrl}
                alt="UPI payment QR code"
                width={220}
                height={220}
                style={styles.qr}
                onError={() => setQrError(true)}
              />
            ) : (
              <div className="marketplace-upi-qr-fallback" style={styles.qrFallback}>
                <QrCode size={34} />
                <span>QR unavailable</span>
                <small>Use the UPI ID below.</small>
              </div>
            )}

            <span className="marketplace-upi-qr-hint" style={styles.qrHint}>
              Scan this QR with Google Pay or another UPI app.
            </span>
          </div>

          <div className="marketplace-upi-pay-details-responsive" style={styles.payDetails}>
            <span style={styles.label}>Pay exactly</span>
            <strong style={styles.amount}>{money(payment.amount)}</strong>

            <div className="marketplace-upi-upi-id-box" style={styles.upiIdBox}>
              <div>
                <span style={styles.label}>UPI ID</span>
                <code style={styles.upiId}>{payment.upi_id}</code>
              </div>
              <button type="button" onClick={copyUpiId} style={styles.secondaryButton}>
                <Copy size={15} />
                {copied ? "Copied" : "Copy UPI ID"}
              </button>
            </div>

            {mobileDevice && (
              <button
                type="button"
                onClick={openUpiApp}
                style={styles.openButton}
              >
                <ExternalLink size={15} />
                Open UPI App
              </button>
            )}

            {!mobileDevice && (
              <div style={styles.desktopHint}>
                On this computer, scan the QR code with your phone. The page
                will stay open while you complete the payment.
              </div>
            )}
          </div>
        </div>

        <div style={styles.instructionBox}>
          <strong>After payment</strong>
          <ol>
            <li>Complete the exact payment shown above.</li>
            <li>Copy the UTR / transaction reference from your UPI app.</li>
            <li>Enter the UPI ID and phone number used for payment.</li>
            <li>Submit the details for Super Admin verification.</li>
          </ol>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {message && <div className="marketplace-upi-message" style={styles.message}>{message}</div>}

        <div style={styles.form}>
          <label style={styles.formLabel}>
            UTR / Transaction Reference
            <input
              value={utr}
              onChange={(event) => setUtr(event.target.value)}
              placeholder="Enter UTR / transaction reference"
              disabled={busy}
              style={styles.input}
              autoComplete="off"
            />
          </label>

          <label style={styles.formLabel}>
            Payer UPI ID
            <input
              value={payerUpiId}
              onChange={(event) => setPayerUpiId(event.target.value)}
              placeholder="example@upi"
              disabled={busy}
              style={styles.input}
              autoComplete="off"
            />
          </label>

          <label style={styles.formLabel}>
            Payer Phone
            <input
              value={payerPhone}
              onChange={(event) => setPayerPhone(event.target.value)}
              placeholder="10-digit phone number"
              disabled={busy}
              style={styles.input}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
        </div>

        <div className="marketplace-upi-footer-responsive" style={styles.footer}>
          <button type="button" onClick={onClose} disabled={busy} style={styles.secondaryButton}>
            Close
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !["PENDING", "READY"].includes(String(payment.status))}
            style={styles.primaryButton}
          >
            {busy ? "Submitting..." : "Submit Payment Details"}
          </button>
        </div>

        <p style={styles.note}>
          Payment is not automatically confirmed. The order is unlocked only
          after Super Admin verifies the submitted UTR.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "rgba(0, 0, 0, 0.78)",
    overflowY: "auto",
  },
  modal: {
    width: "min(920px, 100%)",
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    border: "1px solid #263653",
    borderRadius: 16,
    background: "#070d19",
    color: "#e5e7eb",
    boxShadow: "0 30px 100px rgba(0,0,0,.55)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    padding: "22px 24px",
    borderBottom: "1px solid #1c2940",
  },
  eyebrow: {
    color: "#9ca3ff",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.13em",
  },
  title: {
    margin: "6px 0 2px",
    fontSize: 24,
    lineHeight: 1.15,
  },
  order: {
    margin: 0,
    color: "#71809a",
    fontSize: 12,
  },
  closeButton: {
    width: 38,
    height: 38,
    border: "1px solid #2a3a56",
    borderRadius: 9,
    background: "#0b1424",
    color: "#9aa8bd",
    cursor: "pointer",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    margin: "20px 24px 0",
    border: "1px solid #20304a",
    borderRadius: 11,
    overflow: "hidden",
  },
  summaryCell: {
    minWidth: 0,
    padding: "13px 14px",
    borderRight: "1px solid #20304a",
  },
  label: {
    display: "block",
    marginBottom: 6,
    color: "#75839a",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  value: {
    display: "block",
    overflow: "hidden",
    color: "#dbe4f4",
    fontSize: 13,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  paymentArea: {
    display: "grid",
    gridTemplateColumns: "minmax(230px, 280px) minmax(0, 1fr)",
    gap: 20,
    margin: "20px 24px 0",
  },
  qrSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    border: "1px solid #20304a",
    borderRadius: 12,
    background: "#0a1220",
  },
  qrTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
    color: "#dbe4f4",
    fontSize: 13,
  },
  qr: {
    display: "block",
    width: 220,
    height: 220,
    padding: 8,
    borderRadius: 10,
    background: "#ffffff",
  },
  qrFallback: {
    width: 220,
    height: 220,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "#8b99ae",
    textAlign: "center",
  },
  qrHint: {
    marginTop: 12,
    color: "#77869e",
    fontSize: 11,
    lineHeight: 1.5,
    textAlign: "center",
  },
  payDetails: {
    padding: 18,
    border: "1px solid #20304a",
    borderRadius: 12,
    background: "#0a1220",
  },
  amount: {
    display: "block",
    marginBottom: 18,
    color: "#f1f5ff",
    fontSize: 27,
  },
  upiIdBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    border: "1px solid #263653",
    borderRadius: 10,
    background: "#0d1728",
  },
  upiId: {
    color: "#c7d2fe",
    fontSize: 13,
    wordBreak: "break-all",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 40,
    padding: "0 13px",
    border: "1px solid #30415e",
    borderRadius: 9,
    background: "#0c1627",
    color: "#dbe4f4",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    width: "100%",
    minHeight: 42,
    marginTop: 14,
    border: "1px solid #4251b8",
    borderRadius: 9,
    background: "#252d72",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  desktopHint: {
    marginTop: 14,
    padding: 11,
    borderRadius: 9,
    background: "#0e192a",
    color: "#8492a8",
    fontSize: 11,
    lineHeight: 1.5,
  },
  instructionBox: {
    margin: "18px 24px 0",
    padding: "13px 15px",
    border: "1px solid #20304a",
    borderRadius: 11,
    background: "#0a1220",
    color: "#8d9ab0",
    fontSize: 12,
    lineHeight: 1.55,
  },
  error: {
    margin: "14px 24px 0",
    padding: "10px 12px",
    border: "1px solid #6b2633",
    borderRadius: 9,
    background: "#251018",
    color: "#fda4af",
    fontSize: 12,
  },
  message: {
    margin: "14px 24px 0",
    padding: "10px 12px",
    border: "1px solid #244f43",
    borderRadius: 9,
    background: "#0d211c",
    color: "#9ee6c9",
    fontSize: 12,
  },
  form: {
    display: "grid",
    gap: 12,
    margin: "18px 24px 0",
  },
  formLabel: {
    display: "grid",
    gap: 7,
    color: "#9aa8bd",
    fontSize: 11,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    minHeight: 43,
    boxSizing: "border-box",
    padding: "0 12px",
    border: "1px solid #2b3b58",
    borderRadius: 9,
    outline: "none",
    background: "#0a1322",
    color: "#e5e7eb",
    fontSize: 13,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
    padding: "16px 24px",
    borderTop: "1px solid #1c2940",
  },
  primaryButton: {
    minHeight: 43,
    padding: "0 16px",
    border: "0",
    borderRadius: 9,
    background: "#6547e8",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  note: {
    margin: "0 24px 18px",
    color: "#64748b",
    fontSize: 10,
    lineHeight: 1.5,
  },
};
