/**
 * api.ts
 * 백엔드 REST API 클라이언트 + Socket.io 연결 관리
 */

import { io, Socket } from "socket.io-client";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:10000";

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────

export type Board = "bamboo" | "study" | "blog" | "short" | "free";

export interface Post {
  id:           number;
  board:        Board;
  author_id:    string | null;
  is_anonymous: boolean;
  title:        string | null;
  content:      string;
  subject:      string | null;
  likes:        number;
  views:        number;
  created_at:   string;
  updated_at:   string | null;
}

export interface ChatMessage {
  id:          number;
  room:        string;
  author_id:   string;
  author_name: string;
  content:     string;
  created_at:  string;
}

export interface Profile {
  id:         string;
  student_id: string;
  name_hash:  string;
  grade:      number;
  class:      number;
  is_admin:   boolean;
  ip_log:     string | null;
  created_at: string;
}

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  user: { id: string; email: string };
}

export interface Pagination {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

export interface PostsResponse {
  posts:      Post[];
  pagination: Pagination;
}

// ─────────────────────────────────────────────────────────────────────────────
// 토큰 관리
// ─────────────────────────────────────────────────────────────────────────────

let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io 클라이언트 싱글톤
// ─────────────────────────────────────────────────────────────────────────────

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(BASE_URL, {
      transports:          ["websocket", "polling"],
      autoConnect:         false,
      reconnection:        true,
      reconnectionDelay:   1000,
      reconnectionAttempts: 10,
    });

    _socket.on("connect", () => {
      console.log("✅ Socket.io 연결됨:", _socket?.id);
    });

    _socket.on("disconnect", (reason) => {
      console.log("❌ Socket.io 연결 끊김:", reason);
    });

    _socket.on("connect_error", (err) => {
      console.error("Socket.io 연결 오류:", err.message);
    });
  }
  return _socket;
}

/** 소켓 연결 시작 */
export function connectSocket(): void {
  const socket = getSocket();
  if (!socket.connected) socket.connect();
}

/** 소켓 연결 종료 */
export function disconnectSocket(): void {
  if (_socket?.connected) _socket.disconnect();
}

/** 채팅방 입장 */
export function joinRoom(room: string): void {
  const socket = getSocket();
  if (!socket.connected) socket.connect();
  socket.emit("join_room", room);
}

/** 채팅방 퇴장 */
export function leaveRoom(room: string): void {
  getSocket().emit("leave_room", room);
}

/** 메시지 전송 (Socket.io) */
export function sendSocketMessage(data: {
  room:       string;
  content:    string;
  authorName: string;
  userId:     string;
}): void {
  const socket = getSocket();
  if (!socket.connected) socket.connect();
  socket.emit("send_message", data);
}

/** 타이핑 이벤트 */
export function emitTyping(room: string, authorName: string): void {
  getSocket().emit("typing", { room, authorName });
}

/**
 * receive_message 이벤트 리스너 등록
 * @returns cleanup 함수
 */
export function onReceiveMessage(
  callback: (msg: ChatMessage) => void,
): () => void {
  const socket = getSocket();
  socket.on("receive_message", callback);
  return () => socket.off("receive_message", callback);
}

/**
 * user_typing 이벤트 리스너 등록
 * @returns cleanup 함수
 */
export function onUserTyping(
  callback: (data: { authorName: string }) => void,
): () => void {
  const socket = getSocket();
  socket.on("user_typing", callback);
  return () => socket.off("user_typing", callback);
}

/**
 * online_count 이벤트 리스너 등록
 * @returns cleanup 함수
 */
