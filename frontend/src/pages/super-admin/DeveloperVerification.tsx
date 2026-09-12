import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Code2, Loader2, ShieldCheck, XCircle } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type DeveloperApplication = {
  user_id: number; email?: string; full_name?: string; developer_id?: string;
  phone?: string; designation?: string; department?: string; experience?: string;
  primary_role?: string; skills?: string; github?: string; linkedin?: string;
  portfolio?: string; bio?: string; submitted_at?: string;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include", ...options,
    headers: { Accept: "application/json", ...(options.body ? {"Content-Type":"application/json"} : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : `Request failed (${response.status})`);
  return data as T;
}

function Detail({label,value}:{label:string;value?:string}) {
  return <div style={styles.detail}><span>{label}</span><strong>{value || "—"}</strong></div>;
}
function date(value?:string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function DeveloperVerification() {
  const [items,setItems]=useState<DeveloperApplication[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<number|null>(null);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true); setError("");
    try {
      const data=await request<{developers?:DeveloperApplication[]}>("/super-admin/developer-verifications/pending");
      setItems(data.developers ?? []);
    } catch(e) {
      setError(e instanceof Error ? e.message : "Unable to load Developer applications.");
    } finally { setLoading(false); }
  },[]);
  useEffect(()=>{load();},[load]);

  const decide=async(userId:number,status:"VERIFIED"|"REJECTED")=>{
    setBusy(userId); setError("");
    try {
      await request(`/super-admin/developer-verifications/${userId}/verify`,{
        method:"PUT",
        body:JSON.stringify({
          status,
          remarks: status==="VERIFIED"
            ? "Developer application approved by Super Admin."
            : "Developer application rejected by Super Admin.",
        }),
      });
      setItems(current=>current.filter(x=>x.user_id!==userId));
    } catch(e) {
      setError(e instanceof Error ? e.message : "Unable to process Developer application.");
    } finally { setBusy(null); }
  };

  return <div style={styles.page}><main style={styles.shell}>
    <header style={styles.header}>
      <div><div style={styles.eyebrow}><Code2 size={14}/> SUPER ADMIN • DEVELOPER CONTROL</div>
      <h1 style={styles.title}>Developer Verification</h1>
      <p style={styles.subtitle}>Review Developer profiles and approve or reject access to the EduSphere Developer platform.</p></div>
      <div style={styles.counter}><Clock3 size={16}/>{items.length} Pending</div>
    </header>
    {error && <div style={styles.error}>{error}</div>}
    {loading ? <div style={styles.empty}><Loader2 style={styles.spin}/><strong>Loading Developer applications...</strong></div>
    : !items.length ? <div style={styles.empty}><CheckCircle2 size={32}/><strong>No pending Developer applications</strong><span>The Developer verification queue is clear.</span></div>
    : <div style={styles.list}>{items.map(a=><article key={a.user_id} style={styles.card}>
      <div style={styles.identity}><div style={styles.avatar}>{a.full_name?.slice(0,1).toUpperCase()||"D"}</div>
      <div><h2 style={styles.name}>{a.full_name||"Developer Applicant"}</h2><p style={styles.email}>{a.email||"—"}</p><span style={styles.badge}>PENDING</span></div></div>
      <div style={styles.details}>
        <Detail label="Developer ID" value={a.developer_id}/><Detail label="Primary Role" value={a.primary_role}/>
        <Detail label="Designation" value={a.designation}/><Detail label="Department" value={a.department}/>
        <Detail label="Experience" value={a.experience}/><Detail label="Phone" value={a.phone}/>
        <Detail label="Submitted" value={date(a.submitted_at)}/><Detail label="Skills" value={a.skills}/>
        <Detail label="GitHub" value={a.github}/><Detail label="LinkedIn" value={a.linkedin}/>
        <Detail label="Portfolio" value={a.portfolio}/><Detail label="Bio" value={a.bio}/>
      </div>
      <div style={styles.actions}>
        <button type="button" disabled={busy===a.user_id} style={styles.reject} onClick={()=>decide(a.user_id,"REJECTED")}><XCircle size={16}/> Reject</button>
        <button type="button" disabled={busy===a.user_id} style={styles.approve} onClick={()=>decide(a.user_id,"VERIFIED")}>
          {busy===a.user_id?<Loader2 style={styles.spin} size={16}/>:<ShieldCheck size={16}/>} Approve Developer
        </button>
      </div>
    </article>)}</div>}
  </main></div>;
}

const styles:Record<string,React.CSSProperties>={
 page:{minHeight:"100vh",padding:30,background:"linear-gradient(135deg,#050b15,#091321 52%,#0c1320)",color:"#f8fafc",fontFamily:"Inter,system-ui,sans-serif"},
 shell:{maxWidth:1160,margin:"0 auto"}, header:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:20,marginBottom:24},
 eyebrow:{display:"flex",alignItems:"center",gap:7,color:"#a5b4fc",fontSize:10,fontWeight:900,letterSpacing:1.2},
 title:{margin:"8px 0 6px",fontSize:34,lineHeight:1.1},subtitle:{margin:0,maxWidth:720,color:"#94a3b8",fontSize:13,lineHeight:1.6},
 counter:{display:"flex",alignItems:"center",gap:7,padding:"10px 13px",borderRadius:10,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",color:"#fcd34d",fontSize:11,fontWeight:900,whiteSpace:"nowrap"},
 error:{padding:13,marginBottom:16,borderRadius:11,background:"rgba(244,63,94,.08)",border:"1px solid rgba(244,63,94,.16)",color:"#fda4af",fontSize:12},
 list:{display:"grid",gap:16}, card:{padding:21,borderRadius:20,background:"rgba(255,255,255,.045)",border:"1px solid rgba(148,163,184,.13)",boxShadow:"0 20px 60px rgba(0,0,0,.18)"},
 identity:{display:"flex",alignItems:"center",gap:13},avatar:{width:50,height:50,borderRadius:14,display:"grid",placeItems:"center",background:"linear-gradient(135deg,#2563eb,#7c3aed)",color:"#fff",fontSize:17,fontWeight:900},
 name:{margin:0,fontSize:18},email:{margin:"4px 0 0",color:"#94a3b8",fontSize:12},badge:{display:"inline-block",marginTop:6,padding:"4px 8px",borderRadius:99,background:"rgba(245,158,11,.1)",color:"#fcd34d",fontSize:9,fontWeight:900},
 details:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:11,marginTop:19,paddingTop:17,borderTop:"1px solid rgba(148,163,184,.08)"},
 detail:{display:"grid",gap:4,minWidth:0,fontSize:11}, actions:{display:"flex",justifyContent:"flex-end",gap:9,marginTop:18,paddingTop:16,borderTop:"1px solid rgba(148,163,184,.08)"},
 reject:{display:"flex",alignItems:"center",gap:7,padding:"10px 14px",borderRadius:10,border:"1px solid rgba(244,63,94,.2)",background:"rgba(244,63,94,.07)",color:"#fda4af",fontWeight:800},
 approve:{display:"flex",alignItems:"center",gap:7,padding:"10px 15px",border:0,borderRadius:10,background:"linear-gradient(135deg,#2563eb,#7c3aed)",color:"#fff",fontWeight:850},
 empty:{minHeight:280,display:"grid",placeItems:"center",alignContent:"center",gap:9,color:"#64748b",borderRadius:20,background:"rgba(255,255,255,.035)"},spin:{animation:"spin 1s linear infinite"}
};
