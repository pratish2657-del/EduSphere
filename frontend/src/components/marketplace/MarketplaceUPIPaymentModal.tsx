import { useState } from "react";
import { Copy, X } from "lucide-react";
import "./MarketplaceUPIPaymentModal.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type MarketplacePayment = {
  payment_id: number;
  order_id: number;
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
  const [success, setSuccess] = useState("");
  const [submitted, setSubmitted] = useState(
    Boolean(payment.utr_number && payment.submitted_at)
  );
  const [copied, setCopied] = useState(false);

  const amount = Number(payment.amount || 0);
  const upiLink =
    `upi://pay?pa=${encodeURIComponent(payment.upi_id)}` +
    `&pn=${encodeURIComponent(payment.payment_name)}` +
    `&am=${encodeURIComponent(amount.toFixed(2))}` +
    `&cu=${encodeURIComponent(payment.currency || "INR")}`;

  const openUpiApp = () => {
    try {
      // Trigger the UPI deep link without rendering a normal navigation link.
      window.location.href = upiLink;
    } catch {
      setError("Unable to open the UPI app. Please use the UPI ID manually.");
    }
  };

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(payment.upi_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Unable to copy the UPI ID. Please copy it manually.");
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
    setSuccess("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/marketplace/payments/${payment.payment_id}/submit-utr`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            utr_number: cleanUtr,
            payer_upi_id: cleanPayerUpiId,
            payer_phone: cleanPayerPhone,
          }),
        }
      );

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

      const submittedPayment = {
        ...(data || {}),
        status: "PENDING",
        utr_number: cleanUtr,
        payer_upi_id: cleanPayerUpiId,
        payer_phone: cleanPayerPhone,
        submitted_at:
          data?.submitted_at || new Date().toISOString(),
      };

      onSubmitted(submittedPayment);
      setSubmitted(true);
      setSuccess(
        "Payment details submitted successfully. Your payment is now PENDING Super Admin verification."
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
      className="marketplace-upi-overlay"
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="marketplace-upi-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="marketplace-upi-header">
          <div>
            <span className="marketplace-upi-eyebrow">DIRECT UPI PAYMENT</span>
            <h2>Complete Payment</h2>
            <p>Order #{payment.order_id}</p>
          </div>
          <button
            type="button"
            className="marketplace-upi-close"
            onClick={onClose}
            aria-label="Close payment window"
          >
            <X size={19} />
          </button>
        </div>

        <div className="marketplace-upi-summary">
          <div>
            <span>Amount</span>
            <strong>{money(payment.amount)}</strong>
          </div>
          <div>
            <span>Pay to</span>
            <strong>{payment.payment_name}</strong>
          </div>
          <div>
            <span>UPI ID</span>
            <strong>{payment.upi_id}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{submitted ? "PENDING VERIFICATION" : payment.status}</strong>
          </div>
        </div>

        <div className="marketplace-upi-actions">
          <button type="button" onClick={copyUpiId}>
            <Copy size={15} />
            {copied ? "Copied" : "Copy UPI ID"}
          </button>
          <button
            type="button"
            onClick={openUpiApp}
            className="marketplace-upi-open-button"
          >
            Open UPI App
          </button>
        </div>

        <div className="marketplace-upi-instruction">
          <strong>How to pay</strong>
          <ol>
            <li>Open Google Pay or another UPI app.</li>
            <li>Pay the exact amount shown above.</li>
            <li>After payment, enter the transaction details below.</li>
            <li>Super Admin will manually verify the payment.</li>
          </ol>
        </div>

        {error && <div className="marketplace-upi-error">{error}</div>}
        {success && (
          <div
            className="marketplace-upi-success"
            role="status"
            aria-live="polite"
          >
            {success}
          </div>
        )}

        <div className="marketplace-upi-form">
          <label>
            UTR / Transaction Reference
            <input
              value={utr}
              onChange={(event) => { setUtr(event.target.value); setSuccess(""); }}
              placeholder="Enter UTR / transaction reference"
              autoComplete="off"
            />
          </label>

          <label>
            Payer UPI ID
            <input
              value={payerUpiId}
              onChange={(event) => { setPayerUpiId(event.target.value); setSuccess(""); }}
              placeholder="example@upi"
              autoComplete="off"
            />
          </label>

          <label>
            Payer Phone
            <input
              value={payerPhone}
              onChange={(event) => { setPayerPhone(event.target.value); setSuccess(""); }}
              placeholder="10-digit phone number"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
        </div>

        <div className="marketplace-upi-footer">
          <button type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            type="button"
            className="marketplace-upi-submit"
            onClick={submit}
            disabled={busy || submitted}
          >
            {busy
              ? "Submitting..."
              : submitted
                ? "Payment Details Submitted"
                : "Submit Payment Details"}
          </button>
        </div>

        <p className="marketplace-upi-note">
          Your payment is not automatically confirmed. The order is unlocked
          only after Super Admin verifies the submitted UTR.
        </p>
      </div>
    </div>
  );
}
