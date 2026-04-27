# 🎋 우리학교 커뮤니티

중학교 학생들을 위한 커뮤니티 플랫폼

---

## 📁 프로젝트 구조

```
school_community/
├── src/                        ← 프론트엔드 소스
│   ├── SchoolCommunity.tsx     ← 메인 앱 (9개 탭)
│   ├── api.ts                  ← 백엔드 API 클라이언트
│   ├── utils.ts                ← 유틸 함수
│   ├── main.tsx                ← 앱 진입점
│   └── index.css               ← 글로벌 스타일
│
├── backend/                    ← 백엔드 서버 (Ubuntu 배포)
│   ├── src/
│   │   ├── main.ts             ← Express 앱 진입점
│   │   ├── config/
│   │   │   ├── supabase.ts     ← Supabase 클라이언트
│   │   │   └── logger.ts       ← Winston 로거 (IP 로그)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── ipLogger.middleware.ts
│   │   └── modules/
│   │       ├── auth/           ← 회원가입, 로그인, 로그아웃
│   │       ├── posts/          ← 게시글 CRUD + 좋아요
│   │       ├── chat/           ← 채팅 메시지
│   │       ├── storage/        ← 숏폼 영상 업로드
│   │       └── ip-logger/      ← IP 로그 조회 (관리자)
│   └── logs/                   ← IP 로그 파일 저장소
│
├── .env.example                ← 프론트 환경변수 예시
├── vite.config.ts
└── index.html

⚠️  루트의 Api.ts, Utils.ts, Main.ts, SchoolCommunity.tsx 는
    src/ 폴더로 이동 완료 — 직접 삭제해주세요.
```

---

## 🚀 프론트엔드 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일 열어서 Supabase 키 + 백엔드 URL 입력

# 3. 개발 서버
npm run dev

# 4. 빌드 (GitHub Pages 배포용)
npm run build
```

---

## 🖥️ 백엔드 시작 (로컬 테스트)

```bash
cd backend

# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일 열어서 Supabase service_role 키 입력

# 3. 개발 서버
npm run dev

# 4. Ubuntu 서버 배포
npm run build
pm2 start dist/main.js --name school-api
```

---

## 🗄️ Supabase SQL 설정

Supabase 대시보드 → SQL Editor 에서 실행:

```sql
-- profiles 테이블
create table profiles (
  id         uuid references auth.users on delete cascade primary key,
  student_id text unique not null,
  name_hash  text not null,
  grade      smallint not null,
  class      smallint not null,
  is_admin   boolean default false,
  ip_log     text,
  created_at timestamptz default now()
);

-- posts 테이블
create table posts (
  id           bigserial primary key,
  board        text not null,
  author_id    uuid references profiles(id),
  is_anonymous boolean default false,
  title        text,
  content      text not null,
  subject      text,
  likes        int default 0,
  views        int default 0,
  updated_at   timestamptz,
  created_at   timestamptz default now()
);

-- messages 테이블
create table messages (
  id          bigserial primary key,
  room        text not null,
  author_id   uuid references profiles(id),
  author_name text not null,
  content     text not null,
  created_at  timestamptz default now()
);

-- post_likes 테이블 (중복 좋아요 방지)
create table post_likes (
  id      bigserial primary key,
  post_id bigint references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  unique(post_id, user_id)
);

-- RLS 활성화
alter table profiles  enable row level security;
alter table posts     enable row level security;
alter table messages  enable row level security;
alter table post_likes enable row level security;

-- RLS 정책
create policy "프로필 본인만"   on profiles   for all    using (auth.uid() = id);
create policy "게시글 전체읽기" on posts      for select using (true);
create policy "게시글 로그인작성" on posts    for insert with check (auth.uid() is not null);
create policy "채팅 전체읽기"   on messages   for select using (true);
create policy "채팅 로그인전송" on messages   for insert with check (auth.uid() is not null);
create policy "좋아요 본인"     on post_likes for all    using (auth.uid() = user_id);

-- 좋아요 함수
create or replace function increment_likes(post_id bigint)
returns void language sql as $$
  update posts set likes = likes + 1 where id = post_id;
$$;

create or replace function decrement_likes(post_id bigint)
returns void language sql as $$
  update posts set likes = greatest(0, likes - 1) where id = post_id;
$$;

-- Storage 버킷 (대시보드 Storage 탭에서도 가능)
insert into storage.buckets (id, name, public) values ('shorts', 'shorts', true);
create policy "숏폼 전체읽기" on storage.objects for select using (bucket_id = 'shorts');
create policy "숏폼 로그인업로드" on storage.objects for insert with check (bucket_id = 'shorts' and auth.uid() is not null);
```

---

## 🔑 GitHub Secrets (Actions 자동 배포)

레포 → Settings → Secrets → Actions:

| Key | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `VITE_API_URL` | `http://서버IP:3000` |

---

## ⚠️ 보안 주의사항

- `.env` 파일은 절대 커밋하지 마세요 (`.gitignore`에 포함됨)
- 백엔드 `SUPABASE_SERVICE_ROLE_KEY`는 절대 프론트에 노출 금지
- IP 로그 파일(`backend/logs/`)은 `.gitignore`에 포함됨
