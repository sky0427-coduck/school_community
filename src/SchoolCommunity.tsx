import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    authAPI, postsAPI, chatAPI, storageAPI, ipLogsAPI,
    setAccessToken, joinRoom, leaveRoom, onReceiveMessage,
    type Post, type ChatMessage, type Profile,
} from "./api";
import {
    simpleHash, isValidEmail, isValidStudentId, isValidPassword,
    formatDate, formatTime, formatCount, formatFileSize,
    isVideoFile, tokenStorage, containsBannedWord,
} from "./utils";

type TabId = "home"|"auth"|"bamboo"|"study"|"sponsor"|"chat"|"openchat"|"freetime"|"community";
interface AuthState     { userId: string|null; email: string|null; profile: Profile|null; token: string|null; }
interface AuthFormState { email: string; password: string; studentId: string; name: string; grade: string; classNum: string; }
interface OpenChatRoom  { id: string; name: string; emoji: string; desc: string; members: number; active: boolean; }
interface Poll          { id: string; question: string; options: Array<{ label: string; count: number }>; }

const C = {
    bg:"#080c14", surface:"#0f1623", card:"#141d2e", border:"#1e2d45",
    accent:"#38bdf8", purple:"#a78bfa", green:"#34d399", yellow:"#fbbf24",
    red:"#f87171", text:"#e2e8f0", muted:"#64748b", dim:"#94a3b8",
};

