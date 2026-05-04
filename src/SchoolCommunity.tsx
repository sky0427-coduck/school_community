/**
 * SchoolCommunity.tsx
 * React + TypeScript ??諛깆뿏??API + Socket.io ?ㅼ떆媛?梨꾪똿
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  authAPI, postsAPI, chatAPI, storageAPI, ipLogsAPI,
  setAccessToken,
  joinRoom, leaveRoom, onReceiveMessage,
  type Post, type ChatMessage, type Profile,
} from "./api";
import {
  simpleHash, isValidEmail, isValidStudentId, isValidPassword,
  formatDate, formatTime, formatCount, formatFileSize,
  isVideoFile, tokenStorage, containsBannedWord,
} from "./utils";

// ??? ???????????????????????????????????????????????????????????????????????

type TabId = "home"|"auth"|"bamboo"|"study"|"sponsor"|"chat"|"openchat"|"freetime"|"community";

interface AuthState      { userId: string|null; email: string|null; profile: Profile|null; token: string|null; }
interface AuthFormState  { email: string; password: string; studentId: string; name: string; grade: string; classNum: string; }
interface OpenChatRoom   { id: string; name: string; emoji: string; desc: string; members: number; active: boolean; }
interface Poll           { id: string; question: string; options: Array<{ label: string; count: number }>; }

// ??? ?붿옄???좏겙 ??????????????????????????????????????????????????????????????

const C = {
  bg: "#080c14", surface: "#0f1623", card: "#141d2e", border: "#1e2d45",
  accent: "#38bdf8", purple: "#a78bfa", green: "#34d399", yellow: "#fbbf24",
  red: "#f87171", text: "#e2e8f0", muted: "#64748b", dim: "#94a3b8",
};

const css = {
  app:      { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Pretendard Variable','Pretendard','Noto Sans KR',sans-serif" } as React.CSSProperties,
  nav:      { background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", overflowX: "auto" as const, position: "sticky" as const, top: 0, zIndex: 100, padding: "0 12px", gap: 2 } as React.CSSProperties,
  logo:     { padding: "14px 10px", fontWeight: 800, fontSize: 17, color: C.accent, whiteSpace: "nowrap" as const, flexShrink: 0, marginRight: 6 } as React.CSSProperties,
  tab:      (a: boolean): React.CSSProperties => ({ padding: "14px 11px", fontSize: 13, fontWeight: a ? 700 : 400, color: a ? C.accent : C.muted, borderBottom: `2px solid ${a ? C.accent : "transparent"}`, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", transition: "color 0.15s" }),
  page:     { maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" } as React.CSSProperties,
  card:     { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.25rem" } as React.CSSProperties,
  input:    { background: "#0a1220", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 14px", color: C.text, fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const } as React.CSSProperties,
  label:    { fontSize: 12, color: C.dim, marginBottom: 5, display: "block", fontWeight: 500 } as React.CSSProperties,
  btn:      (color: string = C.accent): React.CSSProperties => ({ background: color, color: "#000", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }),
  btnGhost: (color: string = C.accent): React.CSSProperties => ({ background: "transparent", color, border: `1px solid ${color}55`, borderRadius: 9, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }),
  badge:    (color: string): React.CSSProperties => ({ background: color + "20", color, border: `1px solid ${color}40`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, display: "inline-block", whiteSpace: "nowrap" as const }),
  postCard: (accent: string = C.accent): React.CSSProperties => ({ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: "1rem 1.2rem", marginBottom: 10 }),
  errorBox: { background: "#2a0a0a", border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red, marginTop: 10 } as React.CSSProperties,
};

// ??? 怨듯넻 而댄룷?뚰듃 ????????????????????????????????????????????????????????????

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={css.label}>{label}</label>{children}</div>;
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#000", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: "0 4px 20px #0006" }}>
      {msg}
    </div>
  );
}

// ??? ??紐⑸줉 ??????????????????????????????????????????????????????????????????

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "home",      label: "?룧 ??       },
  { id: "auth",      label: "?뵍 濡쒓렇??   },
  { id: "bamboo",    label: "?럨 ??섎Т?? },
  { id: "study",     label: "?뱴 怨듬?怨듭쑀" },
  { id: "sponsor",   label: "?뮎 ?꾩썝"     },
  { id: "chat",      label: "?뮠 梨꾪똿"     },
  { id: "openchat",  label: "?뙋 ?ㅽ뵂梨꾪똿" },
  { id: "freetime",  label: "?렜 ?먯쑀?쒓컙" },
  { id: "community", label: "?뱷 而ㅻ??덊떚" },
];

// ??? ?????????????????????????????????????????????????????????????????????????

function HomePage({ auth, setTab }: { auth: AuthState; setTab: (t: TabId) => void }) {
  const stats = [
    { label: "媛???숈깮",   value: "1,247紐?,  color: C.accent },
    { label: "?ㅻ뒛 寃뚯떆湲", value: "83媛?,     color: C.purple },
    { label: "?ㅼ떆媛??묒냽", value: "142紐?,    color: C.green  },
    { label: "?꾩쟻 ?꾩썝",   value: "??20,000", color: C.yellow },
  ];
  const notices = [
    { tag: "?덈궡",   text: "媛쒖씤?뺣낫 泥섎━諛⑹묠???낅뜲?댄듃 ?섏뿀?듬땲??",    color: C.yellow },
    { tag: "湲닿툒",   text: "?숆탳??젰 ?좉퀬: 117 ?먮뒗 ??섎Т???듬챸 ?좉퀬", color: C.red    },
    { tag: "?대깽??, text: "怨듬?怨듭쑀 100踰덉㎏ 寃뚯떆湲 ?대깽??吏꾪뻾 以?",    color: C.green  },
  ];
  return (
    <div style={css.page}>
      <div style={{ marginBottom: "2rem" }}>
        <span style={{ ...css.badge(C.accent), marginBottom: 12 }}>?곕━?숆탳 而ㅻ??덊떚</span>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0 8px", letterSpacing: "-0.5px" }}>
          {auth.profile ? `?섏쁺?댁슂, ${auth.profile.grade}?숇뀈 ${auth.profile.class}諛? ?몝` : "以묓븰援?而ㅻ??덊떚???ㅼ떊 嫄??섏쁺?⑸땲??}
        </h1>
        <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
          ?듬챸 ??섎Т?뀀???怨듬? 怨듭쑀, ?ㅼ떆媛?梨꾪똿源뚯? ???곕━ ?숆탳留뚯쓽 怨듦컙?낅땲??<br />
          <span style={{ color: C.red, fontSize: 12 }}>?좑툘 紐⑤뱺 ?쒕룞? ?숆탳 ?덉쟾???꾪빐 IP 諛?怨꾩젙 濡쒓렇媛 ?섏쭛?⑸땲??</span>
        </p>
        {!auth.userId && <button style={css.btn()} onClick={() => setTab("auth")}>吏湲??쒖옉?섍린 ??/button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: "2rem" }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...css.card, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ ...css.card, marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>?뱼 怨듭??ы빆</h2>
        {notices.map((n, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < notices.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <span style={css.badge(n.color)}>{n.tag}</span>
            <span style={{ fontSize: 14 }}>{n.text}</span>
          </div>
        ))}
      </div>
      <div style={css.card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>?뵦 鍮좊Ⅸ ?대룞</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
          {TABS.filter(t => t.id !== "home" && t.id !== "auth").map(t => (
            <button key={t.id} style={{ ...css.btnGhost(), textAlign: "left" }} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ??? ?몄쬆 ?????????????????????????????????????????????????????????????????????

function AdminIPLog() {
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const d = await ipLogsAPI.byDate(date); setEntries(d.entries); } catch { setEntries([]); }
    setLoading(false);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={{ ...css.input, flex: 1 }} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button style={css.btn(C.red)} onClick={load} disabled={loading}>議고쉶</button>
      </div>
      {loading ? <Spinner /> : entries.length === 0 ? <p style={{ color: C.muted, fontSize: 12 }}>?곗씠???놁쓬</p> : (
        <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 11, fontFamily: "monospace" }}>
          {entries.map((e, i) => <div key={i} style={{ padding: "4px 0", borderBottom: `1px solid ${C.border}`, color: C.dim }}>{JSON.stringify(e)}</div>)}
        </div>
      )}
    </div>
  );
}

function AuthPage({ auth, onLogin, onLogout }: { auth: AuthState; onLogin: (d: { token: string; userId: string; email: string }) => void; onLogout: () => void }) {
  const [mode, setMode]       = useState<"login"|"register">("login");
  const [form, setForm]       = useState<AuthFormState>({ email: "", password: "", studentId: "", name: "", grade: "1", classNum: "1" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const [success, setSuccess] = useState(false);

  const upd = (f: keyof AuthFormState) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setForm(p => ({ ...p, [f]: e.target.value }));

  const validate = (): string|null => {
    if (!isValidEmail(form.email))       return "?대찓???뺤떇???щ컮瑜댁? ?딆뒿?덈떎.";
    if (!isValidPassword(form.password)) return "鍮꾨?踰덊샇??8???댁긽?댁뼱???⑸땲??";
    if (mode === "register") {
      if (!isValidStudentId(form.studentId)) return "?숇쾲? 8?먮━ ?レ옄?ъ빞 ?⑸땲??";
      if (!form.name.trim())                 return "?대쫫???낅젰?댁＜?몄슂.";
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate(); if (err) { setError(err); return; }
    setError(null); setLoading(true);
    try {
      if (mode === "register") {
        await authAPI.register({ email: form.email, password: form.password, studentId: form.studentId, nameHash: simpleHash(form.name + form.studentId), grade: parseInt(form.grade), class: parseInt(form.classNum) });
        setSuccess(true);
      } else {
        const data = await authAPI.login(form.email, form.password);
        tokenStorage.setAccess(data.accessToken);
        tokenStorage.setRefresh(data.refreshToken);
        onLogin({ token: data.accessToken, userId: data.user.id, email: data.user.email });
      }
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  };

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch { /* 臾댁떆 */ }
    tokenStorage.clear(); setAccessToken(null); onLogout();
  };

  if (auth.userId) return (
    <div style={css.page}>
      <div style={{ ...css.card, maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>??/div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>濡쒓렇???곹깭?낅땲??/h2>
        <p style={{ color: C.dim, fontSize: 13, marginBottom: 6 }}>{auth.email}</p>
        {auth.profile && <p style={{ color: C.dim, fontSize: 13, marginBottom: 8 }}>{auth.profile.grade}?숇뀈 {auth.profile.class}諛?auth.profile.is_admin && <span style={{ ...css.badge(C.red), marginLeft: 8 }}>愿由ъ옄</span>}</p>}
        <span style={{ ...css.badge(C.green), display: "inline-block", marginBottom: 20 }}>?몄뀡 ?쒖꽦</span>
        <div style={{ ...css.card, background: "#0a1220", textAlign: "left", fontSize: 12, fontFamily: "monospace", marginBottom: 16 }}>
          <div style={{ color: C.green, marginBottom: 4 }}>// 蹂댁븞 濡쒓렇 (?숆탳 ?쒖텧??</div>
          <div style={{ color: C.dim }}>userId: <span style={{ color: C.accent }}>{auth.userId!.slice(0, 16)}??/span></div>
          <div style={{ color: C.dim }}>email:  <span style={{ color: C.accent }}>{auth.email}</span></div>
          <div style={{ color: C.green, marginTop: 8 }}>???숆탳 ?쒕쾭 IP 濡쒓렇 湲곕줉 ?꾨즺 ??/div>
        </div>
        {auth.profile?.is_admin && (
          <div style={{ ...css.card, background: "#0a1220", textAlign: "left", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 10 }}>?뵏 愿由ъ옄 ??IP 濡쒓렇 議고쉶</h3>
            <AdminIPLog />
          </div>
        )}
        <button style={{ ...css.btn(C.red), width: "100%" }} onClick={handleLogout}>濡쒓렇?꾩썐</button>
      </div>
    </div>
  );

  if (success) return (
    <div style={css.page}>
      <div style={{ ...css.card, maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>?벁</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>?대찓?쇱쓣 ?뺤씤?댁＜?몄슂</h2>
        <p style={{ color: C.dim, fontSize: 14 }}>{form.email} 濡??몄쬆 留곹겕瑜?蹂대깉?듬땲??<br />留곹겕 ?대┃ ??濡쒓렇?명븯?몄슂.</p>
        <button style={{ ...css.btn(), marginTop: 20 }} onClick={() => { setSuccess(false); setMode("login"); }}>濡쒓렇?몄쑝濡??대룞</button>
      </div>
    </div>
  );

  return (
    <div style={css.page}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{mode === "login" ? "濡쒓렇?? : "?뚯썝媛??}</h1>
        <p style={{ color: C.dim, fontSize: 13, marginBottom: "1.5rem" }}>?ㅻ챸 ?몄쬆 ???뷀샇??泥섎━ 쨌 IP ?섏쭛 쨌 ?숆탳 ?쒖텧?⑸땲??/p>
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
          <button style={mode === "login"    ? css.btn() : css.btnGhost()} onClick={() => setMode("login")}>濡쒓렇??/button>
          <button style={mode === "register" ? css.btn() : css.btnGhost()} onClick={() => setMode("register")}>?뚯썝媛??/button>
        </div>
        <div style={css.card}>
          <Field label="?대찓??*"><input style={css.input} type="email" placeholder="school@example.com" value={form.email} onChange={upd("email")} /></Field>
          <Field label="鍮꾨?踰덊샇 * (8???댁긽)"><input style={css.input} type="password" placeholder="鍮꾨?踰덊샇" value={form.password} onChange={upd("password")} /></Field>
          {mode === "register" && <>
            <Field label="?숇쾲 * (8?먮━ ?レ옄)"><input style={css.input} placeholder="20240101" maxLength={8} value={form.studentId} onChange={upd("studentId")} /></Field>
            <Field label="?대쫫 * (?댁떆 ?뷀샇???????"><input style={css.input} placeholder="?ㅻ챸 ?낅젰" value={form.name} onChange={upd("name")} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="?숇뀈"><select style={css.input} value={form.grade} onChange={upd("grade")}>{["1","2","3"].map(g => <option key={g} value={g}>{g}?숇뀈</option>)}</select></Field>
              <Field label="諛?><select style={css.input} value={form.classNum} onChange={upd("classNum")}>{["1","2","3","4","5","6"].map(c => <option key={c} value={c}>{c}諛?/option>)}</select></Field>
            </div>
          </>}
          <div style={{ background: "#1a0808", border: `1px solid ${C.red}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.dim, lineHeight: 1.8 }}>
            <strong style={{ color: C.red }}>?좑툘 媛쒖씤?뺣낫 ?섏쭛 ?덈궡</strong><br />
            ?묒냽 IP 쨌 ?숇쾲 쨌 ?대쫫???댁떆 ?뷀샇?붾릺???숆탳 ?쒕쾭???쒖텧?⑸땲??
            ?ъ씠踰꾪룺??쨌 紐낆삁?쇱넀 諛쒖깮 ??<strong style={{ color: C.yellow }}>?앺솢援먯쑁?꾩썝??/strong> 諛?<strong style={{ color: C.yellow }}>?숆탳??젰?梨낆떖?섏쐞?먰쉶</strong>???먮즺媛 ?쒖텧?⑸땲??
          </div>
          {error && <div style={css.errorBox}>{error}</div>}
          <button style={{ ...css.btn(), width: "100%", padding: "11px", marginTop: 12 }} onClick={handleSubmit} disabled={loading}>
            {loading ? "泥섎━ 以?.." : mode === "login" ? "濡쒓렇?? : "媛??諛??숈쓽"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ??? ??섎Т???????????????????????????????????????????????????????????????????

function BambooPage({ auth }: { auth: AuthState }) {
  const [posts, setPosts]     = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSub]  = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const [page, setPage]       = useState(1);
  const [totalPages, setTotal]= useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try { const r = await postsAPI.list("bamboo", p); setPosts(r.posts); setTotal(r.pagination.totalPages); } catch { /**/ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(page); }, [load, page]);

  const submit = async () => {
    if (!content.trim()) return;
    if (containsBannedWord(content)) { setError("湲덉????⑥뼱媛 ?ы븿?섏뼱 ?덉뒿?덈떎."); return; }
    setSub(true); setError(null);
    try { await postsAPI.create({ board: "bamboo", content, isAnonymous: true }); setContent(""); await load(1); setPage(1); }
    catch (e) { setError((e as Error).message); }
    setSub(false);
  };

  const handleLike = async (p: Post) => {
    if (!auth.userId) return;
    try { await postsAPI.like(p.id); setPosts(prev => prev.map(x => x.id === p.id ? { ...x, likes: x.likes + 1 } : x)); } catch { /**/ }
  };

  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>?럨 ??섎Т??/h1>
      <p style={{ color: C.dim, fontSize: 13, marginBottom: "1.5rem" }}>?듬챸?쇰줈 ?먯쑀濡?쾶 ?댁빞湲고빐?? ?뺤꽕쨌鍮꾨갑쨌?뱀젙???멸툒? 湲덉??⑸땲??</p>
      <div style={{ ...css.card, marginBottom: "1.5rem" }}>
        <textarea
          style={{ ...css.input, minHeight: 88, resize: "vertical", marginBottom: 10 }}
          placeholder={auth.userId ? "?듬챸?쇰줈 ?몄뼱?볤퀬 ?띠? ?댁빞湲곕? ?곸뼱蹂댁꽭??.." : "濡쒓렇?????댁슜?????덉뒿?덈떎."}
          value={content} disabled={!auth.userId || submitting}
          onChange={e => setContent(e.target.value)}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.muted }}>?뵏 ?듬챸 寃뚯떆 쨌 IP쨌怨꾩젙 ?쒕쾭 湲곕줉</span>
          <button style={css.btn(C.green)} onClick={submit} disabled={!auth.userId || submitting}>{submitting ? "寃뚯떆 以?.." : "?듬챸 寃뚯떆"}</button>
        </div>
        {error && <div style={css.errorBox}>{error}</div>}
      </div>
      {loading ? <Spinner /> : posts.map(p => (
        <div key={p.id} style={css.postCard(p.content.includes("?좉퀬") ? C.red : C.green)}>
          <p style={{ fontSize: 15, lineHeight: 1.75, margin: "0 0 10px" }}>{p.content}</p>
          <div style={{ display: "flex", gap: 14, fontSize: 13, color: C.muted, alignItems: "center" }}>
            <button style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0 }} onClick={() => handleLike(p)}>?ㅿ툘 {formatCount(p.likes)}</button>
            <span>?몓 {formatCount(p.views)}</span>
            <span style={{ marginLeft: "auto" }}>{formatDate(p.created_at)}</span>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button style={css.btnGhost(C.dim)} disabled={page === 1} onClick={() => setPage(p => p - 1)}>???댁쟾</button>
          <span style={{ padding: "8px 14px", color: C.dim, fontSize: 13 }}>{page} / {totalPages}</span>
          <button style={css.btnGhost(C.dim)} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>?ㅼ쓬 ??/button>
        </div>
      )}
    </div>
  );
}

// ??? 怨듬?怨듭쑀 ?????????????????????????????????????????????????????????????????

function StudyPage({ auth }: { auth: AuthState }) {
  const SUBJECTS = ["?꾩껜","?섑븰","?곸뼱","援?뼱","怨쇳븰","?ы쉶","湲고?"];
  const COLORS: Record<string,string> = { ?섑븰: C.purple, ?곸뼱: C.accent, 援?뼱: C.yellow, 怨쇳븰: C.green, ?ы쉶: "#fb923c" };
  const [posts, setPosts]     = useState<Post[]>([]);
  const [filter, setFilter]   = useState("?꾩껜");
  const [loading, setLoading] = useState(true);
  const [submitting, setSub]  = useState(false);
  const [form, setForm]       = useState({ title: "", content: "", subject: "?섑븰" });
  const [page, setPage]       = useState(1);
  const [totalPages, setTotal]= useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try { const r = await postsAPI.list("study", p); setPosts(r.posts); setTotal(r.pagination.totalPages); } catch { /**/ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(page); }, [load, page]);

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSub(true);
    try { await postsAPI.create({ board: "study", content: form.content, title: form.title, subject: form.subject }); setForm({ title: "", content: "", subject: "?섑븰" }); await load(1); setPage(1); } catch { /**/ }
    setSub(false);
  };

  const filtered = filter === "?꾩껜" ? posts : posts.filter(p => p.subject === filter);

  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>?뱴 怨듬? 怨듭쑀</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {SUBJECTS.map(s => <button key={s} style={filter === s ? css.btn() : css.btnGhost(C.dim)} onClick={() => setFilter(s)}>{s}</button>)}
      </div>
      {auth.userId && (
        <div style={{ ...css.card, marginBottom: "1.5rem", borderColor: C.green + "40" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: C.green }}>?뱾 ?먮즺 ?щ━湲?/h2>
          <Field label="?쒕ぉ"><input style={css.input} placeholder="?쒕ぉ" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
          <Field label="怨쇰ぉ"><select style={css.input} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}>{SUBJECTS.slice(1).map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="?댁슜"><textarea style={{ ...css.input, minHeight: 70, resize: "vertical" }} placeholder="?댁슜 ?먮뒗 留곹겕" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></Field>
          <button style={css.btn(C.green)} onClick={submit} disabled={submitting}>{submitting ? "?щ━??以?.." : "寃뚯떆?섍린"}</button>
        </div>
      )}
      {loading ? <Spinner /> : filtered.map(p => (
        <div key={p.id} style={css.postCard(COLORS[p.subject ?? ""] ?? C.muted)}>
          {p.subject && <span style={{ ...css.badge(COLORS[p.subject] ?? C.muted), marginBottom: 8, display: "inline-block" }}>{p.subject}</span>}
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{p.title}</h3>
          <p style={{ fontSize: 13, color: C.dim, margin: "0 0 10px", lineHeight: 1.6 }}>{p.content}</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
            <span>?ㅿ툘 {formatCount(p.likes)} 쨌 ?몓 {formatCount(p.views)}</span>
            <span>{formatDate(p.created_at)}</span>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button style={css.btnGhost(C.dim)} disabled={page === 1} onClick={() => setPage(p => p - 1)}>???댁쟾</button>
          <span style={{ padding: "8px 14px", color: C.dim, fontSize: 13 }}>{page} / {totalPages}</span>
          <button style={css.btnGhost(C.dim)} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>?ㅼ쓬 ??/button>
        </div>
      )}
    </div>
  );
}

// ??? ?꾩썝 ?????????????????????????????????????????????????????????????????????

function SponsorPage() {
  const tiers = [
    { name: "?뙮 ?덉떦", amount: "1,000??,   color: C.green,  perks: ["?꾩썝??諛곗?","??섎Т???대え吏"] },
    { name: "?뙼 泥?뀈", amount: "5,000??,   color: C.accent, perks: ["?덉떦 ?쒗깮 +","?됰꽕???됱긽","??怨듭? ?깅줉"], popular: true },
    { name: "?뙰 嫄곕ぉ", amount: "10,000??", color: C.purple, perks: ["泥?뀈 ?쒗깮 +","?댁쁺吏?梨꾪똿","?대쫫 ?깆옱"] },
  ];
  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>?뮎 ?곕━ ?숆탳 ?꾩썝</h1>
      <p style={{ color: C.dim, fontSize: 13, marginBottom: "1.5rem" }}>?꾩썝湲덉? ?쒕쾭 ?댁쁺鍮꾩? ?숆탳 ?됱궗???щ챸?섍쾶 ?ъ슜?⑸땲??</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: "2rem" }}>
        {tiers.map(t => (
          <div key={t.name} style={{ ...css.card, border: `1px solid ${t.color}40`, position: "relative" }}>
            {t.popular && <div style={{ ...css.badge(C.accent), position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>?멸린 狩?/div>}
            <div style={{ fontSize: 24, marginBottom: 4 }}>{t.name.split(" ")[0]}</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.name.split(" ")[1]}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.color, marginBottom: 14 }}>{t.amount}</div>
            <ul style={{ paddingLeft: 16, color: C.dim, fontSize: 13, lineHeight: 2.1, marginBottom: 16 }}>{t.perks.map(p => <li key={p}>{p}</li>)}</ul>
            <button style={{ ...css.btn(t.color), width: "100%" }}>?꾩썝?섍린</button>
          </div>
        ))}
      </div>
      <div style={{ ...css.card, textAlign: "center" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>?대쾲 ??紐⑺몴</h2>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.yellow, marginBottom: 6 }}>76%</div>
        <div style={{ background: C.border, borderRadius: 4, height: 10, maxWidth: 400, margin: "0 auto 10px" }}>
          <div style={{ background: C.yellow, width: "76%", height: "100%", borderRadius: 4 }} />
        </div>
        <p style={{ fontSize: 13, color: C.dim }}>紐⑺몴 ??00,000 쨌 ?꾩옱 ??52,000 쨌 47紐?李몄뿬</p>
      </div>
    </div>
  );
}

// ??? 梨꾪똿 (Socket.io) ?????????????????????????????????????????????????????????

function ChatPage({ auth }: { auth: AuthState }) {
  const ROOMS = ["?꾩껜","2?숇뀈","1諛?,"?ㅽ꽣??];
  const [msgs, setMsgs]       = useState<ChatMessage[]>([]);
  const [input, setInput]     = useState("");
  const [room, setRoom]       = useState("?꾩껜");
  const [loading, setLoading] = useState(true);
  const endRef                = useRef<HTMLDivElement>(null);
  const myName                = auth.profile ? `${auth.profile.grade}?숇뀈 ${auth.profile.class}諛? : "?듬챸";

  useEffect(() => {
    setLoading(true);
    setMsgs([]);
    joinRoom(room);
    chatAPI.messages(room)
      .then(data => setMsgs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
    const off = onReceiveMessage(msg => {
      setMsgs(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });
    return () => { off(); leaveRoom(room); };
  }, [room]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = () => {
    const text = input.trim();
    if (!text || !auth.userId) return;
    setInput("");
    setMsgs(prev => [...prev, { id: Date.now(), room, author_id: auth.userId!, author_name: myName, content: text, created_at: new Date().toISOString() }]);
    chatAPI.send(room, text, myName, auth.userId);
  };

  return (
    <div style={{ ...css.page, display: "flex", flexDirection: "column", height: "calc(100vh - 58px)", paddingBottom: 0 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, flexShrink: 0 }}>?뮠 ?ㅼ떆媛?梨꾪똿</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexShrink: 0, flexWrap: "wrap" }}>
        {ROOMS.map(r => <button key={r} style={room === r ? css.btn() : css.btnGhost(C.dim)} onClick={() => setRoom(r)}>{r}</button>)}
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1rem", marginBottom: 10 }}>
        {loading ? <Spinner /> : msgs.map(m => {
          const isMe = m.author_id === auth.userId;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div style={{ maxWidth: "70%" }}>
                {!isMe && <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{m.author_name}</div>}
                <div style={{ background: isMe ? C.accent : "#1a2740", color: isMe ? "#000" : C.text, borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "8px 14px", fontSize: 14 }}>{m.content}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3, textAlign: isMe ? "right" : "left" }}>{formatTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0, paddingBottom: "1rem" }}>
        <input
          style={{ ...css.input, flex: 1 }}
          placeholder={auth.userId ? "硫붿떆吏 ?낅젰... (Enter)" : "濡쒓렇?????댁슜?섏꽭??}
          disabled={!auth.userId} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button style={css.btn()} onClick={send} disabled={!auth.userId}>?꾩넚</button>
      </div>
    </div>
  );
}

// ??? ?ㅽ뵂梨꾪똿 ?????????????????????????????????????????????????????????????????

function OpenChatPage() {
  const rooms: OpenChatRoom[] = [
    { id: "math",   name: "?섑븰 ?ㅽ꽣??, emoji: "?뱰", desc: "湲곕쭚怨좎궗 ?鍮??④퍡 怨듬??댁슂", members: 23, active: true  },
    { id: "game",   name: "寃뚯엫 ?〓떞",   emoji: "?렜", desc: "?숆탳 ?앸굹怨?諛곌렇/濡??섏떎遺?", members: 45, active: true  },
    { id: "music",  name: "?뚯븙 異붿쿇",   emoji: "?렦", desc: "?붿쬁 ?ｋ뒗 ?몃옒 怨듭쑀?⑹떆??,   members: 12, active: false },
    { id: "lunch",  name: "湲됱떇 ?됯???, emoji: "?띂截?, desc: "?ㅻ뒛 湲됱떇 蹂꾩젏 留ㅺ린??怨?,    members: 67, active: true  },
    { id: "exam",   name: "?쒗뿕 ?뺣낫",   emoji: "?뱷", desc: "?쒗뿕 踰붿쐞, 異쒖젣 寃쏀뼢 怨듭쑀",    members: 89, active: true  },
    { id: "travel", name: "?ы뻾 怨꾪쉷",   emoji: "?뙊", desc: "諛⑺븰???대뵒 媛덇퉴??",         members: 8,  active: false },
  ];
  const [search, setSearch] = useState("");
  const filtered = rooms.filter(r => r.name.includes(search) || r.desc.includes(search));
  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>?뙋 ?ㅽ뵂梨꾪똿</h1>
      <div style={{ marginBottom: "1.2rem" }}><input style={css.input} placeholder="梨꾪똿諛?寃??.." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
        {filtered.map(r => (
          <div key={r.id} style={css.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>{r.emoji} {r.name}</span>
              <span style={css.badge(r.active ? C.green : C.muted)}>{r.active ? "?쒖꽦" : "議곗슜"}</span>
            </div>
            <p style={{ fontSize: 13, color: C.dim, margin: "0 0 12px" }}>{r.desc}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>?뫁 {r.members}紐?/span>
              <button style={css.btn()}>李몄뿬</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ??? ?먯쑀?쒓컙 ?????????????????????????????????????????????????????????????????

function FreeTimePage() {
  const [subTab, setSubTab] = useState<"polls"|"games">("polls");
  const [votes, setVotes]   = useState<Record<string,number|null>>({});
  const [dice, setDice]     = useState<string|null>(null);
  const [rps, setRps]       = useState<string|null>(null);

  const polls: Poll[] = [
    { id: "lunch",  question: "?ㅻ뒛 湲됱떇 ?대븷?섏슂?",  options: [{ label: "留쏆엳?덉뼱???삄", count: 134 }, { label: "洹몃깷 洹몃옒???삉", count: 67 }, { label: "蹂꾨줈??댁슂 ?삛", count: 42 }] },
    { id: "season", question: "醫뗭븘?섎뒗 怨꾩젅??",     options: [{ label: "遊??뙵", count: 89 }, { label: "?щ쫫 ?截?, count: 120 }, { label: "媛???뛼", count: 95 }, { label: "寃⑥슱 ?꾬툘", count: 60 }] },
  ];

  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: "1.2rem" }}>?렜 ?먯쑀?쒓컙</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        <button style={subTab === "polls" ? css.btn() : css.btnGhost()} onClick={() => setSubTab("polls")}>?뱤 ?ы몴</button>
        <button style={subTab === "games" ? css.btn(C.purple) : css.btnGhost(C.purple)} onClick={() => setSubTab("games")}>?렡 誘몃땲寃뚯엫</button>
      </div>
      {subTab === "polls" && polls.map(poll => {
        const voted = votes[poll.id];
        const total = poll.options.reduce((a, o) => a + o.count, 0);
        return (
          <div key={poll.id} style={{ ...css.card, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{poll.question}</h2>
            {poll.options.map((opt, i) => {
              const pct = Math.round((opt.count / total) * 100);
              return (
                <div key={opt.label} style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => { if (votes[poll.id] == null) setVotes(p => ({ ...p, [poll.id]: i })); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{opt.label}</span>
                    {voted != null && <span style={{ color: C.dim }}>{pct}%</span>}
                  </div>
                  <div style={{ background: C.border, borderRadius: 4, height: 28, position: "relative", overflow: "hidden" }}>
                    {voted != null && <div style={{ width: `${pct}%`, height: "100%", background: voted === i ? C.accent : "#1a2740", transition: "width 0.4s" }} />}
                    {voted == null && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 10, fontSize: 13 }}>{opt.label}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {subTab === "games" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
          <div style={{ ...css.card, textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{dice ?? "?렡"}</div>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>二쇱궗??援대━湲?/div>
            <button style={css.btn(C.purple)} onClick={() => setDice(["?","??,"??,"??,"??,"??][Math.floor(Math.random() * 6)])}>援대━湲?/button>
          </div>
          <div style={{ ...css.card, textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>??/div>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>臾듭컡鍮?/div>
            <button style={css.btn(C.purple)} onClick={() => setRps("而댄벂?? " + ["??二쇰㉨","?뚳툘 媛??,"?뼆截?蹂?][Math.floor(Math.random() * 3)])}>?꾩쟾</button>
            {rps && <p style={{ marginTop: 10, fontSize: 13, color: C.dim }}>{rps}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ??? 而ㅻ??덊떚 ?????????????????????????????????????????????????????????????????

function CommunityPage({ auth }: { auth: AuthState }) {
  const [subTab, setSubTab]   = useState<"blog"|"short">("blog");
  const [posts, setPosts]     = useState<Post[]>([]);
  const [shorts, setShorts]   = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSub]  = useState(false);
  const [form, setForm]       = useState({ title: "", content: "" });
  const [videoFile, setVF]    = useState<File|null>(null);
  const [videoTitle, setVT]   = useState("");
  const [progress, setProg]   = useState<string|null>(null);
  const [toast, setToast]     = useState<string|null>(null);

  const loadBlog   = useCallback(async () => { setLoading(true); try { const r = await postsAPI.list("blog");  setPosts(r.posts);  } catch { /**/ } setLoading(false); }, []);
  const loadShorts = useCallback(async () => { setLoading(true); try { const r = await postsAPI.list("short"); setShorts(r.posts); } catch { /**/ } setLoading(false); }, []);

  useEffect(() => { if (subTab === "blog") void loadBlog(); else void loadShorts(); }, [subTab, loadBlog, loadShorts]);

  const submitBlog = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSub(true);
    try { await postsAPI.create({ board: "blog", content: form.content, title: form.title }); setForm({ title: "", content: "" }); await loadBlog(); setToast("寃뚯떆湲??諛쒗뻾?섏뿀?듬땲??"); } catch { /**/ }
    setSub(false);
  };

  const submitShort = async () => {
    if (!videoFile || !videoTitle.trim()) return;
    if (!isVideoFile(videoFile)) { setToast("mp4, mov, webm ?뚯씪留??낅줈??媛?ν빀?덈떎."); return; }
    setSub(true); setProg(`?낅줈??以?.. (${formatFileSize(videoFile.size)})`);
    try { await storageAPI.uploadShort(videoFile, videoTitle); setVF(null); setVT(""); await loadShorts(); setToast("?륂뤌???낅줈?쒕릺?덉뒿?덈떎!"); }
    catch (e) { setToast((e as Error).message); }
    setProg(null); setSub(false);
  };

  return (
    <div style={css.page}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: "1rem" }}>?뱷 而ㅻ??덊떚</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        <button style={subTab === "blog"  ? css.btn()         : css.btnGhost()} onClick={() => setSubTab("blog")}>?뱞 釉붾줈洹?/button>
        <button style={subTab === "short" ? css.btn(C.purple) : css.btnGhost(C.purple)} onClick={() => setSubTab("short")}>?벑 ?륂뤌</button>
      </div>
      {subTab === "blog" && <>
        {auth.userId && (
          <div style={{ ...css.card, marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>?륅툘 湲 ?곌린</h2>
            <Field label="?쒕ぉ"><input style={css.input} placeholder="?쒕ぉ" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
            <Field label="?댁슜"><textarea style={{ ...css.input, minHeight: 90, resize: "vertical" }} placeholder="?댁슜" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></Field>
            <button style={css.btn()} onClick={submitBlog} disabled={submitting}>{submitting ? "諛쒗뻾 以?.." : "諛쒗뻾?섍린"}</button>
          </div>
        )}
        {loading ? <Spinner /> : posts.map(p => (
          <div key={p.id} style={css.postCard(C.purple)}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{p.title}</h3>
            <p style={{ fontSize: 13, color: C.dim, margin: "0 0 10px", lineHeight: 1.6 }}>{p.content.slice(0, 120)}{p.content.length > 120 ? "?? : ""}</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
              <span>?ㅿ툘 {formatCount(p.likes)} 쨌 ?몓 {formatCount(p.views)}</span>
              <span>{formatDate(p.created_at)}</span>
            </div>
          </div>
        ))}
      </>}
      {subTab === "short" && <>
        {auth.userId && (
          <div style={{ ...css.card, marginBottom: "1.5rem", borderColor: C.purple + "40" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: C.purple }}>?벞 ?륂뤌 ?щ━湲?/h2>
            <Field label="?쒕ぉ"><input style={css.input} placeholder="?곸긽 ?쒕ぉ" value={videoTitle} onChange={e => setVT(e.target.value)} /></Field>
            <Field label="?곸긽 ?뚯씪 (mp4/mov/webm, 理쒕? 100MB)">
              <input style={{ ...css.input, cursor: "pointer" }} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e => setVF(e.target.files?.[0] ?? null)} />
            </Field>
            {videoFile && <p style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>?좏깮: {videoFile.name} ({formatFileSize(videoFile.size)})</p>}
            {progress  && <p style={{ fontSize: 12, color: C.yellow, marginBottom: 10 }}>{progress}</p>}
            <button style={css.btn(C.purple)} onClick={submitShort} disabled={submitting || !videoFile}>{submitting ? "?낅줈??以?.." : "?낅줈??}</button>
          </div>
        )}
        {loading ? <Spinner /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
            {shorts.map(s => (
              <div key={s.id} style={{ ...css.card, padding: 0, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ background: "#141d2e", height: 190, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, position: "relative" }}>
                  ?벞
                  <div style={{ position: "absolute", bottom: 6, right: 8, background: "#0008", color: "#fff", fontSize: 11, borderRadius: 4, padding: "2px 6px" }}>?륂뤌</div>
                </div>
                <div style={{ padding: "0.65rem 0.9rem" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{s.title ?? "?쒕ぉ ?놁쓬"}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>?몓 {formatCount(s.views)} 쨌 {formatDate(s.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>}
    </div>
  );
}

// ??? ??猷⑦듃 ??????????????????????????????????????????????????????????????????

export default function App() {
  const [tab, setTab]              = useState<TabId>("home");
  const [auth, setAuth]            = useState<AuthState>({ userId: null, email: null, profile: null, token: null });
  const [authLoading, setAuthLoad] = useState(true);

  useEffect(() => {
    const token = tokenStorage.getAccess();
    if (!token) { setAuthLoad(false); return; }
    setAccessToken(token);
    authAPI.me()
      .then(profile => setAuth({ userId: profile.id, email: null, profile, token }))
      .catch(() => { tokenStorage.clear(); setAccessToken(null); })
      .finally(() => setAuthLoad(false));
  }, []);

  const handleLogin = useCallback(async (data: { token: string; userId: string; email: string }) => {
    setAccessToken(data.token);
    try { const profile = await authAPI.me(); setAuth({ userId: data.userId, email: data.email, profile, token: data.token }); }
    catch { setAuth({ userId: data.userId, email: data.email, profile: null, token: data.token }); }
  }, []);

  const handleLogout = useCallback(() => {
    setAuth({ userId: null, email: null, profile: null, token: null });
  }, []);

  if (authLoading) return (
    <div style={{ ...css.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  // JSX.Element ???React.ReactElement ?ъ슜 (react-jsx 紐⑤뱶 ?명솚)
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
        <div style={css.logo}>?럨 ?곕━?숆탳</div>
        {TABS.map(t => (
          <button key={t.id} style={css.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        {auth.userId && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingLeft: 8 }}>
            <span style={css.badge(C.green)}>
              {auth.profile ? `${auth.profile.grade}?숇뀈 ${auth.profile.class}諛? : "濡쒓렇??以?}
              {auth.profile?.is_admin && " ?몣"}
            </span>
          </div>
        )}
      </nav>
      {pages[tab]}
    </div>
  );
}

