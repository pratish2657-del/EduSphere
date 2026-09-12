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
    legal_business_name: "",
    customer_facing_business_name: "EduSphere Seller",
    phone: "",
    bank_account_number: "",
    ifsc_code: "",
    beneficiary_name: "",
    stakeholder_name: "",
    stakeholder_email: "",
    accept_terms: false,
  });

  const load = async (refresh = false) => {
    try {
      const r = await fetch(
        `${API}/marketplace/route/seller/onboarding${refresh ? "/refresh" : ""}`,
        { method: refresh ? "POST" : "GET", credentials: "include" }
      );
      const d = await r.json().catch(() => ({}));
      if (r.ok) setStatus(d);
      else setError(d.detail || "Unable to load Route status");
    } catch {
      setError("Backend unavailable");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const r = await fetch(`${API}/marketplace/route/seller/onboarding`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Route onboarding failed");
      setMessage("Route onboarding submitted successfully. Razorpay will verify the linked bank account/KYC.");
      setStatus(d);
    } catch (e) { setError(e instanceof Error ? e.message : "Route onboarding failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="route-page"><div className="route-card">Loading seller payout onboarding…</div></div>;

  return <div className="route-page">
    <div className="route-card">
      <div className="route-head"><div className="route-icon"><WalletCards size={24}/></div><div><h1>Seller Payout Onboarding</h1><p>Connect your EduSphere seller account to Razorpay Route for marketplace settlement.</p></div></div>
      {status?.payout_status === "VERIFIED" && <div className="route-success"><CheckCircle2 size={18}/> Route payout account is verified.</div>}
      {status?.payout_status === "PENDING_VERIFICATION" && <div className="route-info"><ShieldCheck size={18}/> Verification is in progress. Transfers remain blocked until Route activation is confirmed.</div>}
      {error && <div className="route-error">{error}</div>}
      {message && <div className="route-success">{message}</div>}
      <div className="route-status-row">
        <div>
          <strong>Route status:</strong>{" "}
          {status?.payout_status || "NOT_CONFIGURED"}
          {status?.route_activation_status ? ` · ${status.route_activation_status}` : ""}
          {status?.razorpay_linked_account_id ? ` · ${status.razorpay_linked_account_id}` : ""}
        </div>
        <button type="button" className="route-refresh" onClick={() => load(true)}>
          Refresh verification status
        </button>
      </div>
      <form onSubmit={submit} className="route-form">
        <label>Business type<select value={form.business_type} onChange={e=>setForm({...form,business_type:e.target.value})}><option value="individual">Individual / Unregistered Business</option><option value="proprietorship">Sole Proprietorship</option><option value="partnership">Partnership</option><option value="private_limited">Private Limited</option><option value="llp">LLP</option></select></label>
        <label>Legal business / seller name<input required value={form.legal_business_name} onChange={e=>setForm({...form,legal_business_name:e.target.value})}/></label>
        <label>Customer-facing name<input required value={form.customer_facing_business_name} onChange={e=>setForm({...form,customer_facing_business_name:e.target.value})}/></label>
        <label>Phone number<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label>Bank account number<input required type="password" value={form.bank_account_number} onChange={e=>setForm({...form,bank_account_number:e.target.value})}/></label>
        <label>IFSC code<input required value={form.ifsc_code} onChange={e=>setForm({...form,ifsc_code:e.target.value.toUpperCase()})}/></label>
        <label>Beneficiary name<input required value={form.beneficiary_name} onChange={e=>setForm({...form,beneficiary_name:e.target.value})}/></label>
        <label>Authorised stakeholder name<input required value={form.stakeholder_name} onChange={e=>setForm({...form,stakeholder_name:e.target.value})}/></label>
        <label>Stakeholder email<input type="email" value={form.stakeholder_email} onChange={e=>setForm({...form,stakeholder_email:e.target.value})}/></label>
        <label className="route-check"><input type="checkbox" checked={form.accept_terms} onChange={e=>setForm({...form,accept_terms:e.target.checked})}/> I agree to the Route onboarding terms and consent to Razorpay KYC/bank verification.</label>
        <button disabled={saving || status?.payout_status === "VERIFIED"}>{saving ? "Submitting…" : status?.payout_status === "VERIFIED" ? "Verified" : "Submit for Route verification"}</button>
      </form>
      <p className="route-note">EduSphere does not store your full bank account number. Only the last four digits and IFSC are retained locally; the full bank details are sent to Razorpay's Route onboarding API.</p>
    </div>
  </div>;
}