const css = {
    app:      { minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Pretendard Variable','Pretendard','Noto Sans KR',sans-serif" } as React.CSSProperties,
    nav:      { background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", overflowX:"auto" as const, position:"sticky" as const, top:0, zIndex:100, padding:"0 12px", gap:2 } as React.CSSProperties,
    logo:     { padding:"14px 10px", fontWeight:800, fontSize:17, color:C.accent, whiteSpace:"nowrap" as const, flexShrink:0, marginRight:6 } as React.CSSProperties,
    tab:      (a:boolean):React.CSSProperties => ({ padding:"14px 11px", fontSize:13, fontWeight:a?700:400, color:a?C.accent:C.muted, borderBottom:`2px solid ${a?C.accent:"transparent"}`, background:"none", border:"none", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" }),
    page:     { maxWidth:880, margin:"0 auto", padding:"2rem 1rem" } as React.CSSProperties,
    card:     { background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"1.25rem" } as React.CSSProperties,
    input:    { background:"#0a1220", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14, width:"100%", outline:"none", fontFamily:"inherit", boxSizing:"border-box" as const } as React.CSSProperties,
    label:    { fontSize:12, color:C.dim, marginBottom:5, display:"block", fontWeight:500 } as React.CSSProperties,
    btn:      (color=C.accent):React.CSSProperties => ({ background:color, color:"#000", border:"none", borderRadius:9, padding:"9px 18px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }),
    btnGhost: (color=C.accent):React.CSSProperties => ({ background:"transparent", color, border:`1px solid ${color}55`, borderRadius:9, padding:"8px 14px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }),
    badge:    (color:string):React.CSSProperties => ({ background:color+"20", color, border:`1px solid ${color}40`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, display:"inline-block", whiteSpace:"nowrap" as const }),
    postCard: (accent=C.accent):React.CSSProperties => ({ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${accent}`, borderRadius:10, padding:"1rem 1.2rem", marginBottom:10 }),
    errorBox: { background:"#2a0a0a", border:`1px solid ${C.red}40`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.red, marginTop:10 } as React.CSSProperties,
};

function Spinner() {
    return (
        <div style={{ display:"flex", justifyContent:"center", padding:"3rem" }}>
            <div style={{ width:28, height:28, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
    return <div style={{ marginBottom:14 }}><label style={css.label}>{label}</label>{children}</div>;
}

function Toast({ msg, onClose }: { msg:string; onClose:()=>void }) {
    useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
    return (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:C.green, color:"#000", borderRadius:10, padding:"10px 20px", fontWeight:700, fontSize:14, zIndex:999 }}>
            {msg}
        </div>
    );
}

const TABS: { id:TabId; label:string }[] = [
    { id:"home",      label:"Home"      },
    { id:"auth",      label:"Login"     },
    { id:"bamboo",    label:"Bamboo"    },
    { id:"study",     label:"Study"     },
    { id:"sponsor",   label:"Sponsor"   },
    { id:"chat",      label:"Chat"      },
    { id:"openchat",  label:"OpenChat"  },
    { id:"freetime",  label:"FreeTime"  },
    { id:"community", label:"Community" },
];

function HomePage({ auth, setTab }: { auth:AuthState; setTab:(t:TabId)=>void }) {
    return (
        <div style={css.page}>
            <h1 style={{ fontSize:30, fontWeight:800, margin:"10px 0 8px" }}>
                {auth.profile ? `Welcome, Grade ${auth.profile.grade} Class ${auth.profile.class}!` : "Welcome to School Community"}
            </h1>
            <p style={{ color:C.dim, fontSize:14, marginBottom:16 }}>
                Anonymous board, study sharing, real-time chat and more.<br/>
                <span style={{ color:C.red, fontSize:12 }}>All activity is IP-logged for school safety.</span>
            </p>
            {!auth.userId && <button style={css.btn()} onClick={() => setTab("auth")}>Get Started</button>}
            <div style={{ ...css.card, marginTop:"1.5rem" }}>
                <h2 style={{ fontSize:16, fontWeight:700, marginBottom:12 }}>Quick Navigation</h2>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10 }}>
                    {TABS.filter(t => t.id !== "home" && t.id !== "auth").map(t => (
                        <button key={t.id} style={{ ...css.btnGhost(), textAlign:"left" }} onClick={() => setTab(t.id)}>{t.label}</button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function AdminIPLog() {
    const [date, setDate]       = useState(new Date().toISOString().slice(0,10));
    const [entries, setEntries] = useState<unknown[]>([]);
    const [loading, setLoading] = useState(false);
    const load = async () => {
        setLoading(true);
        try { const d = await ipLogsAPI.byDate(date); setEntries(d.entries); }
        catch { setEntries([]); }
        finally { setLoading(false); }
    };
    return (
        <div>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <input style={{ ...css.input, flex:1 }} type="date" value={date} onChange={e => setDate(e.target.value)} />
                <button style={css.btn(C.red)} onClick={load} disabled={loading}>Search</button>
            </div>
            {loading ? <Spinner /> : entries.length === 0
                ? <p style={{ color:C.muted, fontSize:12 }}>No data</p>
                : <div style={{ maxHeight:200, overflowY:"auto", fontSize:11, fontFamily:"monospace" }}>
                    {entries.map((e,i) => <div key={i} style={{ padding:"4px 0", borderBottom:`1px solid ${C.border}`, color:C.dim }}>{JSON.stringify(e)}</div>)}
                </div>
            }
        </div>
    );
}

function AuthPage({ auth, onLogin, onLogout }: {
    auth:AuthState;
    onLogin:(d:{token:string;userId:string;email:string})=>void;
    onLogout:()=>void;
}) {
    const [mode, setMode]       = useState<"login"|"register">("login");
    const [form, setForm]       = useState<AuthFormState>({ email:"", password:"", studentId:"", name:"", grade:"1", classNum:"1" });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string|null>(null);
    const [success, setSuccess] = useState(false);

    const upd = (f:keyof AuthFormState) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
        setForm(p => ({ ...p, [f]:e.target.value }));

    const validate = ():string|null => {
        if (!isValidEmail(form.email))       return "Invalid email.";
        if (!isValidPassword(form.password)) return "Password must be 8+ chars.";
        if (mode === "register") {
            if (!isValidStudentId(form.studentId)) return "Student ID must be 8 digits.";
            if (!form.name.trim())                 return "Name is required.";
        }
        return null;
    };

    const handleSubmit = async () => {
        const err = validate();
        if (err) { setError(err); return; }
        setError(null);
        setLoading(true);
        try {
            if (mode === "register") {
                await authAPI.register({
                    email:form.email, password:form.password,
                    studentId:form.studentId, nameHash:simpleHash(form.name+form.studentId),
                    grade:parseInt(form.grade), class:parseInt(form.classNum),
                });
                setSuccess(true);
            } else {
                const data = await authAPI.login(form.email, form.password);
                tokenStorage.setAccess(data.accessToken);
                tokenStorage.setRefresh(data.refreshToken);
                onLogin({ token:data.accessToken, userId:data.user.id, email:data.user.email });
            }
        } catch(e) { setError((e as Error).message); }
        finally { setLoading(false); }
    };

    const handleLogout = async () => {
        try { await authAPI.logout(); } catch { /**/ }
        tokenStorage.clear();
        setAccessToken(null);
        onLogout();
    };

    if (auth.userId) return (
        <div style={css.page}>
            <div style={{ ...css.card, maxWidth:440, margin:"0 auto", textAlign:"center" }}>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Logged In</h2>
                <p style={{ color:C.dim, fontSize:13, marginBottom:6 }}>{auth.email}</p>
                {auth.profile && (
                    <p style={{ color:C.dim, fontSize:13, marginBottom:8 }}>
                        Grade {auth.profile.grade} Class {auth.profile.class}
                        {auth.profile.is_admin && <span style={{ ...css.badge(C.red), marginLeft:8 }}>Admin</span>}
                    </p>
                )}
                <span style={{ ...css.badge(C.green), display:"inline-block", marginBottom:20 }}>Session Active</span>
                {auth.profile?.is_admin && (
                    <div style={{ ...css.card, background:"#0a1220", textAlign:"left", marginBottom:16 }}>
                        <h3 style={{ fontSize:14, fontWeight:700, color:C.red, marginBottom:10 }}>Admin - IP Log</h3>
                        <AdminIPLog />
                    </div>
                )}
                <button style={{ ...css.btn(C.red), width:"100%" }} onClick={handleLogout}>Logout</button>
            </div>
        </div>
    );

    if (success) return (
        <div style={css.page}>
            <div style={{ ...css.card, maxWidth:440, margin:"0 auto", textAlign:"center" }}>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Check your email</h2>
                <p style={{ color:C.dim, fontSize:14 }}>Verification sent to {form.email}</p>
                <button style={{ ...css.btn(), marginTop:20 }} onClick={() => { setSuccess(false); setMode("login"); }}>Go to Login</button>
            </div>
        </div>
    );

    return (
        <div style={css.page}>
            <div style={{ maxWidth:460, margin:"0 auto" }}>
                <h1 style={{ fontSize:26, fontWeight:800, marginBottom:4 }}>{mode === "login" ? "Login" : "Register"}</h1>
                <p style={{ color:C.dim, fontSize:13, marginBottom:"1.5rem" }}>Real-name verified, encrypted, IP logged.</p>
                <div style={{ display:"flex", gap:8, marginBottom:"1.5rem" }}>
                    <button style={mode==="login"    ? css.btn() : css.btnGhost()} onClick={() => setMode("login")}>Login</button>
                    <button style={mode==="register" ? css.btn() : css.btnGhost()} onClick={() => setMode("register")}>Register</button>
                </div>
                <div style={css.card}>
                    <Field label="Email *"><input style={css.input} type="email" placeholder="school@example.com" value={form.email} onChange={upd("email")} /></Field>
                    <Field label="Password * (8+ chars)"><input style={css.input} type="password" placeholder="Password" value={form.password} onChange={upd("password")} /></Field>
                    {mode === "register" && (
                        <>
                            <Field label="Student ID * (8 digits)"><input style={css.input} placeholder="20240101" maxLength={8} value={form.studentId} onChange={upd("studentId")} /></Field>
                            <Field label="Name * (stored as hash)"><input style={css.input} placeholder="Full name" value={form.name} onChange={upd("name")} /></Field>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                                <Field label="Grade">
                                    <select style={css.input} value={form.grade} onChange={upd("grade")}>
                                        {["1","2","3"].map(g => <option key={g} value={g}>Grade {g}</option>)}
                                    </select>
                                </Field>
                                <Field label="Class">
                                    <select style={css.input} value={form.classNum} onChange={upd("classNum")}>
                                        {["1","2","3","4","5","6"].map(c => <option key={c} value={c}>Class {c}</option>)}
                                    </select>
                                </Field>
                            </div>
                        </>
                    )}
                    <div style={{ background:"#1a0808", border:`1px solid ${C.red}30`, borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12, color:C.dim, lineHeight:1.8 }}>
                        <strong style={{ color:C.red }}>Privacy Notice</strong><br />
                        IP, student ID, and name (hashed) are submitted to school if violations occur.
                    </div>
                    {error && <div style={css.errorBox}>{error}</div>}
                    <button style={{ ...css.btn(), width:"100%", padding:"11px", marginTop:12 }} onClick={handleSubmit} disabled={loading}>
                        {loading ? "Processing..." : mode === "login" ? "Login" : "Register & Agree"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function BambooPage({ auth }: { auth:AuthState }) {
    const [posts, setPosts]     = useState<Post[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSub]  = useState(false);
    const [error, setError]     = useState<string|null>(null);
    const [page, setPage]       = useState(1);
    const [totalPages, setTotal]= useState(1);

    const load = useCallback(async (p=1) => {
        setLoading(true);
        try {
            const r = await postsAPI.list("bamboo", p);
            setPosts(r.posts);
            setTotal(r.pagination.totalPages);
        } catch { /**/ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(page); }, [load, page]);

    const submit = async () => {
        if (!content.trim()) return;
        if (containsBannedWord(content)) { setError("Banned word detected."); return; }
        setSub(true);
        setError(null);
        try {
            await postsAPI.create({ board:"bamboo", content, isAnonymous:true });
            setContent("");
            setPage(1);
            await load(1);
        } catch(e) { setError((e as Error).message); }
        finally { setSub(false); }
    };

    const handleLike = async (p:Post) => {
        if (!auth.userId) return;
        try {
            await postsAPI.like(p.id);
            setPosts(prev => prev.map(x => x.id===p.id ? {...x, likes:x.likes+1} : x));
        } catch { /**/ }
    };

    return (
        <div style={css.page}>
            <h1 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Bamboo Forest (Anonymous)</h1>
            <p style={{ color:C.dim, fontSize:13, marginBottom:"1.5rem" }}>Post anonymously. No bullying or personal attacks.</p>
            <div style={{ ...css.card, marginBottom:"1.5rem" }}>
        <textarea style={{ ...css.input, minHeight:88, resize:"vertical", marginBottom:10 }}
                  placeholder={auth.userId ? "Share anonymously..." : "Login to post."}
                  value={content} disabled={!auth.userId||submitting}
                  onChange={e => setContent(e.target.value)} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, color:C.muted }}>Anonymous - IP logged</span>
                    <button style={css.btn(C.green)} onClick={submit} disabled={!auth.userId||submitting}>
                        {submitting ? "Posting..." : "Post"}
                    </button>
                </div>
                {error && <div style={css.errorBox}>{error}</div>}
            </div>
            {loading ? <Spinner /> : posts.map(p => (
                <div key={p.id} style={css.postCard(C.green)}>
                    <p style={{ fontSize:15, lineHeight:1.75, margin:"0 0 10px" }}>{p.content}</p>
                    <div style={{ display:"flex", gap:14, fontSize:13, color:C.muted, alignItems:"center" }}>
                        <button style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13, padding:0 }} onClick={() => handleLike(p)}>
                            like {formatCount(p.likes)}
                        </button>
                        <span>view {formatCount(p.views)}</span>
                        <span style={{ marginLeft:"auto" }}>{formatDate(p.created_at)}</span>
                    </div>
                </div>
            ))}
            {totalPages > 1 && (
                <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:20 }}>
                    <button style={css.btnGhost(C.dim)} disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</button>
                    <span style={{ padding:"8px 14px", color:C.dim, fontSize:13 }}>{page}/{totalPages}</span>
                    <button style={css.btnGhost(C.dim)} disabled={page===totalPages} onClick={() => setPage(p => p+1)}>Next</button>
                </div>
            )}
        </div>
    );
}

function StudyPage({ auth }: { auth:AuthState }) {
    const SUBJECTS = ["All","Math","English","Korean","Science","Social","Other"];
    const COLORS: Record<string,string> = { Math:C.purple, English:C.accent, Korean:C.yellow, Science:C.green, Social:"#fb923c" };
    const [posts, setPosts]     = useState<Post[]>([]);
    const [filter, setFilter]   = useState("All");
    const [loading, setLoading] = useState(true);
    const [submitting, setSub]  = useState(false);
    const [form, setForm]       = useState({ title:"", content:"", subject:"Math" });
    const [page, setPage]       = useState(1);
    const [totalPages, setTotal]= useState(1);

    const load = useCallback(async (p=1) => {
        setLoading(true);
        try {
            const r = await postsAPI.list("study", p);
            setPosts(r.posts);
            setTotal(r.pagination.totalPages);
        } catch { /**/ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(page); }, [load, page]);

    const submit = async () => {
        if (!form.title.trim()||!form.content.trim()) return;
        setSub(true);
        try {
            await postsAPI.create({ board:"study", content:form.content, title:form.title, subject:form.subject });
            setForm({ title:"", content:"", subject:"Math" });
            setPage(1);
            await load(1);
        } catch { /**/ }
        finally { setSub(false); }
    };

    const filtered = filter === "All" ? posts : posts.filter(p => p.subject === filter);

    return (
        <div style={css.page}>
            <h1 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Study Share</h1>
            <div style={{ display:"flex", gap:6, marginBottom:"1.5rem", flexWrap:"wrap" }}>
                {SUBJECTS.map(s => <button key={s} style={filter===s ? css.btn() : css.btnGhost(C.dim)} onClick={() => setFilter(s)}>{s}</button>)}
            </div>
            {auth.userId && (
                <div style={{ ...css.card, marginBottom:"1.5rem", borderColor:C.green+"40" }}>
                    <h2 style={{ fontSize:15, fontWeight:700, marginBottom:12, color:C.green }}>Upload Material</h2>
                    <Field label="Title"><input style={css.input} placeholder="Title" value={form.title} onChange={e => setForm(p => ({...p, title:e.target.value}))} /></Field>
                    <Field label="Subject">
                        <select style={css.input} value={form.subject} onChange={e => setForm(p => ({...p, subject:e.target.value}))}>
                            {SUBJECTS.slice(1).map(s => <option key={s}>{s}</option>)}
                        </select>
                    </Field>
                    <Field label="Content">
                        <textarea style={{ ...css.input, minHeight:70, resize:"vertical" }} placeholder="Content or link" value={form.content} onChange={e => setForm(p => ({...p, content:e.target.value}))} />
                    </Field>
                    <button style={css.btn(C.green)} onClick={submit} disabled={submitting}>{submitting ? "Uploading..." : "Post"}</button>
                </div>
            )}
            {loading ? <Spinner /> : filtered.map(p => (
                <div key={p.id} style={css.postCard(COLORS[p.subject??""]??C.muted)}>
                    {p.subject && <span style={{ ...css.badge(COLORS[p.subject]??C.muted), marginBottom:8, display:"inline-block" }}>{p.subject}</span>}
                    <h3 style={{ fontSize:16, fontWeight:700, margin:"0 0 6px" }}>{p.title}</h3>
                    <p style={{ fontSize:13, color:C.dim, margin:"0 0 10px", lineHeight:1.6 }}>{p.content}</p>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted }}>
                        <span>like {formatCount(p.likes)} / view {formatCount(p.views)}</span>
                        <span>{formatDate(p.created_at)}</span>
                    </div>
                </div>
            ))}
            {totalPages > 1 && (
                <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:20 }}>
                    <button style={css.btnGhost(C.dim)} disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</button>
                    <span style={{ padding:"8px 14px", color:C.dim, fontSize:13 }}>{page}/{totalPages}</span>
                    <button style={css.btnGhost(C.dim)} disabled={page===totalPages} onClick={() => setPage(p => p+1)}>Next</button>
                </div>
            )}
        </div>
    );
}

function SponsorPage() {
    const tiers = [
        { name:"Seedling", amount:"1,000 KRW",   color:C.green,  perks:["Sponsor badge","Special emoji"] },
        { name:"Youth",    amount:"5,000 KRW",   color:C.accent, perks:["Seedling +","Nickname color","Monthly notice"], popular:true },
        { name:"Elder",    amount:"10,000+ KRW", color:C.purple, perks:["Youth +","Admin chat","Name listing"] },
    ];
    return (
        <div style={css.page}>
            <h1 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>School Sponsor</h1>
            <p style={{ color:C.dim, fontSize:13, marginBottom:"1.5rem" }}>Funds go to server costs and school events.</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16, marginBottom:"2rem" }}>
                {tiers.map(t => (
                    <div key={t.name} style={{ ...css.card, border:`1px solid ${t.color}40`, position:"relative" }}>
                        {t.popular && <div style={{ ...css.badge(C.accent), position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", whiteSpace:"nowrap" }}>Popular</div>}
                        <div style={{ fontWeight:700, marginBottom:4 }}>{t.name}</div>
                        <div style={{ fontSize:24, fontWeight:800, color:t.color, marginBottom:14 }}>{t.amount}</div>
                        <ul style={{ paddingLeft:16, color:C.dim, fontSize:13, lineHeight:2.1, marginBottom:16 }}>{t.perks.map(p => <li key={p}>{p}</li>)}</ul>
                        <button style={{ ...css.btn(t.color), width:"100%" }}>Sponsor</button>
                    </div>
                ))}
            </div>
            <div style={{ ...css.card, textAlign:"center" }}>
                <h2 style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>This Month Goal</h2>
                <div style={{ fontSize:30, fontWeight:800, color:C.yellow, marginBottom:6 }}>76%</div>
                <div style={{ background:C.border, borderRadius:4, height:10, maxWidth:400, margin:"0 auto 10px" }}>
                    <div style={{ background:C.yellow, width:"76%", height:"100%", borderRadius:4 }} />
                </div>
                <p style={{ fontSize:13, color:C.dim }}>Goal: 200,000 KRW / Current: 152,000 KRW / 47 sponsors</p>
            </div>
        </div>
    );
}

function ChatPage({ auth }: { auth:AuthState }) {
    const ROOMS = ["All","Grade2","Class1","Study"];
    const [msgs, setMsgs]       = useState<ChatMessage[]>([]);
    const [input, setInput]     = useState("");
    const [room, setRoom]       = useState("All");
    const [loading, setLoading] = useState(true);
    const endRef                = useRef<HTMLDivElement>(null);
    const myName = auth.profile ? `Grade${auth.profile.grade} Class${auth.profile.class}` : "Anonymous";

    useEffect(() => {
        let cancelled = false;
        Promise.resolve().then(() => {
            if (!cancelled) { setLoading(true); setMsgs([]); }
            joinRoom(room);
            return chatAPI.messages(room);
        })
            .then(data => { if (!cancelled) setMsgs(data); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        const off = onReceiveMessage(msg => {
            setMsgs(prev => prev.some(m => m.id===msg.id) ? prev : [...prev, msg]);
        });
        return () => {
            cancelled = true;
            off();
            leaveRoom(room);
        };
    }, [room]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

    const send = () => {
        const text = input.trim();
        if (!text || !auth.userId) return;
        setInput("");
        setMsgs(prev => [...prev, { id:Date.now(), room, author_id:auth.userId!, author_name:myName, content:text, created_at:new Date().toISOString() }]);
        chatAPI.send(room, text, myName, auth.userId);
    };

    return (
        <div style={{ ...css.page, display:"flex", flexDirection:"column", height:"calc(100vh - 58px)", paddingBottom:0 }}>
            <h1 style={{ fontSize:24, fontWeight:800, marginBottom:10, flexShrink:0 }}>Real-time Chat</h1>
            <div style={{ display:"flex", gap:6, marginBottom:12, flexShrink:0, flexWrap:"wrap" }}>
                {ROOMS.map(r => <button key={r} style={room===r ? css.btn() : css.btnGhost(C.dim)} onClick={() => setRoom(r)}>{r}</button>)}
            </div>
            <div style={{ flex:1, overflowY:"auto", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
                {loading ? <Spinner /> : msgs.map(m => {
                    const isMe = m.author_id === auth.userId;
                    return (
                        <div key={m.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", marginBottom:12 }}>
                            <div style={{ maxWidth:"70%" }}>
                                {!isMe && <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{m.author_name}</div>}
                                <div style={{ background:isMe?C.accent:"#1a2740", color:isMe?"#000":C.text, borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px", padding:"8px 14px", fontSize:14 }}>{m.content}</div>
                                <div style={{ fontSize:11, color:C.muted, marginTop:3, textAlign:isMe?"right":"left" }}>{formatTime(m.created_at)}</div>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>
            <div style={{ display:"flex", gap:8, flexShrink:0, paddingBottom:"1rem" }}>
                <input style={{ ...css.input, flex:1 }}
                       placeholder={auth.userId ? "Type message... (Enter)" : "Login to chat"}
                       disabled={!auth.userId} value={input}
                       onChange={e => setInput(e.target.value)}
                       onKeyDown={e => { if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); send(); } }} />
                <button style={css.btn()} onClick={send} disabled={!auth.userId}>Send</button>
            </div>
        </div>
    );
}

function OpenChatPage() {
    const rooms: OpenChatRoom[] = [
        { id:"math",   name:"Math Study",   emoji:"book",  desc:"Midterm prep together",    members:23, active:true  },
        { id:"game",   name:"Game Talk",    emoji:"game",  desc:"Gaming after school",      members:45, active:true  },
        { id:"music",  name:"Music Share",  emoji:"music", desc:"Share what you listen to", members:12, active:false },
        { id:"lunch",  name:"Lunch Review", emoji:"food",  desc:"Rate today's lunch",       members:67, active:true  },
        { id:"exam",   name:"Exam Info",    emoji:"memo",  desc:"Exam range and tips",      members:89, active:true  },
        { id:"travel", name:"Travel Plan",  emoji:"globe", desc:"Vacation plans",           members:8,  active:false },
    ];
    const [search, setSearch] = useState("");
    const filtered = rooms.filter(r => r.name.includes(search)||r.desc.includes(search));
    return (
        <div style={css.page}>
            <h1 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Open Chat</h1>
            <div style={{ marginBottom:"1.2rem" }}><input style={css.input} placeholder="Search rooms..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
                {filtered.map(r => (
                    <div key={r.id} style={css.card}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                            <span style={{ fontWeight:700 }}>{r.name}</span>
                            <span style={css.badge(r.active ? C.green : C.muted)}>{r.active ? "Active" : "Quiet"}</span>
                        </div>
                        <p style={{ fontSize:13, color:C.dim, margin:"0 0 12px" }}>{r.desc}</p>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <span style={{ fontSize:12, color:C.muted }}>{r.members} members</span>
                            <button style={css.btn()}>Join</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FreeTimePage() {
    const [subTab, setSubTab] = useState<"polls"|"games">("polls");
    const [votes, setVotes]   = useState<Record<string,number|null>>({});
    const [dice, setDice]     = useState<string|null>(null);
    const [rps, setRps]       = useState<string|null>(null);
    const polls: Poll[] = [
        { id:"lunch",  question:"How was lunch today?", options:[{label:"Delicious",count:134},{label:"Just okay",count:67},{label:"Not good",count:42}] },
        { id:"season", question:"Favorite season?",     options:[{label:"Spring",count:89},{label:"Summer",count:120},{label:"Fall",count:95},{label:"Winter",count:60}] },
    ];
    return (
        <div style={css.page}>
            <h1 style={{ fontSize:24, fontWeight:800, marginBottom:"1.2rem" }}>Free Time</h1>
            <div style={{ display:"flex", gap:8, marginBottom:"1.5rem" }}>
                <button style={subTab==="polls" ? css.btn() : css.btnGhost()} onClick={() => setSubTab("polls")}>Vote</button>
                <button style={subTab==="games" ? css.btn(C.purple) : css.btnGhost(C.purple)} onClick={() => setSubTab("games")}>Mini Games</button>
            </div>
            {subTab === "polls" && polls.map(poll => {
                const voted = votes[poll.id];
                const total = poll.options.reduce((a,o) => a+o.count, 0);
                return (
                    <div key={poll.id} style={{ ...css.card, marginBottom:16 }}>
                        <h2 style={{ fontSize:16, fontWeight:700, marginBottom:12 }}>{poll.question}</h2>
                        {poll.options.map((opt,i) => {
                            const pct = Math.round((opt.count/total)*100);
                            return (
                                <div key={opt.label} style={{ marginBottom:8, cursor:"pointer" }}
                                     onClick={() => { if (votes[poll.id]==null) setVotes(p => ({...p, [poll.id]:i})); }}>
                                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                                        <span>{opt.label}</span>
                                        {voted!=null && <span style={{ color:C.dim }}>{pct}%</span>}
                                    </div>
                                    <div style={{ background:C.border, borderRadius:4, height:28, position:"relative", overflow:"hidden" }}>
                                        {voted!=null && <div style={{ width:`${pct}%`, height:"100%", background:voted===i?C.accent:"#1a2740", transition:"width 0.4s" }} />}
                                        {voted==null && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", paddingLeft:10, fontSize:13 }}>{opt.label}</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
            {subTab === "games" && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                    <div style={{ ...css.card, textAlign:"center", padding:"2rem 1rem" }}>
                        <div style={{ fontSize:40, marginBottom:8 }}>{dice ?? "?"}</div>
                        <div style={{ fontWeight:700, marginBottom:12 }}>Roll Dice</div>
                        <button style={css.btn(C.purple)} onClick={() => setDice(["1","2","3","4","5","6"][Math.floor(Math.random()*6)])}>Roll</button>
                    </div>
                    <div style={{ ...css.card, textAlign:"center", padding:"2rem 1rem" }}>
                        <div style={{ fontSize:40, marginBottom:8 }}>RPS</div>
                        <div style={{ fontWeight:700, marginBottom:12 }}>Rock Paper Scissors</div>
                        <button style={css.btn(C.purple)} onClick={() => setRps("Computer: "+["Rock","Scissors","Paper"][Math.floor(Math.random()*3)])}>Play</button>
                        {rps && <p style={{ marginTop:10, fontSize:13, color:C.dim }}>{rps}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

function CommunityPage({ auth }: { auth:AuthState }) {
    const [subTab, setSubTab]   = useState<"blog"|"short">("blog");
    const [posts, setPosts]     = useState<Post[]>([]);
    const [shorts, setShorts]   = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSub]  = useState(false);
    const [form, setForm]       = useState({ title:"", content:"" });
    const [videoFile, setVF]    = useState<File|null>(null);
    const [videoTitle, setVT]   = useState("");
    const [progress, setProg]   = useState<string|null>(null);
    const [toast, setToast]     = useState<string|null>(null);

    const loadBlog = useCallback(async () => {
        setLoading(true);
        try { const r = await postsAPI.list("blog");  setPosts(r.posts);  }
        catch { /**/ }
        finally { setLoading(false); }
    }, []);

    const loadShorts = useCallback(async () => {
        setLoading(true);
        try { const r = await postsAPI.list("short"); setShorts(r.posts); }
        catch { /**/ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (subTab==="blog") void loadBlog();
        else void loadShorts();
    }, [subTab, loadBlog, loadShorts]);

    const submitBlog = async () => {
        if (!form.title.trim()||!form.content.trim()) return;
        setSub(true);
        try {
            await postsAPI.create({ board:"blog", content:form.content, title:form.title });
            setForm({ title:"", content:"" });
            await loadBlog();
            setToast("Post published!");
        } catch { /**/ }
        finally { setSub(false); }
    };

    const submitShort = async () => {
        if (!videoFile||!videoTitle.trim()) return;
        if (!isVideoFile(videoFile)) { setToast("Only mp4, mov, webm allowed."); return; }
        setSub(true);
        setProg(`Uploading... (${formatFileSize(videoFile.size)})`);
        try {
            await storageAPI.uploadShort(videoFile, videoTitle);
            setVF(null);
            setVT("");
            await loadShorts();
            setToast("Short uploaded!");
        } catch(e) { setToast((e as Error).message); }
        finally { setProg(null); setSub(false); }
    };

    return (
        <div style={css.page}>
            {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
            <h1 style={{ fontSize:24, fontWeight:800, marginBottom:"1rem" }}>Community</h1>
            <div style={{ display:"flex", gap:8, marginBottom:"1.5rem" }}>
                <button style={subTab==="blog"  ? css.btn()         : css.btnGhost()} onClick={() => setSubTab("blog")}>Blog</button>
                <button style={subTab==="short" ? css.btn(C.purple) : css.btnGhost(C.purple)} onClick={() => setSubTab("short")}>Short Videos</button>
            </div>
            {subTab === "blog" && (
                <>
                    {auth.userId && (
                        <div style={{ ...css.card, marginBottom:"1.5rem" }}>
                            <h2 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>Write Post</h2>
                            <Field label="Title"><input style={css.input} placeholder="Title" value={form.title} onChange={e => setForm(p => ({...p, title:e.target.value}))} /></Field>
                            <Field label="Content"><textarea style={{ ...css.input, minHeight:90, resize:"vertical" }} placeholder="Content" value={form.content} onChange={e => setForm(p => ({...p, content:e.target.value}))} /></Field>
                            <button style={css.btn()} onClick={submitBlog} disabled={submitting}>{submitting ? "Publishing..." : "Publish"}</button>
                        </div>
                    )}
                    {loading ? <Spinner /> : posts.map(p => (
                        <div key={p.id} style={css.postCard(C.purple)}>
                            <h3 style={{ fontSize:16, fontWeight:700, margin:"0 0 6px" }}>{p.title}</h3>
                            <p style={{ fontSize:13, color:C.dim, margin:"0 0 10px", lineHeight:1.6 }}>{p.content.slice(0,120)}{p.content.length>120?"...":""}</p>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted }}>
                                <span>like {formatCount(p.likes)} / view {formatCount(p.views)}</span>
                                <span>{formatDate(p.created_at)}</span>
                            </div>
                        </div>
                    ))}
                </>
            )}
            {subTab === "short" && (
                <>
                    {auth.userId && (
                        <div style={{ ...css.card, marginBottom:"1.5rem", borderColor:C.purple+"40" }}>
                            <h2 style={{ fontSize:15, fontWeight:700, marginBottom:12, color:C.purple }}>Upload Short</h2>
                            <Field label="Title"><input style={css.input} placeholder="Video title" value={videoTitle} onChange={e => setVT(e.target.value)} /></Field>
                            <Field label="Video file (mp4/mov/webm, max 100MB)">
                                <input style={{ ...css.input, cursor:"pointer" }} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e => setVF(e.target.files?.[0]??null)} />
                            </Field>
                            {videoFile && <p style={{ fontSize:12, color:C.dim, marginBottom:10 }}>{videoFile.name} ({formatFileSize(videoFile.size)})</p>}
                            {progress  && <p style={{ fontSize:12, color:C.yellow, marginBottom:10 }}>{progress}</p>}
                            <button style={css.btn(C.purple)} onClick={submitShort} disabled={submitting||!videoFile}>{submitting ? "Uploading..." : "Upload"}</button>
                        </div>
                    )}
                    {loading ? <Spinner /> : (
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12 }}>
                            {shorts.map(s => (
                                <div key={s.id} style={{ ...css.card, padding:0, overflow:"hidden", cursor:"pointer" }}>
                                    <div style={{ background:"#141d2e", height:190, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40 }}>Video</div>
                                    <div style={{ padding:"0.65rem 0.9rem" }}>
                                        <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{s.title ?? "Untitled"}</div>
                                        <div style={{ fontSize:12, color:C.muted }}>view {formatCount(s.views)} / {formatDate(s.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function App() {
    const [tab, setTab]              = useState<TabId>("home");
    const [auth, setAuth]            = useState<AuthState>({ userId:null, email:null, profile:null, token:null });
    const [authLoading, setAuthLoad] = useState(true);

    useEffect(() => {
        const token = tokenStorage.getAccess();
        if (!token) {
            Promise.resolve().then(() => setAuthLoad(false));
            return;
        }
        setAccessToken(token);
        authAPI.me()
            .then(profile => { setAuth({ userId:profile.id, email:null, profile, token }); })
            .catch(() => { tokenStorage.clear(); setAccessToken(null); })
            .finally(() => { setAuthLoad(false); });
    }, []);

    const handleLogin = useCallback(async (data: { token:string; userId:string; email:string }) => {
        setAccessToken(data.token);
        try { const profile = await authAPI.me(); setAuth({ userId:data.userId, email:data.email, profile, token:data.token }); }
        catch { setAuth({ userId:data.userId, email:data.email, profile:null, token:data.token }); }
    }, []);

    const handleLogout = useCallback(() => { setAuth({ userId:null, email:null, profile:null, token:null }); }, []);

    if (authLoading) return (
        <div style={{ ...css.app, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Spinner />
        </div>
    );

    const pages: Record<TabId, React.ReactElement> = {
        home:      <HomePage      auth={auth} setTab={setTab} />,
        auth:      <AuthPage      auth={auth} onLogin={handleLogin} onLogout={handleLogout} />,
        bamboo:    <BambooPage    auth={auth} />,
        study:     <StudyPage     auth={auth} />,
        sponsor:   <SponsorPage />,
        chat:      <ChatPage      auth={auth} />,
        openchat:  <OpenChatPage />,
        freetime:  <FreeTimePage />,
        community: <CommunityPage auth={auth} />,
    };

    return (
        <div style={css.app}>
            <nav style={css.nav}>
                <div style={css.logo}>School Community</div>
                {TABS.map(t => <button key={t.id} style={css.tab(tab===t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
                {auth.userId && (
                    <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8, flexShrink:0, paddingLeft:8 }}>
            <span style={css.badge(C.green)}>
              {auth.profile ? `G${auth.profile.grade} C${auth.profile.class}` : ""}
                {auth.profile?.is_admin ? " Admin" : ""}
            </span>
                    </div>
                )}
            </nav>
            {pages[tab]}
        </div>
    );
}