import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, WalletCards } from "lucide-react";
import "./marketplace-route-onboarding.css";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function MarketplaceRouteOnboarding() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    business_type: "individual",
    legal_business_name: "EduSphere Seller",
    customer_facing_business_name: "EduSphere Seller",
    phone: "",
    bank_account_number: "",
    ifsc_code: "",
    beneficiary_name: "",
    stakeholder_name: "",
    stakeholder_email: "",
    pan: "",
    accept_terms: false,
  });

  const load = async (refresh = false) => {
    try {
      const r = await fetch(
        `${API}/marketplace/easy-split/seller/onboarding${refresh ? "/refresh" : ""}`,
        { method: refresh ? "POST" : "GET", credentials: "include" },
      );
      const d = await r.json().catch(() => ({}));
      if (r.ok) setStatus(d);
      else setError(d.detail || "Unable to load Cashfree vendor status");
    } catch {
      setError("Backend unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const r = await fetch(`${API}/marketplace/easy-split/seller/onboarding`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Cashfree Easy Split onboarding failed");
      setMessage(
        "Cashfree Easy Split vendor created. In Sandbox, Cashfree will process the test verification and the vendor can become ACTIVE automatically.",
      );
      setStatus(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cashfree Easy Split onboarding failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="route-page">
        <div className="route-card">Loading seller payout onboarding…</div>
      </div>
    );
  }

  const verified = status?.payout_status === "VERIFIED";
  const pending = status?.payout_status === "PENDING_VERIFICATION";

  return (
    <div className="route-page">
      <div className="route-card">
        <div className="route-head">
          <div className="route-icon"><WalletCards size={24} /></div>
          <div>
            <h1>Cashfree Easy Split Seller Onboarding</h1>
            <p>Connect your EduSphere seller account to Cashfree Easy Split for marketplace settlement.</p>
          </div>
        </div>

        <div className="route-info" style={{ marginBottom: 14 }}>
          <ShieldCheck size={18} />
          <span>
            <strong>Sandbox / Test Mode:</strong> use Cashfree's published test bank account and PAN details for this onboarding test. Do not enter real banking or KYC data just to test the integration.
          </span>
        </div>

        {verified && (
          <div className="route-success"><CheckCircle2 size={18} /> Cashfree seller account is verified.</div>
        )}
        {pending && (
          <div className="route-info"><ShieldCheck size={18} /> Verification is in progress. Seller payouts remain blocked until Cashfree marks the vendor ACTIVE.</div>
        )}
        {error && <div className="route-error">{error}</div>}
        {message && <div className="route-success">{message}</div>}

        <div className="route-status-row">
          <div>
            <strong>Cashfree vendor status:</strong>{" "}
            {status?.payout_status || "NOT_CONFIGURED"}
            {status?.cashfree_vendor_status ? ` · ${status.cashfree_vendor_status}` : ""}
            {status?.cashfree_vendor_id ? ` · ${status.cashfree_vendor_id}` : ""}
          </div>
          <button type="button" className="route-refresh" onClick={() => load(true)}>
            Refresh verification status
          </button>
        </div>

        {!verified && (
          <form onSubmit={submit} className="route-form">
            <label>
              Business / seller type
              <select value={form.business_type} onChange={e => setForm({ ...form, business_type: e.target.value })}>
                <option value="individual">Individual</option>
                <option value="proprietorship">Proprietorship</option>
                <option value="private_limited">Private Limited</option>
                <option value="llp">LLP</option>
              </select>
            </label>

            <label>
              Legal seller name
              <input required value={form.legal_business_name} onChange={e => setForm({ ...form, legal_business_name: e.target.value })} />
            </label>

            <label>
              Customer-facing name
              <input required value={form.customer_facing_business_name} onChange={e => setForm({ ...form, customer_facing_business_name: e.target.value })} />
            </label>

            <label>
              Phone number
              <input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit test phone" />
            </label>

            <label>
              Cashfree test bank account number
              <input required value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="Use Cashfree Sandbox test data" />
            </label>

            <label>
              IFSC code
              <input required value={form.ifsc_code} onChange={e => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} placeholder="Example: YESB0000262" />
            </label>

            <label>
              Beneficiary name
              <input required value={form.beneficiary_name} onChange={e => setForm({ ...form, beneficiary_name: e.target.value })} placeholder="For Cashfree test data: John Doe" />
            </label>

            <label>
              PAN (Cashfree Sandbox test PAN)
              <input required value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="Example: ABCPV1234D" />
            </label>

            <label>
              Stakeholder name
              <input required value={form.stakeholder_name} onChange={e => setForm({ ...form, stakeholder_name: e.target.value })} />
            </label>

            <label>
              Stakeholder email
              <input type="email" value={form.stakeholder_email} onChange={e => setForm({ ...form, stakeholder_email: e.target.value })} />
            </label>

            <label className="route-check">
              <input type="checkbox" checked={form.accept_terms} onChange={e => setForm({ ...form, accept_terms: e.target.checked })} />
              I agree to the Cashfree Easy Split seller onboarding terms and consent to Cashfree vendor verification.
            </label>

            <button disabled={saving}>
              {saving ? "Creating Cashfree vendor…" : "Create Cashfree Test Vendor"}
            </button>
          </form>
        )}

        <p className="route-note">
          Cashfree Easy Split requires a vendor before marketplace seller settlements can be created. Sandbox test vendors use Cashfree's published test account/KYC data and can move to ACTIVE automatically after verification.
        </p>
      </div>
    </div>
  );
}
