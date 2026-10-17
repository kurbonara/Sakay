-- =============================================================================
-- Sakay: core schema, triggers, row-level security
-- -----------------------------------------------------------------------------
-- Rules of thumb used throughout:
--   * Every table has RLS enabled. anon/authenticated only get SELECT (filtered
--     by policies) plus a few whitelisted profile columns they may UPDATE.
--   * Every write that matters goes through a SECURITY DEFINER function
--     (see the next migration) with `set search_path = ''`.
--   * Counters people can see (votes, confirmations, answer counts, points) are
--     maintained by triggers so nobody can edit them directly.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('member', 'moderator', 'admin');
create type public.transport_mode as enum ('jeepney', 'bus', 'uv_express', 'tricycle', 'train', 'ferry', 'walk');
create type public.place_kind as enum ('landmark', 'mall', 'school', 'church', 'terminal', 'station', 'hospital', 'government', 'market', 'other');
create type public.route_status as enum ('pending', 'published', 'rejected', 'archived');
create type public.question_status as enum ('open', 'answered', 'merged', 'closed');
create type public.content_type as enum ('route', 'question', 'answer', 'comment', 'place');
create type public.report_reason as enum ('fare_changed', 'rerouted', 'terminal_closed', 'schedule_changed', 'wrong_info', 'spam', 'offensive', 'duplicate', 'other');
create type public.report_status as enum ('open', 'resolved', 'dismissed');
create type public.advisory_kind as enum ('road_closure', 'fare_change', 'strike', 'reroute', 'weather', 'event', 'other');
create type public.advisory_severity as enum ('info', 'warning', 'critical');
create type public.comment_kind as enum ('tip', 'comment');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  bio text check (char_length(bio) <= 280),
  home_area text check (char_length(home_area) <= 80),
  role public.user_role not null default 'member',
  is_banned boolean not null default false,
  points integer not null default 0,
  routes_published_count integer not null default 0,
  questions_count integer not null default 0,
  answers_count integer not null default 0,
  best_answers_count integer not null default 0,
  upvotes_received integer not null default 0,
  confirmations_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  aliases text[] not null default '{}',
  kind public.place_kind not null default 'landmark',
  city text check (char_length(city) <= 60),
  address text check (char_length(address) <= 200),
  description text check (char_length(description) <= 500),
  -- Rough bounding box of the Philippines, so typos don't put a stop in the ocean.
  lat double precision not null check (lat between 4 and 22),
  lng double precision not null check (lng between 116 and 127),
  modes public.transport_mode[] not null default '{}',
  -- Operating hours are local (Asia/Manila) wall-clock times.
  hours_open time,
  hours_close time,
  hours_note text check (char_length(hours_note) <= 120),
  is_verified boolean not null default false,
  search_text text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index places_search_trgm on public.places using gin (search_text extensions.gin_trgm_ops);
create index places_kind_idx on public.places (kind);
create index places_latlng_idx on public.places (lat, lng);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 5 and 140),
  summary text check (char_length(summary) <= 1000),
  origin_place_id uuid not null references public.places (id),
  destination_place_id uuid not null references public.places (id),
  status public.route_status not null default 'pending',
  is_sample boolean not null default false,
  operating_hours text check (char_length(operating_hours) <= 120),
  pwd_friendly boolean not null default false,
  senior_friendly boolean not null default false,
  heavy_load_friendly boolean not null default false,
  accessibility_notes text check (char_length(accessibility_notes) <= 500),
  submitted_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 500),
  published_at timestamptz,
  -- trigger-maintained
  total_fare numeric(8, 2) not null default 0,
  total_fare_discounted numeric(8, 2) not null default 0,
  total_minutes integer not null default 0,
  leg_count integer not null default 0,
  modes public.transport_mode[] not null default '{}',
  still_accurate_count integer not null default 0,
  outdated_count integer not null default 0,
  last_confirmed_at timestamptz,
  save_count integer not null default 0,
  comment_count integer not null default 0,
  open_report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_place_id <> destination_place_id)
);
create index routes_status_idx on public.routes (status);
create index routes_origin_idx on public.routes (origin_place_id);
create index routes_destination_idx on public.routes (destination_place_id);
create index routes_submitted_by_idx on public.routes (submitted_by);
create index routes_title_trgm on public.routes using gin (title extensions.gin_trgm_ops);

