import { useCallback, useEffect, useState } from "react";
import { Edit3, Plus, RefreshCw, Trash2, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL=import.meta.env.VITE_API_BASE_URL||"http://localhost:8000";
type Program={id:number;name:string;code:string;is_active:boolean|number};
type Section={id:number;program_id:number;program_name?:string;name:string;code:string;batch_start_year:number;batch_end_year:number;is_active:boolean|number};

async function api<T>(endpoint:string,options:RequestInit={}){const r=await fetch(`${API_BASE_URL}${endpoint}`,{credentials:"include",...options,headers:{Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(String(d?.detail||d?.message||`Request failed (${r.status})`));return d as T;}

export default function AdminSectionManagement(){
 const navigate=useNavigate();const [programs,setPrograms]=useState<Program[]>([]);const [sections,setSections]=useState<Section[]>([]);
 const [selected,setSelected]=useState<number|"">("");const [editing,setEditing]=useState<Section|null>(null);const [open,setOpen]=useState(false);
 const [form,setForm]=useState({program_id:"",name:"",code:"",batch_start_year:new Date().getFullYear(),batch_end_year:new Date().getFullYear()+4,is_active:true});
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");

 const loadPrograms=useCallback(async()=>{const d=await api<{programs:Program[]}>("/programs/");setPrograms(d.programs||[]);setSelected(x=>x!==""&&d.programs.some(p=>p.id===x)?x:(d.programs[0]?.id||""));},[]);
 const loadSections=useCallback(async(id:number|"")=>{if(!id){setSections([]);return;}const d=await api<{sections:Section[]}>(`/sections/?program_id=${id}`);setSections(d.sections||[]);},[]);
 const load=useCallback(async()=>{setLoading(true);setError("");try{await loadPrograms()}catch(e){setError(e instanceof Error?e.message:"Unable to load programs.")}finally{setLoading(false)}},[loadPrograms]);
 useEffect(()=>{load()},[load]);useEffect(()=>{loadSections(selected).catch(e=>setError(e instanceof Error?e.message:"Unable to load sections."))},[selected,loadSections]);

 const create=()=>{if(!selected){setError("Create a program first.");return;}setEditing(null);setForm({program_id:String(selected),name:"",code:"",batch_start_year:new Date().getFullYear(),batch_end_year:new Date().getFullYear()+4,is_active:true});setError("");setNotice("");setOpen(true)};
 const edit=(x:Section)=>{setEditing(x);setForm({program_id:String(x.program_id),name:x.name,code:x.code,batch_start_year:x.batch_start_year,batch_end_year:x.batch_end_year,is_active:Boolean(x.is_active)});setError("");setNotice("");setOpen(true)};
 const save=async()=>{if(!form.program_id||!form.name.trim()||!form.code.trim()){setError("Program, section name and section code are required.");return}if(form.batch_start_year>form.batch_end_year){setError("Batch start year must be before or equal to batch end year.");return}setBusy(true);setError("");try{const body={program_id:Number(form.program_id),name:form.name.trim(),code:form.code.trim().toUpperCase(),batch_start_year:Number(form.batch_start_year),batch_end_year:Number(form.batch_end_year),is_active:form.is_active};if(editing)await api(`/sections/${editing.id}`,{method:"PUT",body:JSON.stringify(body)});else await api("/sections/",{method:"POST",body:JSON.stringify(body)});setNotice(editing?"Section updated successfully.":"Section created successfully.");setOpen(false);setSelected(Number(form.program_id));await loadSections(Number(form.program_id))}catch(e){setError(e instanceof Error?e.message:"Unable to save section.")}finally{setBusy(false)}};
 const remove=async(x:Section)=>{if(!window.confirm(`Delete "${x.name}"?`))return;setBusy(true);setError("");try{await api(`/sections/${x.id}`,{method:"DELETE"});setNotice("Section deleted successfully.");await loadSections(selected)}catch(e){setError(e instanceof Error?e.message:"Unable to delete section.")}finally{setBusy(false)}};
 const p=programs.find(x=>x.id===selected);

 return <>
    <style>{`/* EDUSPHERE_RESPONSIVE */
      @media (max-width: 900px) {
        .edu-page { padding: 24px 22px 60px !important; }
        .edu-header { align-items: flex-start !important; flex-direction: column !important; }
        .edu-actions { width: 100%; }
        .edu-actions button { flex: 1; justify-content: center; }
        .edu-selector { flex-direction: column !important; align-items: stretch !important; }
        .edu-selector select { width: 100% !important; min-width: 0 !important; }
      }
      @media (max-width: 640px) {
        .edu-page { padding: 18px 14px 50px !important; }
        .edu-title { font-size: 30px !important; }
        .edu-panel-head { padding: 16px !important; }
        .edu-grid { grid-template-columns: 1fr !important; }
        .edu-modal { padding: 18px !important; }
        .edu-table { min-width: 620px !important; }
        .edu-card { flex-wrap: wrap !important; }
        .edu-card-body { min-width: calc(100% - 58px) !important; }
        .edu-card .edu-status { margin-left: 56px; }
        .edu-card .edu-row-actions { margin-left: auto; }
      }
      @media (max-width: 420px) {
        .edu-actions { flex-direction: column; }
        .edu-actions button { width: 100%; }
        .edu-primary { width: 100%; justify-content: center; }
        .edu-secondary { width: 100%; justify-content: center; }
        .edu-panel-title { font-size: 19px !important; }
        .edu-modal-actions { flex-direction: column-reverse !important; }
        .edu-modal-actions button { width: 100%; justify-content: center; }
      }
    `}</style>
 return <div className="edu-page" style={s.page}><header className="edu-header" style={s.header}><div><span style={s.eyebrow}>EDUSPHERE • ADMIN</span><h1 className="edu-title" style={s.title}>Section Management</h1><p style={s.sub}>Organize sections and batches under each academic program.</p></div><div className="edu-actions" style={s.actions}><button style={s.secondary} onClick={load}><RefreshCw size={16}/> Refresh</button><button style={s.primary} onClick={create}><Plus size={17}/> Add Section</button></div></header>
 {error&&<div style={s.error}>{error}</div>}{notice&&<div style={s.notice}>{notice}</div>}
 <section style={s.selector}><div><span style={s.eyebrow}>PROGRAM</span><strong style={s.selected}>{p?.name||"No program selected"}</strong></div><select style={s.select} value={selected} onChange={e=>setSelected(e.target.value?Number(e.target.value):"")}><option value="">Select a program</option>{programs.map(x=><option key={x.id} value={x.id} disabled={!x.is_active}>{x.name} ({x.code})</option>)}</select></section>
 <section style={s.panel}><div className="edu-panel-head" style={s.panelHead}><div><span style={s.eyebrow}>ACADEMIC STRUCTURE</span><h2 className="edu-panel-title" style={s.panelTitle}>{p?`${p.name} Sections`:"Sections"}</h2></div><span style={s.count}>{sections.length} total</span></div>
 {loading?<div style={s.empty}>Loading…</div>:!selected?<div style={s.empty}><Users size={30}/><strong>Select a program</strong></div>:!sections.length?<div style={s.empty}><Users size={30}/><strong>No sections found</strong><span>Add Section to create the first section.</span></div>:<div style={s.cards}>{sections.map(x=><article className="edu-card" key={x.id} style={s.card}><div style={s.cardIcon}><Users size={20}/></div><div className="edu-card-body" style={s.body}><strong>{x.name}</strong><span>{x.code}</span><small>Batch {x.batch_start_year} – {x.batch_end_year}</small></div><span className="edu-status" style={{...s.status,...(Boolean(x.is_active)?s.active:s.inactive)}}>{Boolean(x.is_active)?"Active":"Inactive"}</span><button style={s.icon} onClick={()=>edit(x)}><Edit3 size={15}/></button><button style={{...s.icon,color:"#fca5a5"}} onClick={()=>remove(x)} disabled={busy}><Trash2 size={15}/></button></article>)}</div>}
 </section><button style={s.back} onClick={()=>navigate("/app/admin")}>← Back to Dashboard</button>
 {open&&<div style={s.overlay}><div className="edu-modal" style={s.modal}><div style={s.modalHead}><div><span style={s.eyebrow}>{editing?"EDIT":"CREATE"}</span><h2 className="edu-panel-title" style={s.panelTitle}>{editing?"Edit Section":"Add Section"}</h2></div><button style={s.close} onClick={()=>setOpen(false)}><X size={18}/></button></div>
 <div className="edu-grid" style={s.grid}><label style={s.field}>Program<select style={s.input} value={form.program_id} onChange={e=>setForm({...form,program_id:e.target.value})}>{programs.map(x=><option key={x.id} value={x.id} disabled={!x.is_active}>{x.name} ({x.code})</option>)}</select></label><label style={s.field}>Section Name<input style={s.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label style={s.field}>Section Code<input style={s.input} value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})}/></label><label style={s.field}>Batch Start Year<input style={s.input} type="number" value={form.batch_start_year} onChange={e=>setForm({...form,batch_start_year:Number(e.target.value)})}/></label><label style={s.field}>Batch End Year<input style={s.input} type="number" value={form.batch_end_year} onChange={e=>setForm({...form,batch_end_year:Number(e.target.value)})}/></label><label style={s.check}><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Section is active</label></div>
 <div className="edu-modal-actions" style={s.modalActions}><button style={s.secondary} onClick={()=>setOpen(false)}>Cancel</button><button style={s.primary} onClick={save} disabled={busy}>{busy?"Saving…":editing?"Save Changes":"Create Section"}</button></div></div></div>}</div>
}

const s:Record<string,React.CSSProperties>={page:{minHeight:"100vh",padding:"34px 40px 70px",background:"#050b15",color:"#e5eefc",fontFamily:"Inter,system-ui,sans-serif"},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:20,marginBottom:25},eyebrow:{fontSize:10,letterSpacing:"1.8px",color:"#60a5fa",fontWeight:800},title:{margin:"7px 0 5px",fontSize:"clamp(28px,4vw,42px)"},sub:{margin:0,color:"#94a3b8",fontSize:14},actions:{display:"flex",gap:10},primary:{border:"1px solid rgba(96,165,250,.35)",background:"linear-gradient(135deg,#2563eb,#7c3aed)",color:"#fff",borderRadius:11,padding:"11px 15px",fontWeight:700,display:"inline-flex",alignItems:"center",gap:7},secondary:{border:"1px solid rgba(148,163,184,.18)",background:"rgba(255,255,255,.045)",color:"#cbd5e1",borderRadius:11,padding:"10px 14px",fontWeight:650,display:"inline-flex",alignItems:"center",gap:7},selector:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,padding:18,marginBottom:16,background:"rgba(9,17,31,.76)",border:"1px solid rgba(148,163,184,.13)",borderRadius:16},selected:{display:"block",marginTop:5,fontSize:17},select:{minWidth:300,padding:"10px 12px",borderRadius:10,border:"1px solid rgba(148,163,184,.2)",background:"#0b1424",color:"#e2e8f0"},panel:{background:"rgba(9,17,31,.76)",border:"1px solid rgba(148,163,184,.13)",borderRadius:18,overflow:"hidden"},panelHead:{padding:"21px 22px",display:"flex",justifyContent:"space-between",borderBottom:"1px solid rgba(148,163,184,.1)"},panelTitle:{margin:"5px 0 0",fontSize:22},count:{color:"#94a3b8",fontSize:12},cards:{padding:15,display:"grid",gap:10},card:{display:"flex",alignItems:"center",gap:14,padding:15,borderRadius:13,border:"1px solid rgba(148,163,184,.1)",background:"rgba(255,255,255,.025)"},cardIcon:{width:42,height:42,borderRadius:11,display:"grid",placeItems:"center",background:"rgba(59,130,246,.1)",color:"#93c5fd"},body:{flex:1,display:"grid",gap:3},status:{padding:"5px 9px",borderRadius:999,fontSize:11,fontWeight:750},active:{color:"#86efac",background:"rgba(34,197,94,.1)"},inactive:{color:"#fbbf24",background:"rgba(245,158,11,.1)"},icon:{width:34,height:34,borderRadius:9,border:"1px solid rgba(148,163,184,.15)",background:"rgba(255,255,255,.04)",color:"#93c5fd",display:"grid",placeItems:"center"},empty:{minHeight:280,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:9,color:"#64748b"},error:{marginBottom:12,padding:11,borderRadius:10,background:"rgba(239,68,68,.09)",color:"#fca5a5"},notice:{marginBottom:12,padding:11,borderRadius:10,background:"rgba(34,197,94,.08)",color:"#86efac"},back:{marginTop:18,background:"transparent",border:0,color:"#94a3b8"},overlay:{position:"fixed",inset:0,background:"rgba(2,6,23,.72)",backdropFilter:"blur(8px)",display:"grid",placeItems:"center",padding:20,zIndex:50},modal:{width:"min(650px,100%)",background:"#0b1424",border:"1px solid rgba(148,163,184,.17)",borderRadius:18,padding:22},modalHead:{display:"flex",justifyContent:"space-between",marginBottom:22},close:{width:35,height:35,borderRadius:9,border:"1px solid rgba(148,163,184,.14)",background:"rgba(255,255,255,.04)",color:"#94a3b8"},grid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:15},field:{display:"grid",gap:7,color:"#94a3b8",fontSize:12},input:{padding:"10px 12px",borderRadius:10,border:"1px solid rgba(148,163,184,.2)",background:"#07101d",color:"#e2e8f0"},check:{display:"flex",alignItems:"center",gap:8,color:"#cbd5e1"},modalActions:{display:"flex",justifyContent:"flex-end",gap:9,marginTop:23}};
