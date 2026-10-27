-- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username extensions.citext unique not null check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_path text,
  bio text check (char_length(bio) <= 100),
  home_place_text text,
  home_location extensions.geography(Point, 4326),
  visibility public.profile_visibility not null default 'public',
  trust_level public.trust_level not null default 'new',
  is_business_affiliated boolean not null default false,
  affiliation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- places
create table public.places (
  id uuid primary key default gen_random_uuid(),
  source public.place_source not null,
  source_id text,
  name text not null,
  area text,
  city text not null,
  region text,
  country char(2) not null,
  location extensions.geography(Point, 4326) not null,
  category_ids text[] not null default '{}',
  created_by uuid references public.profiles on delete set null,
  merged_into_id uuid references public.places,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source = 'fsq') = (source_id is not null)),
  unique (source, source_id)
);
create index places_location_gist on public.places using gist (location);
create index places_name_trgm on public.places using gin (name extensions.gin_trgm_ops);
create trigger places_set_updated_at before update on public.places
  for each row execute function public.set_updated_at();

-- dishes
create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  name_key text not null,
  merged_into_id uuid references public.dishes,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index dishes_place_name_key_unique
  on public.dishes (place_id, name_key) where merged_into_id is null;
create index dishes_name_key_trgm on public.dishes using gin (name_key extensions.gin_trgm_ops);

create function public.dishes_set_name_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name_key = public.normalize_dish_name(new.name);
  return new;
end;
$$;
create trigger dishes_set_name_key before insert or update on public.dishes
  for each row execute function public.dishes_set_name_key();
create trigger dishes_set_updated_at before update on public.dishes
  for each row execute function public.set_updated_at();

-- picks
create table public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  dish_id uuid not null references public.dishes on delete restrict,
  tier public.pick_tier not null,
  slot smallint check (slot between 1 and 5),
  note text check (char_length(note) <= 280),
  photo_path text,
  original_dish_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((tier = 'final' and slot is not null) or (tier = 'honorable' and slot is null)),
  unique (user_id, dish_id)
);
create unique index picks_user_slot_unique on public.picks (user_id, slot) where tier = 'final';
create trigger picks_set_updated_at before update on public.picks
  for each row execute function public.set_updated_at();

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  kind public.tag_kind not null,
  name text not null check (char_length(name) between 1 and 40),
  slug text not null,
  owner_id uuid references public.profiles on delete cascade,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  check ((kind = 'personal') = (owner_id is not null))
);
create unique index tags_global_slug_unique on public.tags (kind, slug) where owner_id is null;
create unique index tags_owner_slug_unique on public.tags (owner_id, slug) where owner_id is not null;

-- pick_tags
create table public.pick_tags (
  pick_id uuid not null references public.picks on delete cascade,
  tag_id uuid not null references public.tags on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pick_id, tag_id)
);

-- security definer so the check sees every tag and pick regardless of the caller's RLS
create function public.pick_tags_check_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.tags t
    join public.picks p on p.id = new.pick_id
    where t.id = new.tag_id
      and t.kind = 'personal'
      and t.owner_id is distinct from p.user_id
  ) then
    raise exception 'personal_tag_not_owned';
  end if;
  return new;
end;
$$;
create trigger pick_tags_check_owner before insert or update on public.pick_tags
  for each row execute function public.pick_tags_check_owner();

-- Row-level security (policies arrive in a later migration)
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.dishes enable row level security;
alter table public.picks enable row level security;
alter table public.tags enable row level security;
alter table public.pick_tags enable row level security;