export function onOnlineCount(callback: (count: number) => void): () => void {
  const socket = getSocket();
  socket.on("online_count", callback);
  return () => socket.off("online_count", callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// REST fetch 래퍼
// ─────────────────────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error: string }).error ?? "API 오류");
  }

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (body: {
    email:     string;
    password:  string;
    studentId: string;
    nameHash:  string;
    grade:     number;
    class:     number;
  }) =>
    request<{ message: string }>("/api/auth/register", {
      method: "POST",
      body:   JSON.stringify(body),
    }),

  login: async (email: string, password: string): Promise<AuthTokens> => {
    const data = await request<AuthTokens>("/api/auth/login", {
      method: "POST",
      body:   JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  logout: () =>
    request<{ message: string }>("/api/auth/logout", { method: "POST" }),

  me: () => request<Profile>("/api/auth/me"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Posts API
// ─────────────────────────────────────────────────────────────────────────────

export const postsAPI = {
  list: (board: Board, page = 1, limit = 20) =>
    request<PostsResponse>(`/api/posts?board=${board}&page=${page}&limit=${limit}`),

  get: (id: number) =>
    request<Post>(`/api/posts/${id}`),

  create: (body: {
    board:        Board;
    content:      string;
    title?:       string;
    subject?:     string;
    isAnonymous?: boolean;
  }) =>
    request<Post>("/api/posts", { method: "POST", body: JSON.stringify(body) }),

  update: (id: number, body: { content?: string; title?: string }) =>
    request<Post>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (id: number) =>
    request<{ message: string }>(`/api/posts/${id}`, { method: "DELETE" }),

  like: (id: number) =>
    request<{ liked: boolean }>(`/api/posts/${id}/like`, { method: "POST" }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat API
// REST: 초기 메시지 로드 + DB 저장
// 실시간: Socket.io (sendSocketMessage / onReceiveMessage)
// ─────────────────────────────────────────────────────────────────────────────

export const chatAPI = {
  /** 이전 메시지 불러오기 (REST) */
  messages: (room: string, limit = 50) =>
    request<ChatMessage[]>(`/api/chat/messages?room=${encodeURIComponent(room)}&limit=${limit}`),

  /**
   * 메시지 전송
   * - Socket.io로 브로드캐스트 (실시간)
   * - REST로 DB 저장 (기록 보존)
   * 두 가지를 병렬로 실행
   */
  send: (room: string, content: string, authorName: string, userId: string): void => {
    // 1) Socket.io 실시간 브로드캐스트
    sendSocketMessage({ room, content, authorName, userId });

    // 2) REST DB 저장 (fire-and-forget — 실패해도 UI에 영향 없음)
    request<ChatMessage>("/api/chat/messages", {
      method: "POST",
      body:   JSON.stringify({ room, content, authorName }),
    }).catch((err: unknown) => {
      console.warn("채팅 DB 저장 실패:", err);
    });
  },

  delete: (id: number) =>
    request<{ message: string }>(`/api/chat/messages/${id}`, { method: "DELETE" }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage API (숏폼 업로드)
// ─────────────────────────────────────────────────────────────────────────────

export const storageAPI = {
  uploadShort: async (file: File, title: string): Promise<{ post: Post; url: string }> => {
    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);

    const headers: Record<string, string> = {};
    if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

    const res = await fetch(`${BASE_URL}/api/storage/shorts`, {
      method: "POST",
      headers,
      body:   formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((body as { error: string }).error ?? "업로드 실패");
    }

    return res.json() as Promise<{ post: Post; url: string }>;
  },

  deleteShort: (postId: number) =>
    request<{ message: string }>(`/api/storage/shorts/${postId}`, { method: "DELETE" }),
};

// ─────────────────────────────────────────────────────────────────────────────
// IP 로그 API (관리자 전용)
// ─────────────────────────────────────────────────────────────────────────────

export const ipLogsAPI = {
  byDate: (date: string) =>
    request<{ date: string; count: number; entries: unknown[] }>(`/api/ip-logs?date=${date}`),

  byUser: (userId: string) =>
    request<{ userId: string; count: number; entries: unknown[] }>(`/api/ip-logs/user/${userId}`),
};
