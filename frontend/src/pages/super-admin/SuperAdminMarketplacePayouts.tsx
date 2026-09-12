import { useEffect, useState } from "react";
import { RefreshCw, RotateCcw, ShieldCheck, Play } from "lucide-react";
import "./super-admin-marketplace-payouts.css";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Item = {
  id:number; order_id:number; seller_name:string; seller_email:string;
  gross_amount:number; platform_fee_amount:number; seller_amount:number;
  status:string; payout_status?:string|null; cashfree_vendor_status?:string|null;
  cashfree_vendor_id?:string|null; cashfree_transfer_id?:string|null;
  action?:string; failure_reason?:string|null;
};
type Finance = {gross_sales:number;platform_fees:number;seller_earnings:number;refunds:number;pending_payouts:number;settled_payouts:number};
const money=(n:number)=>`₹${Number(n||0).toFixed(2)}`;

export default function SuperAdminMarketplacePayouts(){
 const [items,setItems]=useState<Item[]>([]); const [finance,setFinance]=useState<Finance|null>(null);
 const [loading,setLoading]=useState(true); const [message,setMessage]=useState(""); const [busy,setBusy]=useState<number|null>(null);
 const load=async()=>{
  setLoading(true); setMessage("");
  try{
   const [p,f]=await Promise.all([
    fetch(`${API}/marketplace/easy-split/payouts`,{credentials:"include"}),
    fetch(`${API}/marketplace/easy-split/finance-summary`,{credentials:"include"})
   ]);
   const pd=await p.json().catch(()=>({})); const fd=await f.json().catch(()=>({}));
   if(!p.ok) throw new Error(pd.detail||"Unable to load payouts");
   setItems(pd.items||[]); if(f.ok)setFinance(fd);
  }catch(e){setMessage(e instanceof Error?e.message:"Backend unavailable")}
  finally{setLoading(false)}
 };
 useEffect(()=>{load()},[]);
 const retry=async(id:number)=>{
  setBusy(id);
  try{
   const r=await fetch(`${API}/marketplace/easy-split/payouts/${id}/retry`,{method:"POST",credentials:"include"});
   const d=await r.json().catch(()=>({})); setMessage(r.ok?"Payout retry completed.":(d.detail||"Retry failed")); await load();
  }catch{setMessage("Backend unavailable")}finally{setBusy(null)}
 };
 const reverse=async(item:Item)=>{
  const raw=window.prompt(`Reversal amount in INR. Leave blank for ${money(item.seller_amount)}.`);
  if(raw===null)return; const amount=raw.trim()?Number(raw):null;
  if(amount!==null&&(!Number.isFinite(amount)||amount<=0)){setMessage("Invalid reversal amount");return}
  setBusy(item.id);
  try{
   const r=await fetch(`${API}/marketplace/easy-split/payouts/${item.id}/reverse`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount,reason:"Super Admin marketplace reversal"})});
   const d=await r.json().catch(()=>({})); setMessage(r.ok?`Reversal created: ${d.reversal_id}`:(d.detail||"Reversal failed")); await load();
  }catch{setMessage("Backend unavailable")}finally{setBusy(null)}
 };
 const action=(x:Item)=>{
  if(x.action==="REVERSE")return <button className="sa-action danger" disabled={busy===x.id} onClick={()=>reverse(x)}><RotateCcw size={14}/> Reverse</button>;
  if(x.action==="RETRY")return <button className="sa-action primary" disabled={busy===x.id} onClick={()=>retry(x.id)}><Play size={14}/> {busy===x.id?"Working…":"Retry"}</button>;
  return <span className="sa-muted">{x.action==="SELLER_ONBOARDING_REQUIRED"?"Seller onboarding required":"Waiting"}</span>;
 };
 return <div className="sa-payout-page">
  <div className="sa-payout-head"><div><h1><ShieldCheck size={23}/> Super Admin · Marketplace Payouts</h1><p>Platform-wide Cashfree Easy Split settlements, fees, refunds and seller payout controls.</p></div><button onClick={load}><RefreshCw size={16}/> Refresh</button></div>
  {finance&&<div className="sa-finance-grid">
   <div><span>Gross Sales</span><strong>{money(finance.gross_sales)}</strong></div><div><span>EduSphere Fees</span><strong>{money(finance.platform_fees)}</strong></div>
   <div><span>Seller Earnings</span><strong>{money(finance.seller_earnings)}</strong></div><div><span>Refunds</span><strong>{money(finance.refunds)}</strong></div>
   <div><span>Pending Payouts</span><strong>{money(finance.pending_payouts)}</strong></div><div><span>Settled Payouts</span><strong>{money(finance.settled_payouts)}</strong></div>
  </div>}
  {message&&<div className="sa-payout-msg">{message}</div>}
  <div className="sa-payout-table"><table><thead><tr><th>Seller</th><th>Order</th><th>Gross</th><th>5% Fee</th><th>Seller Net</th><th>Status</th><th>Cashfree Vendor</th><th>Action</th></tr></thead>
  <tbody>{loading?<tr><td colSpan={8}>Loading…</td></tr>:items.length===0?<tr><td colSpan={8}>No marketplace payouts.</td></tr>:items.map(x=><tr key={x.id}><td>{x.seller_name}<small>{x.seller_email}</small></td><td>#{x.order_id}</td><td>{money(x.gross_amount)}</td><td>{money(x.platform_fee_amount)}</td><td>{money(x.seller_amount)}</td><td><span className={`sa-pill ${String(x.status).toLowerCase()}`}>{String(x.status).replaceAll("_"," ")}</span>{x.failure_reason&&<small className="sa-failure">{x.failure_reason}</small>}</td><td><small>{x.cashfree_vendor_id||"Not connected"}</small>{x.cashfree_transfer_id&&<small>{x.cashfree_transfer_id}</small>}</td><td>{action(x)}</td></tr>)}</tbody>
  </table></div>
 </div>
}
