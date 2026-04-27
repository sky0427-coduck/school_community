/**
 * utils.ts
 * 프론트엔드 공통 유틸 함수
 */

// ─────────────────────────────────────────────────────────────────────────────
// 해시
// ─────────────────────────────────────────────────────────────────────────────

export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ─────────────────────────────────────────────────────────────────────────────
// 유효성 검사
// ─────────────────────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidStudentId(id: string): boolean {
  return /^\d{8}$/.test(id);
}

export function isValidPassword(pw: string): boolean {
  return pw.length >= 8;
}

// ─────────────────────────────────────────────────────────────────────────────
// 날짜
// ─────────────────────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);

  if (min < 1)     return "방금 전";
  if (min < 60)    return `${min}분 전`;
  if (min < 1440)  return `${Math.floor(min / 60)}시간 전`;
  if (min < 10080) return `${Math.floor(min / 1440)}일 전`;

  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 숫자
// ─────────────────────────────────────────────────────────────────────────────

export function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  if (n >= 1_000)  return `${(n / 1_000).toFixed(1)}천`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// 파일
// ─────────────────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function isVideoFile(file: File): boolean {
  return ["video/mp4", "video/quicktime", "video/webm"].includes(file.type);
}

// ─────────────────────────────────────────────────────────────────────────────
// 로컬스토리지 (토큰 저장)
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_KEY   = "sc_access_token";
const REFRESH_KEY = "sc_refresh_token";

export const tokenStorage = {
  getAccess:  ()           => localStorage.getItem(TOKEN_KEY),
  setAccess:  (t: string)  => localStorage.setItem(TOKEN_KEY, t),
  getRefresh: ()           => localStorage.getItem(REFRESH_KEY),
  setRefresh: (t: string)  => localStorage.setItem(REFRESH_KEY, t),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 클립보드
// ─────────────────────────────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 욕설 필터
// ─────────────────────────────────────────────────────────────────────────────

const BANNED_WORDS: string[] = [];

export function containsBannedWord(text: string): boolean {
  return BANNED_WORDS.some(w => text.includes(w));
}