create table public.route_legs (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  seq smallint not null check (seq between 1 and 10),
  mode public.transport_mode not null,
  from_place_id uuid not null references public.places (id),
  to_place_id uuid not null references public.places (id),
  signboard text check (char_length(signboard) <= 120),
  instructions text check (char_length(instructions) <= 600),
  fare numeric(7, 2) not null default 0 check (fare between 0 and 5000),
  -- NULL means "use the standard 20% student/senior/PWD discount".
  fare_discounted numeric(7, 2) check (fare_discounted between 0 and 5000),
  minutes integer not null check (minutes between 1 and 600),
  path jsonb,
  unique (route_id, seq),
  check (from_place_id <> to_place_id)
);
create index route_legs_from_idx on public.route_legs (from_place_id);
create index route_legs_to_idx on public.route_legs (to_place_id);

create table public.route_confirmations (
  route_id uuid not null references public.routes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_accurate boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (route_id, user_id)
);

create table public.route_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, route_id)
);
create index route_saves_route_idx on public.route_saves (route_id);

create table public.route_comments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  kind public.comment_kind not null default 'tip',
  body text not null check (char_length(btrim(body)) between 2 and 1000),
  is_removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index route_comments_route_idx on public.route_comments (route_id, created_at desc);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 10 and 160),
  body text check (char_length(body) <= 2000),
  origin_place_id uuid references public.places (id) on delete set null,
  destination_place_id uuid references public.places (id) on delete set null,
  origin_text text check (char_length(origin_text) <= 120),
  destination_text text check (char_length(destination_text) <= 120),
  status public.question_status not null default 'open',
  best_answer_id uuid,
  merged_into_id uuid references public.questions (id) on delete set null,
  answer_count integer not null default 0,
  is_removed boolean not null default false,
  search tsvector,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merged_into_id is null or merged_into_id <> id)
);
create index questions_search_idx on public.questions using gin (search);
create index questions_title_trgm on public.questions using gin (title extensions.gin_trgm_ops);
create index questions_status_idx on public.questions (status, last_activity_at desc);
create index questions_places_idx on public.questions (origin_place_id, destination_place_id);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 2 and 3000),
  route_id uuid references public.routes (id) on delete set null,
  score integer not null default 0,
  is_best boolean not null default false,
  is_removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index answers_question_idx on public.answers (question_id);
create index answers_author_idx on public.answers (author_id);

alter table public.questions
  add constraint questions_best_answer_fk foreign key (best_answer_id) references public.answers (id) on delete set null;

create table public.answer_votes (
  answer_id uuid not null references public.answers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.content_type not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  reporter_id uuid references public.profiles (id) on delete set null,
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 500),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);
-- One open report per person per item.
create unique index reports_one_open_per_user on public.reports (reporter_id, target_type, target_id) where status = 'open';

create table public.search_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  origin_text text not null check (char_length(origin_text) <= 120),
  destination_text text not null check (char_length(destination_text) <= 120),
  origin_place_id uuid references public.places (id) on delete set null,
  destination_place_id uuid references public.places (id) on delete set null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index search_logs_created_idx on public.search_logs (created_at desc);
create index search_logs_user_idx on public.search_logs (user_id, created_at desc);

create table public.advisories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 5 and 140),
  body text check (char_length(body) <= 2000),
  kind public.advisory_kind not null default 'other',
  severity public.advisory_severity not null default 'info',
  area text check (char_length(area) <= 120),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index advisories_window_idx on public.advisories (starts_at, ends_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  success boolean not null default true,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Private helpers (not exposed through the API: PostgREST only serves `public`)
-- ---------------------------------------------------------------------------
create or replace function private.current_profile_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and not p.is_banned
$$;

create or replace function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.current_profile_role() in ('moderator', 'admin'), false)
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.current_profile_role() = 'admin', false)
$$;

