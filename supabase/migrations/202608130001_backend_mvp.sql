create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text not null default 'Ученик',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  daily_goal integer not null default 30 check (daily_goal between 0 and 1000),
  notifications boolean not null default true,
  theme text not null default 'telegram' check (theme in ('telegram', 'light', 'dark')),
  accent text not null default 'blue' check (accent in ('blue', 'emerald', 'purple', 'rose', 'amber')),
  streak integer not null default 0,
  reviewed_total integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_lexemes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  word_ar text not null check (length(trim(word_ar)) > 0),
  translation text not null check (length(trim(translation)) > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_lexemes_user_id_idx on public.user_lexemes(user_id);

create table if not exists public.lexemes (
  id uuid primary key default gen_random_uuid(),
  word_ar text not null check (length(trim(word_ar)) > 0),
  word_ar_plain text not null check (length(trim(word_ar_plain)) > 0),
  pos text not null check (pos in ('noun', 'verb', 'particle')),
  translations text[] not null check (array_length(translations, 1) > 0),
  examples text[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lexemes_word_ar_plain_idx on public.lexemes(word_ar_plain);
create index if not exists lexemes_pos_idx on public.lexemes(pos);
create index if not exists lexemes_details_gin_idx on public.lexemes using gin(details);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  emoji text not null default '✨',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decks_user_id_idx on public.decks(user_id);

create table if not exists public.deck_lexemes (
  deck_id uuid not null references public.decks(id) on delete cascade,
  lexeme_source text not null check (lexeme_source in ('dictionary', 'user')),
  lexeme_id text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (deck_id, lexeme_source, lexeme_id)
);

create index if not exists deck_lexemes_deck_id_position_idx on public.deck_lexemes(deck_id, position);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mode text not null check (mode in ('review', 'study', 'flip', 'quiz')),
  lexeme_ids text[] not null default '{}',
  cursor integer not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_sessions_user_id_idx on public.training_sessions(user_id);

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  lexeme_id text not null,
  grade text not null check (grade in ('again', 'hard', 'easy')),
  reviewed_at timestamptz not null default now()
);

create index if not exists review_events_user_id_grade_idx on public.review_events(user_id, grade);
create index if not exists review_events_session_id_idx on public.review_events(session_id);

create table if not exists public.import_batches (
  user_id uuid not null references public.users(id) on delete cascade,
  import_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, import_key)
);
