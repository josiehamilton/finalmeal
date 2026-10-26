-- follows
create table public.follows (
  follower_id uuid not null references public.profiles on delete cascade,
  followee_id uuid not null references public.profiles on delete cascade,
  status public.follow_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- saves
create table public.saves (
  user_id uuid not null references public.profiles on delete cascade,
  dish_id uuid not null references public.dishes on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dish_id)
);

-- blocks
create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- shared_lists
create table public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  slug extensions.citext unique not null check (slug ~ '^[a-z0-9-]{3,60}$'),
  title text not null check (char_length(title) between 1 and 80),
  note text check (char_length(note) <= 280),
  filter jsonb not null default '{"scope":"everything"}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shared_lists_set_updated_at before update on public.shared_lists
  for each row execute function public.set_updated_at();

-- activities
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles on delete cascade,
  type public.activity_type not null,
  pick_id uuid references public.picks on delete cascade,
  other_pick_id uuid references public.picks on delete set null,
  list_id uuid references public.shared_lists on delete cascade,
  target_user_id uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);
create index activities_actor_created on public.activities (actor_id, created_at desc);

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created on public.notifications (user_id, created_at desc);

-- push_tokens
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  expo_token text unique not null,
  platform text check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);

-- device_attestations
create table public.device_attestations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  platform text not null,
  result text check (result in ('passed', 'failed', 'unsupported')),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

-- Row-level security (policies arrive in a later migration)
alter table public.follows enable row level security;
alter table public.saves enable row level security;
alter table public.blocks enable row level security;
alter table public.shared_lists enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.device_attestations enable row level security;
alter table public.reports enable row level security;