-- Returns the caller's id, or raises a friendly error if signed out / suspended.
create or replace function private.require_member()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_banned boolean;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;
  select p.is_banned into v_banned from public.profiles p where p.id = v_uid;
  if v_banned is null then
    raise exception 'Your profile is still being set up. Please sign out and sign in again.' using errcode = 'P0001';
  end if;
  if v_banned then
    raise exception 'Your account is suspended. Contact the moderators if you think this is a mistake.' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

create or replace function private.log_action(
  p_action text, p_target_type text, p_target_id text, p_success boolean, p_details jsonb default '{}'
) returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, success, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_success, coalesce(p_details, '{}'));
$$;

-- Throws when the caller already did `p_max` of something within `p_window`.
create or replace function private.enforce_rate_limit(p_count bigint, p_max integer, p_what text)
returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_count >= p_max then
    raise exception 'You''re doing that too often (%). Please wait a bit and try again.', p_what using errcode = 'P0001';
  end if;
end;
$$;

-- Escape LIKE wildcards so user input is matched literally.
create or replace function private.escape_like(p text)
returns text
language sql immutable set search_path = ''
as $$
  select replace(replace(replace(coalesce(p, ''), '\', '\\'), '%', '\%'), '_', '\_')
$$;

create or replace function private.mask_email(p_email text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else left(split_part(p_email, '@', 1), 2) || '•••@' || split_part(p_email, '@', 2)
  end
$$;

-- Great-circle distance in metres.
create or replace function private.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable parallel safe set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- How long authors can still edit what they posted.
create or replace function private.edit_window()
returns interval
language sql immutable set search_path = ''
as $$ select interval '30 minutes' $$;

create or replace function private.add_points(p_user uuid, p_points integer, p_column text default null, p_delta integer default 0)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_user is null then return; end if;
  update public.profiles set
    points = points + p_points,
    routes_published_count = routes_published_count + case when p_column = 'routes_published_count' then p_delta else 0 end,
    questions_count = questions_count + case when p_column = 'questions_count' then p_delta else 0 end,
    answers_count = answers_count + case when p_column = 'answers_count' then p_delta else 0 end,
    best_answers_count = best_answers_count + case when p_column = 'best_answers_count' then p_delta else 0 end,
    upvotes_received = upvotes_received + case when p_column = 'upvotes_received' then p_delta else 0 end,
    confirmations_count = confirmations_count + case when p_column = 'confirmations_count' then p_delta else 0 end
  where id = p_user;
end;
$$;

create or replace function private.make_username(p_seed text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_base text := left(lower(regexp_replace(coalesce(p_seed, ''), '[^a-zA-Z0-9_]', '', 'g')), 18);
  v_candidate text;
  v_try integer := 0;
begin
  if char_length(v_base) < 3 then
    v_base := v_base || 'sakay';
  end if;
  v_candidate := v_base;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_try := v_try + 1;
    v_candidate := v_base || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 4 + (v_try / 5));
  end loop;
  return v_candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger places_touch before update on public.places for each row execute function private.touch_updated_at();
create trigger routes_touch before update on public.routes for each row execute function private.touch_updated_at();
create trigger route_comments_touch before update on public.route_comments for each row execute function private.touch_updated_at();
create trigger questions_touch before update on public.questions for each row execute function private.touch_updated_at();
create trigger answers_touch before update on public.answers for each row execute function private.touch_updated_at();
create trigger advisories_touch before update on public.advisories for each row execute function private.touch_updated_at();

-- New sign-ups get a profile automatically.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := private.make_username(coalesce(v_meta ->> 'username', split_part(new.email, '@', 1)));
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    v_username,
    left(coalesce(nullif(btrim(v_meta ->> 'display_name'), ''), nullif(btrim(v_meta ->> 'full_name'), ''), v_username), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Members can only change their own bio-type fields (column grants below), but
-- double-check here so a future grant mistake can't hand out roles or points.
create or replace function private.guard_profile_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role
      or new.is_banned is distinct from old.is_banned
      or new.points is distinct from old.points
      or new.routes_published_count is distinct from old.routes_published_count
      or new.questions_count is distinct from old.questions_count
      or new.answers_count is distinct from old.answers_count
      or new.best_answers_count is distinct from old.best_answers_count
      or new.upvotes_received is distinct from old.upvotes_received
      or new.confirmations_count is distinct from old.confirmations_count then
      raise exception 'You can only edit your name, username, bio and home area.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles for each row execute function private.guard_profile_update();

-- Places: keep a lowercase search string for fuzzy matching.
create or replace function private.places_search_text()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.search_text := lower(btrim(new.name || ' ' || array_to_string(new.aliases, ' ') || ' ' || coalesce(new.city, '')));
  return new;
end;
$$;
create trigger places_search before insert or update of name, aliases, city on public.places
  for each row execute function private.places_search_text();

-- Route totals follow the legs.
create or replace function private.recompute_route_totals(p_route uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.routes r set
    total_fare = coalesce(s.fare, 0),
    total_fare_discounted = coalesce(s.fare_d, 0),
    total_minutes = coalesce(s.minutes, 0),
    leg_count = coalesce(s.legs, 0),
    modes = coalesce(s.modes, '{}')
  from (
    select
      sum(l.fare) as fare,
      sum(coalesce(l.fare_discounted, round(l.fare * 0.8, 2))) as fare_d,
      sum(l.minutes)::integer as minutes,
      count(*)::integer as legs,
      array(select distinct l2.mode from public.route_legs l2 where l2.route_id = p_route order by l2.mode) as modes
    from public.route_legs l
    where l.route_id = p_route
  ) s
  where r.id = p_route;
$$;

create or replace function private.route_legs_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.recompute_route_totals(old.route_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.route_id <> old.route_id) then
    perform private.recompute_route_totals(new.route_id);
  end if;
  return null;
end;
$$;
create trigger route_legs_totals after insert or update or delete on public.route_legs
  for each row execute function private.route_legs_changed();

-- Publishing a route rewards its submitter and verifies the places it uses.
create or replace function private.route_status_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    perform private.add_points(new.submitted_by, 20, 'routes_published_count', 1);
    new.published_at := coalesce(new.published_at, now());
    update public.places set is_verified = true
      where not is_verified and id in (
        select from_place_id from public.route_legs where route_id = new.id
        union select to_place_id from public.route_legs where route_id = new.id
        union select new.origin_place_id union select new.destination_place_id
      );
  elsif old.status = 'published' and new.status <> 'published' then
    perform private.add_points(old.submitted_by, -20, 'routes_published_count', -1);
  end if;
  return new;
end;
$$;
create trigger routes_status before update of status on public.routes
  for each row execute function private.route_status_changed();

create or replace function private.route_published_on_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' then
    perform private.add_points(new.submitted_by, 20, 'routes_published_count', 1);
  end if;
  return null;
end;
$$;
create trigger routes_insert_points after insert on public.routes
  for each row execute function private.route_published_on_insert();

-- Confirmations ("still accurate" / "outdated").
create or replace function private.confirmations_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_route uuid := coalesce(new.route_id, old.route_id);
begin
  update public.routes r set
    still_accurate_count = (select count(*) from public.route_confirmations c where c.route_id = v_route and c.is_accurate),
    outdated_count = (select count(*) from public.route_confirmations c where c.route_id = v_route and not c.is_accurate),
    last_confirmed_at = case when tg_op <> 'DELETE' and new.is_accurate then now() else r.last_confirmed_at end
  where r.id = v_route;
  if tg_op = 'INSERT' then
    perform private.add_points(new.user_id, 1, 'confirmations_count', 1);
  elsif tg_op = 'DELETE' then
    perform private.add_points(old.user_id, -1, 'confirmations_count', -1);
  end if;
  return null;
end;
$$;
create trigger route_confirmations_counts after insert or update or delete on public.route_confirmations
  for each row execute function private.confirmations_changed();

create or replace function private.saves_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_route uuid := coalesce(new.route_id, old.route_id);
begin
  update public.routes set save_count = (select count(*) from public.route_saves s where s.route_id = v_route)
  where id = v_route;
  return null;
end;
$$;
create trigger route_saves_counts after insert or delete on public.route_saves
  for each row execute function private.saves_changed();

create or replace function private.comments_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_route uuid := coalesce(new.route_id, old.route_id);
begin
  update public.routes set comment_count = (
    select count(*) from public.route_comments c where c.route_id = v_route and not c.is_removed
  ) where id = v_route;
  return null;
end;
$$;
create trigger route_comments_counts after insert or update of is_removed or delete on public.route_comments
  for each row execute function private.comments_changed();

-- Questions: full-text search vector.
create or replace function private.questions_search()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.search :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.origin_text, '') || ' ' || coalesce(new.destination_text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.body, '')), 'B');
  return new;
end;
$$;
create trigger questions_search_trg before insert or update of title, body, origin_text, destination_text on public.questions
  for each row execute function private.questions_search();

create or replace function private.questions_points()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.add_points(new.author_id, 1, 'questions_count', 1);
  return null;
end;
$$;
create trigger questions_insert_points after insert on public.questions
  for each row execute function private.questions_points();

-- Recompute answer_count/status of a question.
create or replace function private.recompute_question(p_question uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.questions q set
    answer_count = s.cnt,
    status = case
      when q.status in ('merged', 'closed') then q.status
      when s.cnt > 0 then 'answered'::public.question_status
      else 'open'::public.question_status
    end,
    last_activity_at = greatest(q.last_activity_at, coalesce(s.latest, q.last_activity_at))
  from (
    select count(*) filter (where not a.is_removed)::integer as cnt, max(a.created_at) as latest
    from public.answers a where a.question_id = p_question
  ) s
  where q.id = p_question;
$$;

create or replace function private.answers_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.recompute_question(new.question_id);
    perform private.add_points(new.author_id, 2, 'answers_count', 1);
  elsif tg_op = 'UPDATE' then
    if new.question_id <> old.question_id then
      perform private.recompute_question(old.question_id);
    end if;
    perform private.recompute_question(new.question_id);
    if new.is_removed and not old.is_removed then
      perform private.add_points(new.author_id, -2 - 5 * greatest(new.score, 0), 'answers_count', -1);
    elsif old.is_removed and not new.is_removed then
      perform private.add_points(new.author_id, 2 + 5 * greatest(new.score, 0), 'answers_count', 1);
    end if;
    if new.is_best and not old.is_best then
      perform private.add_points(new.author_id, 15, 'best_answers_count', 1);
    elsif old.is_best and not new.is_best then
      perform private.add_points(new.author_id, -15, 'best_answers_count', -1);
    end if;
  elsif tg_op = 'DELETE' then
    perform private.recompute_question(old.question_id);
  end if;
  return null;
end;
$$;
create trigger answers_counts after insert or update or delete on public.answers
  for each row execute function private.answers_changed();

-- Votes keep answers.score and the author's points in sync.
create or replace function private.votes_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_answer uuid := coalesce(new.answer_id, old.answer_id);
  v_author uuid;
  v_old smallint := case when tg_op in ('UPDATE', 'DELETE') then old.value else 0 end;
  v_new smallint := case when tg_op in ('INSERT', 'UPDATE') then new.value else 0 end;
  v_up_delta integer;
begin
  update public.answers set score = coalesce((select sum(v.value) from public.answer_votes v where v.answer_id = v_answer), 0)
  where id = v_answer
  returning author_id into v_author;
  -- +5 per upvote received, -1 per downvote received.
  v_up_delta := (case when v_new = 1 then 1 else 0 end) - (case when v_old = 1 then 1 else 0 end);
  perform private.add_points(
    v_author,
    5 * v_up_delta - ((case when v_new = -1 then 1 else 0 end) - (case when v_old = -1 then 1 else 0 end)),
    'upvotes_received',
    v_up_delta
  );
  return null;
end;
$$;
create trigger answer_votes_counts after insert or update or delete on public.answer_votes
  for each row execute function private.votes_changed();

-- Open reports per route (shown as a warning on the route page).
create or replace function private.reports_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_type public.content_type := coalesce(new.target_type, old.target_type);
  v_target uuid := coalesce(new.target_id, old.target_id);
begin
  if v_type = 'route' then
    update public.routes set open_report_count = (
      select count(*) from public.reports r where r.target_type = 'route' and r.target_id = v_target and r.status = 'open'
    ) where id = v_target;
  end if;
  if tg_op = 'UPDATE' and new.status = 'resolved' and old.status = 'open' then
    perform private.add_points(new.reporter_id, 3);
  end if;
  return null;
end;
$$;
create trigger reports_counts after insert or update or delete on public.reports
  for each row execute function private.reports_changed();

-- Log role and ban changes no matter how they happen.
create or replace function private.profiles_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    perform private.log_action('profile.role_changed', 'profile', new.id::text, true,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.is_banned is distinct from old.is_banned then
    perform private.log_action(case when new.is_banned then 'profile.banned' else 'profile.unbanned' end,
      'profile', new.id::text, true, '{}');
  end if;
  return null;
end;
$$;
create trigger profiles_audit_trg after update of role, is_banned on public.profiles
  for each row execute function private.profiles_audit();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.routes enable row level security;
alter table public.route_legs enable row level security;
alter table public.route_confirmations enable row level security;
alter table public.route_saves enable row level security;
alter table public.route_comments enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.answer_votes enable row level security;
alter table public.reports enable row level security;
alter table public.search_logs enable row level security;
alter table public.advisories enable row level security;
alter table public.audit_log enable row level security;

create policy "Profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "Members edit their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Verified places are public; own and staff see the rest" on public.places
  for select to anon, authenticated
  using (is_verified or created_by = (select auth.uid()) or (select private.is_staff()));

create policy "Published routes are public; own and staff see the rest" on public.routes
  for select to anon, authenticated
  using (status = 'published' or submitted_by = (select auth.uid()) or (select private.is_staff()));

create policy "Legs follow their route" on public.route_legs
  for select to anon, authenticated
  using (exists (select 1 from public.routes r where r.id = route_id));

create policy "Own confirmations" on public.route_confirmations
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff()));

create policy "Own saves" on public.route_saves
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Visible comments" on public.route_comments
  for select to anon, authenticated
  using (
    (not is_removed and exists (select 1 from public.routes r where r.id = route_id))
    or author_id = (select auth.uid()) or (select private.is_staff())
  );

create policy "Visible questions" on public.questions
  for select to anon, authenticated
  using (not is_removed or author_id = (select auth.uid()) or (select private.is_staff()));

create policy "Visible answers" on public.answers
  for select to anon, authenticated
  using (
    (not is_removed and exists (select 1 from public.questions q where q.id = question_id))
    or author_id = (select auth.uid()) or (select private.is_staff())
  );

create policy "Own votes" on public.answer_votes
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Own reports; staff see all" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select private.is_staff()));

create policy "Own searches; staff see all" on public.search_logs
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff()));

-- Time-based rule enforced here: once an advisory ends, the public stops seeing it.
create policy "Current and upcoming advisories are public" on public.advisories
  for select to anon, authenticated
  using (ends_at is null or ends_at > now() or (select private.is_staff()));

create policy "Admins read the audit log" on public.audit_log
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Privileges: read through RLS, write only through functions.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant update (username, display_name, bio, home_area) on public.profiles to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.current_profile_role() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: people who signed up before this migration ran also get a profile.
-- (One row at a time so generated usernames stay unique.)
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
  v_username text;
begin
  for u in select id, email, raw_user_meta_data from auth.users order by created_at loop
    if not exists (select 1 from public.profiles where id = u.id) then
      v_username := private.make_username(coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)));
      insert into public.profiles (id, username, display_name)
      values (
        u.id,
        v_username,
        left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), v_username), 60)
      );
    end if;
  end loop;
end;
$$;
