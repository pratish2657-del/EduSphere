import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { BookOpen, Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Program = {
  id: number; institution_id: number; institution_name?: string;
  name: string; code: string; degree: string; duration_years: number;
  is_active: boolean | number;
};
type ProgramsResponse = { count: number; programs: Program[] };

async function api<T>(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include", ...options,
    headers: { Accept: "application/json", ...(options.body ? {"Content-Type":"application/json"} : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String(data?.detail || data?.message || `Request failed (${response.status})`));
  return data as T;
}

const emptyForm = { name:"", code:"", degree:"B.Tech", duration_years:4, is_active:true };

export default function AdminProgramManagement() {
  const navigate = useNavigate();
  const [programs,setPrograms] = useState<Program[]>([]);
  const [form,setForm] = useState(emptyForm);
  const [editing,setEditing] = useState<Program|null>(null);
  const [open,setOpen] = useState(false);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data=await api<ProgramsResponse>("/programs/"); setPrograms(data.programs||[]); }
    catch(e){setError(e instanceof Error?e.message:"Unable to load programs.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const edit=(p:Program)=>{
    setEditing(p); setForm({name:p.name,code:p.code,degree:p.degree,duration_years:p.duration_years,is_active:Boolean(p.is_active)});
    setError("");setNotice("");setOpen(true);
  };
  const create=()=>{setEditing(null);setForm(emptyForm);setError("");setNotice("");setOpen(true);};

  const save=async()=>{
    if(!form.name.trim()||!form.code.trim()||!form.degree.trim()){setError("Name, code and degree are required.");return;}
    setBusy(true);setError("");setNotice("");
    try{
      if(editing) await api(`/programs/${editing.id}`,{method:"PUT",body:JSON.stringify(form)});
      else {
        const r=await api<any>("/profile/admin"); const p=r?.profile||r;
        if(!p?.institution_id) throw new Error("Your Admin Profile does not have institution information.");
        await api("/programs/",{method:"POST",body:JSON.stringify({institution_id:Number(p.institution_id),...form})});
      }
      setNotice(editing?"Program updated successfully.":"Program created successfully.");
      setOpen(false); await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save program.");}
    finally{setBusy(false);}
  };

  const remove=async(p:Program)=>{
    if(!window.confirm(`Delete "${p.name}"?`))return;
    setBusy(true);setError("");setNotice("");
    try{await api(`/programs/${p.id}`,{method:"DELETE"});setNotice("Program deleted successfully.");await load();}
    catch(e){setError(e instanceof Error?e.message:"Unable to delete program.");}
    finally{setBusy(false);}
  };

  return (
    <>
    <style>{`/* EDUSPHERE_RESPONSIVE */
      .edu-table {
        width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
      }
      .edu-table th,
      .edu-table td {
        padding: 15px 14px !important;
        text-align: left !important;
        vertical-align: middle !important;
        border-bottom: 1px solid rgba(148,163,184,.10) !important;
        box-sizing: border-box !important;
      }
      .edu-table th {
        color: #e5eefc;
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
      }
      .edu-table td {
        color: #cbd5e1;
        font-size: 13px;
        overflow: hidden;
      }
      .edu-program-cell strong {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .edu-program-cell small {
        display: block;
        margin-top: 4px;
        color: #94a3b8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .edu-table td:nth-child(2),
      .edu-table td:nth-child(3),
      .edu-table td:nth-child(4),
      .edu-table td:nth-child(5) {
        white-space: nowrap;
      }
      .edu-table td:last-child,
      .edu-table th:last-child {
        text-align: center !important;
      }
      .edu-row-actions {
        justify-content: center;
        align-items: center;
      }

      @media (max-width: 900px) {
        .edu-page { padding: 24px 22px 60px !important; }
        .edu-header { align-items: flex-start !important; flex-direction: column !important; }
        .edu-actions { width: 100%; }
        .edu-actions button { flex: 1; justify-content: center; }
        .edu-selector { flex-direction: column !important; align-items: stretch !important; }
        .edu-selector select { width: 100% !important; min-width: 0 !important; }
      }
      @media (max-width: 640px) {
        .edu-grid { grid-template-columns: 1fr !important; }
        .edu-page { padding: 18px 14px 50px !important; overflow-x: hidden !important; }
        .edu-title { font-size: 30px !important; }
        .edu-panel-head { padding: 16px !important; }
        .edu-modal { padding: 18px !important; max-height: calc(100dvh - 28px) !important; overflow-y: auto !important; }
        .edu-table { min-width: 760px !important; table-layout: fixed !important; }
        .edu-card { flex-wrap: wrap !important; }
        .edu-card-body { min-width: calc(100% - 58px) !important; }
        .edu-card .edu-status { margin-left: 56px; }
        .edu-card .edu-row-actions { margin-left: auto; }
      }
      @media (max-width: 420px) {
        .edu-actions { flex-direction: column; width: 100%; }
        .edu-actions button { width: 100%; }
        .edu-primary { width: 100%; justify-content: center; }
        .edu-secondary { width: 100%; justify-content: center; }
        .edu-panel-title { font-size: 19px !important; }
        .edu-modal-actions { flex-direction: column-reverse !important; }
        .edu-modal-actions button { width: 100%; justify-content: center; }
      }
    `}</style>
 <div className="edu-page" style={s.page}>
    <header className="edu-header" style={s.header}><div><span style={s.eyebrow}>EDUSPHERE • ADMIN</span><h1 className="edu-title" style={s.title}>Program Management</h1><p style={s.sub}>Manage academic programs for your institution.</p></div>
      <div className="edu-actions" style={s.actions}><button style={s.secondary} onClick={load}><RefreshCw size={16}/> Refresh</button><button style={s.primary} onClick={create}><Plus size={17}/> Add Program</button></div>
    </header>
    {error&&<div style={s.error}>{error}</div>}{notice&&<div style={s.notice}>{notice}</div>}
    <section style={s.panel}><div className="edu-panel-head" style={s.panelHead}><div><span style={s.eyebrow}>ACADEMIC STRUCTURE</span><h2 className="edu-panel-title" style={s.panelTitle}>Programs</h2></div><span style={s.count}>{programs.length} total</span></div>
      {loading?<div style={s.empty}>Loading programs…</div>:programs.length===0?<div style={s.empty}><BookOpen size={30}/><strong>No programs found</strong><span>Create your first academic program.</span></div>:
      <div style={{overflowX:"auto"}}><table className="edu-table" style={s.table}>
        <colgroup>
          <col style={{width:"42%"}} />
          <col style={{width:"12%"}} />
          <col style={{width:"12%"}} />
          <col style={{width:"12%"}} />
          <col style={{width:"12%"}} />
          <col style={{width:"10%"}} />
        </colgroup><thead><tr><th className="edu-th">Program</th><th className="edu-th">Code</th><th className="edu-th">Degree</th><th className="edu-th">Duration</th><th className="edu-th">Status</th><th/></tr></thead><tbody>
      {programs.map(p=><tr key={p.id}><td className="edu-program-cell"><strong>{p.name}</strong><small>{p.institution_name||"Your institution"}</small></td><td><b>{p.code}</b></td><td>{p.degree}</td><td>{p.duration_years} years</td><td><span style={{...s.status,...(Boolean(p.is_active)?s.active:s.inactive)}}>{Boolean(p.is_active)?"Active":"Inactive"}</span></td><td><div className="edu-row-actions" style={s.row}><button style={s.icon} onClick={()=>edit(p)}><Edit3 size={15}/></button><button style={{...s.icon,color:"#fca5a5"}} onClick={()=>remove(p)} disabled={busy}><Trash2 size={15}/></button></div></td></tr>)}
      </tbody></table></div>}
    </section>
    <button style={s.back} onClick={()=>navigate("/app/admin")}>← Back to Dashboard</button>
    {open&&<div style={s.overlay}><div className="edu-modal" style={s.modal}><div style={s.modalHead}><div><span style={s.eyebrow}>{editing?"EDIT":"CREATE"}</span><h2 className="edu-panel-title" style={s.panelTitle}>{editing?"Edit Program":"Add Program"}</h2></div><button style={s.close} onClick={()=>setOpen(false)}><X size={18}/></button></div>
      <div className="edu-grid" style={s.grid}>{(["name","code","degree"] as const).map(k=><label key={k} style={s.field}>{k==="name"?"Program Name":k==="code"?"Program Code":"Degree"}<input style={s.input} value={form[k]} onChange={e=>setForm({...form,[k]:k==="code"?e.target.value.toUpperCase():e.target.value})}/></label>)}
      <label style={s.field}>Duration (years)<input style={s.input} type="number" min="1" max="10" value={form.duration_years} onChange={e=>setForm({...form,duration_years:Number(e.target.value)})}/></label>
      <label style={s.check}><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Program is active</label></div>
      <div className="edu-modal-actions" style={s.modalActions}><button style={s.secondary} onClick={()=>setOpen(false)}>Cancel</button><button style={s.primary} onClick={save} disabled={busy}>{busy?"Saving…":editing?"Save Changes":"Create Program"}</button></div>
    </div></div>}
  </div>
    </>
  );
}

const s:Record<string,CSSProperties>={
page:{minHeight:"100vh",padding:"34px 40px 70px",background:"#050b15",color:"#e5eefc",fontFamily:"Inter,system-ui,sans-serif"},
header:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:20,marginBottom:25},eyebrow:{fontSize:10,letterSpacing:"1.8px",color:"#60a5fa",fontWeight:800},title:{margin:"7px 0 5px",fontSize:"clamp(28px,4vw,42px)"},sub:{margin:0,color:"#94a3b8",fontSize:14},actions:{display:"flex",gap:10},primary:{border:"1px solid rgba(96,165,250,.35)",background:"linear-gradient(135deg,#2563eb,#7c3aed)",color:"#fff",borderRadius:11,padding:"11px 15px",fontWeight:700,display:"inline-flex",alignItems:"center",gap:7,cursor:"pointer"},secondary:{border:"1px solid rgba(148,163,184,.18)",background:"rgba(255,255,255,.045)",color:"#cbd5e1",borderRadius:11,padding:"10px 14px",fontWeight:650,display:"inline-flex",alignItems:"center",gap:7,cursor:"pointer"},panel:{background:"rgba(9,17,31,.76)",border:"1px solid rgba(148,163,184,.13)",borderRadius:18,overflow:"hidden"},panelHead:{padding:"21px 22px",display:"flex",justifyContent:"space-between",borderBottom:"1px solid rgba(148,163,184,.1)"},panelTitle:{margin:"5px 0 0",fontSize:22},count:{color:"#94a3b8",fontSize:12},table:{width:"100%",borderCollapse:"collapse",minWidth:700},empty:{minHeight:280,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:9,color:"#64748b"},status:{padding:"5px 9px",borderRadius:999,fontSize:11,fontWeight:750},active:{color:"#86efac",background:"rgba(34,197,94,.1)"},inactive:{color:"#fbbf24",background:"rgba(245,158,11,.1)"},row:{display:"flex",gap:7},icon:{width:34,height:34,borderRadius:9,border:"1px solid rgba(148,163,184,.15)",background:"rgba(255,255,255,.04)",color:"#93c5fd",display:"grid",placeItems:"center",cursor:"pointer"},back:{marginTop:18,background:"transparent",border:0,color:"#94a3b8",cursor:"pointer"},error:{marginBottom:12,padding:11,borderRadius:10,background:"rgba(239,68,68,.09)",color:"#fca5a5"},notice:{marginBottom:12,padding:11,borderRadius:10,background:"rgba(34,197,94,.08)",color:"#86efac"},overlay:{position:"fixed",inset:0,background:"rgba(2,6,23,.72)",backdropFilter:"blur(8px)",display:"grid",placeItems:"center",padding:20,zIndex:50},modal:{width:"min(620px,100%)",background:"#0b1424",border:"1px solid rgba(148,163,184,.17)",borderRadius:18,padding:22},modalHead:{display:"flex",justifyContent:"space-between",marginBottom:22},close:{width:35,height:35,borderRadius:9,border:"1px solid rgba(148,163,184,.14)",background:"rgba(255,255,255,.04)",color:"#94a3b8"},grid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:15},field:{display:"grid",gap:7,color:"#94a3b8",fontSize:12},input:{padding:"10px 12px",borderRadius:10,border:"1px solid rgba(148,163,184,.2)",background:"#07101d",color:"#e2e8f0"},check:{display:"flex",alignItems:"center",gap:8,color:"#cbd5e1",fontSize:13},modalActions:{display:"flex",justifyContent:"flex-end",gap:9,marginTop:23}
};
