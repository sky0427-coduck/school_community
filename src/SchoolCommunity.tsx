/**
 * SchoolCommunity.tsx
 * React + TypeScript — 백엔드 API + Socket.io 실시간 채팅
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

// ─── 타입 ────────────────────────────────────────────────────────────────────

type TabId = "home"|"auth"|"bamboo"|"study"|"sponsor"|"chat"|"openchat"|"freetime"|"community";

interface AuthState      { userId: string|null; email: string|null; profile: Profile|null; token: string|null; }
interface AuthFormState  { email: string; password: string; studentId: string; name: string; grade: string; classNum: string; }
interface OpenChatRoom   { id: string; name: string; emoji: string; desc: string; members: number; active: boolean; }
interface Poll           { id: string; question: string; options: Array<{ label: string; count: number }>; }

// ─── 디자인 토큰 ──────────────────────────────────────────────────────────────

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

// ─── 공통 컴포넌트 ────────────────────────────────────────────────────────────

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

// ─── 탭 목록 ──────────────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "home",      label: "🏠 홈"       },
  { id: "auth",      label: "🔐 로그인"   },
  { id: "bamboo",    label: "🎋 대나무숲" },
  { id: "study",     label: "📚 공부공유" },
  { id: "sponsor",   label: "💛 후원"     },
  { id: "chat",      label: "💬 채팅"     },
  { id: "openchat",  label: "🌐 오픈채팅" },
  { id: "freetime",  label: "🎮 자유시간" },
  { id: "community", label: "📝 커뮤니티" },
];

// ─── 홈 ───────────────────────────────────────────────────────────────────────

function HomePage({ auth, setTab }: { auth: AuthState; setTab: (t: TabId) => void }) {
  const stats = [
    { label: "가입 학생",   value: "1,247명",  color: C.accent },
    { label: "오늘 게시글", value: "83개",     color: C.purple },
    { label: "실시간 접속", value: "142명",    color: C.green  },
    { label: "누적 후원",   value: "₩320,000", color: C.yellow },
  ];
  const notices = [
    { tag: "안내",   text: "개인정보 처리방침이 업데이트 되었습니다.",    color: C.yellow },
    { tag: "긴급",   text: "학교폭력 신고: 117 또는 대나무숲 익명 신고", color: C.red    },
    { tag: "이벤트", text: "공부공유 100번째 게시글 이벤트 진행 중!",    color: C.green  },
  ];
  return (
    <div style={css.page}>
      <div style={{ marginBottom: "2rem" }}>
        <span style={{ ...css.badge(C.accent), marginBottom: 12 }}>우리학교 커뮤니티</span>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0 8px", letterSpacing: "-0.5px" }}>
          {auth.profile ? `환영해요, ${auth.profile.grade}학년 ${auth.profile.class}반! 👋` : "중학교 커뮤니티에 오신 걸 환영합니다"}
        </h1>
        <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
          익명 대나무숲부터 공부 공유, 실시간 채팅까지 — 우리 학교만의 공간입니다.<br />
          <span style={{ color: C.red, fontSize: 12 }}>⚠️ 모든 활동은 학교 안전을 위해 IP 및 계정 로그가 수집됩니다.</span>
        </p>
        {!auth.userId && <button style={css.btn()} onClick={() => setTab("auth")}>지금 시작하기 →</button>}
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
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📢 공지사항</h2>
        {notices.map((n, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < notices.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <span style={css.badge(n.color)}>{n.tag}</span>
            <span style={{ fontSize: 14 }}>{n.text}</span>
          </div>
        ))}
      </div>
      <div style={css.card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🔥 빠른 이동</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
          {TABS.filter(t => t.id !== "home" && t.id !== "auth").map(t => (
            <button key={t.id} style={{ ...css.btnGhost(), textAlign: "left" }} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 인증 ─────────────────────────────────────────────────────────────────────

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
        <button style={css.btn(C.red)} onClick={load} disabled={loading}>조회</button>
      </div>
      {loading ? <Spinner /> : entries.length === 0 ? <p style={{ color: C.muted, fontSize: 12 }}>데이터 없음</p> : (
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
    if (!isValidEmail(form.email))       return "이메일 형식이 올바르지 않습니다.";
    if (!isValidPassword(form.password)) return "비밀번호는 8자 이상이어야 합니다.";
    if (mode === "register") {
      if (!isValidStudentId(form.studentId)) return "학번은 8자리 숫자여야 합니다.";
      if (!form.name.trim())                 return "이름을 입력해주세요.";
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
    try { await authAPI.logout(); } catch { /* 무시 */ }
    tokenStorage.clear(); setAccessToken(null); onLogout();
  };

  if (auth.userId) return (
    <div style={css.page}>
      <div style={{ ...css.card, maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>로그인 상태입니다</h2>
        <p style={{ color: C.dim, fontSize: 13, marginBottom: 6 }}>{auth.email}</p>
        {auth.profile && <p style={{ color: C.dim, fontSize: 13, marginBottom: 8 }}>{auth.profile.grade}학년 {auth.profile.class}반{auth.profile.is_admin && <span style={{ ...css.badge(C.red), marginLeft: 8 }}>관리자</span>}</p>}
        <span style={{ ...css.badge(C.green), display: "inline-block", marginBottom: 20 }}>세션 활성</span>
        <div style={{ ...css.card, background: "#0a1220", textAlign: "left", fontSize: 12, fontFamily: "monospace", marginBottom: 16 }}>
          <div style={{ color: C.green, marginBottom: 4 }}>// 보안 로그 (학교 제출용)</div>
          <div style={{ color: C.dim }}>userId: <span style={{ color: C.accent }}>{auth.userId!.slice(0, 16)}…</span></div>
          <div style={{ color: C.dim }}>email:  <span style={{ color: C.accent }}>{auth.email}</span></div>
          <div style={{ color: C.green, marginTop: 8 }}>→ 학교 서버 IP 로그 기록 완료 ✓</div>
        </div>
        {auth.profile?.is_admin && (
          <div style={{ ...css.card, background: "#0a1220", textAlign: "left", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 10 }}>🔒 관리자 — IP 로그 조회</h3>
            <AdminIPLog />
          </div>
        )}
        <button style={{ ...css.btn(C.red), width: "100%" }} onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  );

  if (success) return (
    <div style={css.page}>
      <div style={{ ...css.card, maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📧</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>이메일을 확인해주세요</h2>
        <p style={{ color: C.dim, fontSize: 14 }}>{form.email} 로 인증 링크를 보냈습니다.<br />링크 클릭 후 로그인하세요.</p>
        <button style={{ ...css.btn(), marginTop: 20 }} onClick={() => { setSuccess(false); setMode("login"); }}>로그인으로 이동</button>
      </div>
    </div>
  );

  return (
    <div style={css.page}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{mode === "login" ? "로그인" : "회원가입"}</h1>
        <p style={{ color: C.dim, fontSize: 13, marginBottom: "1.5rem" }}>실명 인증 후 암호화 처리 · IP 수집 · 학교 제출됩니다</p>
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
          <button style={mode === "login"    ? css.btn() : css.btnGhost()} onClick={() => setMode("login")}>로그인</button>
          <button style={mode === "register" ? css.btn() : css.btnGhost()} onClick={() => setMode("register")}>회원가입</button>
        </div>
        <div style={css.card}>
          <Field label="이메일 *"><input style={css.input} type="email" placeholder="school@example.com" value={form.email} onChange={upd("email")} /></Field>
          <Field label="비밀번호 * (8자 이상)"><input style={css.input} type="password" placeholder="비밀번호" value={form.password} onChange={upd("password")} /></Field>
          {mode === "register" && <>
            <Field label="학번 * (8자리 숫자)"><input style={css.input} placeholder="20240101" maxLength={8} value={form.studentId} onChange={upd("studentId")} /></Field>
            <Field label="이름 * (해시 암호화 후 저장)"><input style={css.input} placeholder="실명 입력" value={form.name} onChange={upd("name")} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="학년"><select style={css.input} value={form.grade} onChange={upd("grade")}>{["1","2","3"].map(g => <option key={g} value={g}>{g}학년</option>)}</select></Field>
              <Field label="반"><select style={css.input} value={form.classNum} onChange={upd("classNum")}>{["1","2","3","4","5","6"].map(c => <option key={c} value={c}>{c}반</option>)}</select></Field>
            </div>
          </>}
          <div style={{ background: "#1a0808", border: `1px solid ${C.red}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.dim, lineHeight: 1.8 }}>
            <strong style={{ color: C.red }}>⚠️ 개인정보 수집 안내</strong><br />
            접속 IP · 학번 · 이름이 해시 암호화되어 학교 서버에 제출됩니다.
            사이버폭력 · 명예훼손 발생 시 <strong style={{ color: C.yellow }}>생활교육위원회</strong> 및 <strong style={{ color: C.yellow }}>학교폭력대책심의위원회</strong>에 자료가 제출됩니다.
          </div>
          {error && <div style={css.errorBox}>{error}</div>}
          <button style={{ ...css.btn(), width: "100%", padding: "11px", marginTop: 12 }} onClick={handleSubmit} disabled={loading}>
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입 및 동의"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 대나무숲 ─────────────────────────────────────────────────────────────────

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
    if (containsBannedWord(content)) { setError("금지된 단어가 포함되어 있습니다."); return; }
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
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>🎋 대나무숲</h1>
      <p style={{ color: C.dim, fontSize: 13, marginBottom: "1.5rem" }}>익명으로 자유롭게 이야기해요. 욕설·비방·특정인 언급은 금지됩니다.</p>
      <div style={{ ...css.card, marginBottom: "1.5rem" }}>
        <textarea
          style={{ ...css.input, minHeight: 88, resize: "vertical", marginBottom: 10 }}
          placeholder={auth.userId ? "익명으로 털어놓고 싶은 이야기를 적어보세요..." : "로그인 후 이용할 수 있습니다."}
          value={content} disabled={!auth.userId || submitting}
          onChange={e => setContent(e.target.value)}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.muted }}>🔒 익명 게시 · IP·계정 서버 기록</span>
          <button style={css.btn(C.green)} onClick={submit} disabled={!auth.userId || submitting}>{submitting ? "게시 중..." : "익명 게시"}</button>
        </div>
        {error && <div style={css.errorBox}>{error}</div>}
      </div>
      {loading ? <Spinner /> : posts.map(p => (
        <div key={p.id} style={css.postCard(p.content.includes("신고") ? C.red : C.green)}>
          <p style={{ fontSize: 15, lineHeight: 1.75, margin: "0 0 10px" }}>{p.content}</p>
          <div style={{ display: "flex", gap: 14, fontSize: 13, color: C.muted, alignItems: "center" }}>
            <button style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0 }} onClick={() => handleLike(p)}>❤️ {formatCount(p.likes)}</button>
            <span>👁 {formatCount(p.views)}</span>
            <span style={{ marginLeft: "auto" }}>{formatDate(p.created_at)}</span>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button style={css.btnGhost(C.dim)} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 이전</button>
          <span style={{ padding: "8px 14px", color: C.dim, fontSize: 13 }}>{page} / {totalPages}</span>
          <button style={css.btnGhost(C.dim)} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>다음 →</button>
        </div>
      )}
    </div>
  );
}

// ─── 공부공유 ─────────────────────────────────────────────────────────────────

function StudyPage({ auth }: { auth: AuthState }) {
  const SUBJECTS = ["전체","수학","영어","국어","과학","사회","기타"];
  const COLORS: Record<string,string> = { 수학: C.purple, 영어: C.accent, 국어: C.yellow, 과학: C.green, 사회: "#fb923c" };
  const [posts, setPosts]     = useState<Post[]>([]);
  const [filter, setFilter]   = useState("전체");
  const [loading, setLoading] = useState(true);
  const [submitting, setSub]  = useState(false);
  const [form, setForm]       = useState({ title: "", content: "", subject: "수학" });
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
    try { await postsAPI.create({ board: "study", content: form.content, title: form.title, subject: form.subject }); setForm({ title: "", content: "", subject: "수학" }); await load(1); setPage(1); } catch { /**/ }
    setSub(false);
  };

  const filtered = filter === "전체" ? posts : posts.filter(p => p.subject === filter);

  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>📚 공부 공유</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {SUBJECTS.map(s => <button key={s} style={filter === s ? css.btn() : css.btnGhost(C.dim)} onClick={() => setFilter(s)}>{s}</button>)}
      </div>
      {auth.userId && (
        <div style={{ ...css.card, marginBottom: "1.5rem", borderColor: C.green + "40" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: C.green }}>📤 자료 올리기</h2>
          <Field label="제목"><input style={css.input} placeholder="제목" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
          <Field label="과목"><select style={css.input} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}>{SUBJECTS.slice(1).map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="내용"><textarea style={{ ...css.input, minHeight: 70, resize: "vertical" }} placeholder="내용 또는 링크" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></Field>
          <button style={css.btn(C.green)} onClick={submit} disabled={submitting}>{submitting ? "올리는 중..." : "게시하기"}</button>
        </div>
      )}
      {loading ? <Spinner /> : filtered.map(p => (
        <div key={p.id} style={css.postCard(COLORS[p.subject ?? ""] ?? C.muted)}>
          {p.subject && <span style={{ ...css.badge(COLORS[p.subject] ?? C.muted), marginBottom: 8, display: "inline-block" }}>{p.subject}</span>}
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{p.title}</h3>
          <p style={{ fontSize: 13, color: C.dim, margin: "0 0 10px", lineHeight: 1.6 }}>{p.content}</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
            <span>❤️ {formatCount(p.likes)} · 👁 {formatCount(p.views)}</span>
            <span>{formatDate(p.created_at)}</span>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button style={css.btnGhost(C.dim)} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 이전</button>
          <span style={{ padding: "8px 14px", color: C.dim, fontSize: 13 }}>{page} / {totalPages}</span>
          <button style={css.btnGhost(C.dim)} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>다음 →</button>
        </div>
      )}
    </div>
  );
}

// ─── 후원 ─────────────────────────────────────────────────────────────────────

function SponsorPage() {
  const tiers = [
    { name: "🌱 새싹", amount: "1,000원",   color: C.green,  perks: ["후원자 배지","대나무숲 이모지"] },
    { name: "🌿 청년", amount: "5,000원",   color: C.accent, perks: ["새싹 혜택 +","닉네임 색상","월 공지 등록"], popular: true },
    { name: "🌳 거목", amount: "10,000원+", color: C.purple, perks: ["청년 혜택 +","운영진 채팅","이름 등재"] },
  ];
  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>💛 우리 학교 후원</h1>
      <p style={{ color: C.dim, fontSize: 13, marginBottom: "1.5rem" }}>후원금은 서버 운영비와 학교 행사에 투명하게 사용됩니다.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: "2rem" }}>
        {tiers.map(t => (
          <div key={t.name} style={{ ...css.card, border: `1px solid ${t.color}40`, position: "relative" }}>
            {t.popular && <div style={{ ...css.badge(C.accent), position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>인기 ⭐</div>}
            <div style={{ fontSize: 24, marginBottom: 4 }}>{t.name.split(" ")[0]}</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.name.split(" ")[1]}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.color, marginBottom: 14 }}>{t.amount}</div>
            <ul style={{ paddingLeft: 16, color: C.dim, fontSize: 13, lineHeight: 2.1, marginBottom: 16 }}>{t.perks.map(p => <li key={p}>{p}</li>)}</ul>
            <button style={{ ...css.btn(t.color), width: "100%" }}>후원하기</button>
          </div>
        ))}
      </div>
      <div style={{ ...css.card, textAlign: "center" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>이번 달 목표</h2>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.yellow, marginBottom: 6 }}>76%</div>
        <div style={{ background: C.border, borderRadius: 4, height: 10, maxWidth: 400, margin: "0 auto 10px" }}>
          <div style={{ background: C.yellow, width: "76%", height: "100%", borderRadius: 4 }} />
        </div>
        <p style={{ fontSize: 13, color: C.dim }}>목표 ₩200,000 · 현재 ₩152,000 · 47명 참여</p>
      </div>
    </div>
  );
}

// ─── 채팅 (Socket.io) ─────────────────────────────────────────────────────────

function ChatPage({ auth }: { auth: AuthState }) {
  const ROOMS = ["전체","2학년","1반","스터디"];
  const [msgs, setMsgs]       = useState<ChatMessage[]>([]);
  const [input, setInput]     = useState("");
  const [room, setRoom]       = useState("전체");
  const [loading, setLoading] = useState(true);
  const endRef                = useRef<HTMLDivElement>(null);
  const myName                = auth.profile ? `${auth.profile.grade}학년 ${auth.profile.class}반` : "익명";

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
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, flexShrink: 0 }}>💬 실시간 채팅</h1>
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
          placeholder={auth.userId ? "메시지 입력... (Enter)" : "로그인 후 이용하세요"}
          disabled={!auth.userId} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button style={css.btn()} onClick={send} disabled={!auth.userId}>전송</button>
      </div>
    </div>
  );
}

// ─── 오픈채팅 ─────────────────────────────────────────────────────────────────

function OpenChatPage() {
  const rooms: OpenChatRoom[] = [
    { id: "math",   name: "수학 스터디", emoji: "📖", desc: "기말고사 대비 함께 공부해요", members: 23, active: true  },
    { id: "game",   name: "게임 잡담",   emoji: "🎮", desc: "학교 끝나고 배그/롤 하실분?", members: 45, active: true  },
    { id: "music",  name: "음악 추천",   emoji: "🎵", desc: "요즘 듣는 노래 공유합시다",   members: 12, active: false },
    { id: "lunch",  name: "급식 평가단", emoji: "🍽️", desc: "오늘 급식 별점 매기는 곳",    members: 67, active: true  },
    { id: "exam",   name: "시험 정보",   emoji: "📝", desc: "시험 범위, 출제 경향 공유",    members: 89, active: true  },
    { id: "travel", name: "여행 계획",   emoji: "🌏", desc: "방학에 어디 갈까요?",         members: 8,  active: false },
  ];
  const [search, setSearch] = useState("");
  const filtered = rooms.filter(r => r.name.includes(search) || r.desc.includes(search));
  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>🌐 오픈채팅</h1>
      <div style={{ marginBottom: "1.2rem" }}><input style={css.input} placeholder="채팅방 검색..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
        {filtered.map(r => (
          <div key={r.id} style={css.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>{r.emoji} {r.name}</span>
              <span style={css.badge(r.active ? C.green : C.muted)}>{r.active ? "활성" : "조용"}</span>
            </div>
            <p style={{ fontSize: 13, color: C.dim, margin: "0 0 12px" }}>{r.desc}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>👥 {r.members}명</span>
              <button style={css.btn()}>참여</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 자유시간 ─────────────────────────────────────────────────────────────────

function FreeTimePage() {
  const [subTab, setSubTab] = useState<"polls"|"games">("polls");
  const [votes, setVotes]   = useState<Record<string,number|null>>({});
  const [dice, setDice]     = useState<string|null>(null);
  const [rps, setRps]       = useState<string|null>(null);

  const polls: Poll[] = [
    { id: "lunch",  question: "오늘 급식 어땠나요?",  options: [{ label: "맛있었어요 😋", count: 134 }, { label: "그냥 그래요 😐", count: 67 }, { label: "별로였어요 😞", count: 42 }] },
    { id: "season", question: "좋아하는 계절은?",     options: [{ label: "봄 🌸", count: 89 }, { label: "여름 ☀️", count: 120 }, { label: "가을 🍂", count: 95 }, { label: "겨울 ❄️", count: 60 }] },
  ];

  return (
    <div style={css.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: "1.2rem" }}>🎮 자유시간</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        <button style={subTab === "polls" ? css.btn() : css.btnGhost()} onClick={() => setSubTab("polls")}>📊 투표</button>
        <button style={subTab === "games" ? css.btn(C.purple) : css.btnGhost(C.purple)} onClick={() => setSubTab("games")}>🎲 미니게임</button>
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
            <div style={{ fontSize: 40, marginBottom: 8 }}>{dice ?? "🎲"}</div>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>주사위 굴리기</div>
            <button style={css.btn(C.purple)} onClick={() => setDice(["⚀","⚁","⚂","⚃","⚄","⚅"][Math.floor(Math.random() * 6)])}>굴리기</button>
          </div>
          <div style={{ ...css.card, textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✊</div>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>묵찌빠</div>
            <button style={css.btn(C.purple)} onClick={() => setRps("컴퓨터: " + ["✊ 주먹","✌️ 가위","🖐️ 보"][Math.floor(Math.random() * 3)])}>도전</button>
            {rps && <p style={{ marginTop: 10, fontSize: 13, color: C.dim }}>{rps}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 커뮤니티 ─────────────────────────────────────────────────────────────────

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
    try { await postsAPI.create({ board: "blog", content: form.content, title: form.title }); setForm({ title: "", content: "" }); await loadBlog(); setToast("게시글이 발행되었습니다!"); } catch { /**/ }
    setSub(false);
  };

  const submitShort = async () => {
    if (!videoFile || !videoTitle.trim()) return;
    if (!isVideoFile(videoFile)) { setToast("mp4, mov, webm 파일만 업로드 가능합니다."); return; }
    setSub(true); setProg(`업로드 중... (${formatFileSize(videoFile.size)})`);
    try { await storageAPI.uploadShort(videoFile, videoTitle); setVF(null); setVT(""); await loadShorts(); setToast("숏폼이 업로드되었습니다!"); }
    catch (e) { setToast((e as Error).message); }
    setProg(null); setSub(false);
  };

  return (
    <div style={css.page}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: "1rem" }}>📝 커뮤니티</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        <button style={subTab === "blog"  ? css.btn()         : css.btnGhost()} onClick={() => setSubTab("blog")}>📄 블로그</button>
        <button style={subTab === "short" ? css.btn(C.purple) : css.btnGhost(C.purple)} onClick={() => setSubTab("short")}>📱 숏폼</button>
      </div>
      {subTab === "blog" && <>
        {auth.userId && (
          <div style={{ ...css.card, marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>✏️ 글 쓰기</h2>
            <Field label="제목"><input style={css.input} placeholder="제목" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
            <Field label="내용"><textarea style={{ ...css.input, minHeight: 90, resize: "vertical" }} placeholder="내용" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></Field>
            <button style={css.btn()} onClick={submitBlog} disabled={submitting}>{submitting ? "발행 중..." : "발행하기"}</button>
          </div>
        )}
        {loading ? <Spinner /> : posts.map(p => (
          <div key={p.id} style={css.postCard(C.purple)}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{p.title}</h3>
            <p style={{ fontSize: 13, color: C.dim, margin: "0 0 10px", lineHeight: 1.6 }}>{p.content.slice(0, 120)}{p.content.length > 120 ? "…" : ""}</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
              <span>❤️ {formatCount(p.likes)} · 👁 {formatCount(p.views)}</span>
              <span>{formatDate(p.created_at)}</span>
            </div>
          </div>
        ))}
      </>}
      {subTab === "short" && <>
        {auth.userId && (
          <div style={{ ...css.card, marginBottom: "1.5rem", borderColor: C.purple + "40" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: C.purple }}>📹 숏폼 올리기</h2>
            <Field label="제목"><input style={css.input} placeholder="영상 제목" value={videoTitle} onChange={e => setVT(e.target.value)} /></Field>
            <Field label="영상 파일 (mp4/mov/webm, 최대 100MB)">
              <input style={{ ...css.input, cursor: "pointer" }} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e => setVF(e.target.files?.[0] ?? null)} />
            </Field>
            {videoFile && <p style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>선택: {videoFile.name} ({formatFileSize(videoFile.size)})</p>}
            {progress  && <p style={{ fontSize: 12, color: C.yellow, marginBottom: 10 }}>{progress}</p>}
            <button style={css.btn(C.purple)} onClick={submitShort} disabled={submitting || !videoFile}>{submitting ? "업로드 중..." : "업로드"}</button>
          </div>
        )}
        {loading ? <Spinner /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
            {shorts.map(s => (
              <div key={s.id} style={{ ...css.card, padding: 0, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ background: "#141d2e", height: 190, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, position: "relative" }}>
                  📹
                  <div style={{ position: "absolute", bottom: 6, right: 8, background: "#0008", color: "#fff", fontSize: 11, borderRadius: 4, padding: "2px 6px" }}>숏폼</div>
                </div>
                <div style={{ padding: "0.65rem 0.9rem" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{s.title ?? "제목 없음"}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>👁 {formatCount(s.views)} · {formatDate(s.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>}
    </div>
  );
}

// ─── 앱 루트 ──────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]             = useState<TabId>("home");
  const [auth, setAuth]           = useState<AuthState>({ userId: null, email: null, profile: null, token: null });
  const [authLoading, setAuthLoad]= useState(true);

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

  if (authLoading) return <div style={{ ...css.app, display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>;

  const pages: Record<TabId, JSX.Element> = {
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
        <div style={css.logo}>🎋 우리학교</div>
        {TABS.map(t => <button key={t.id} style={css.tab(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
        {auth.userId && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingLeft: 8 }}>
            <span style={css.badge(C.green)}>
              {auth.profile ? `${auth.profile.grade}학년 ${auth.profile.class}반` : "로그인 중"}
              {auth.profile?.is_admin && " 👑"}
            </span>
          </div>
        )}
      </nav>
      {pages[tab]}
    </div>
  );
}
