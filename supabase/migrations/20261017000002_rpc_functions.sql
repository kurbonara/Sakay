-- =============================================================================
-- Sakay: RPC functions (the only way to write data)
-- -----------------------------------------------------------------------------
-- * Member actions raise a friendly exception on failure (nothing to log).
-- * Staff/sensitive actions RETURN {ok:false, error} instead of raising, so the
--   rejected attempt is still written to audit_log (a raise would roll it back).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Public reads
-- ---------------------------------------------------------------------------

-- Autocomplete for landmarks, stops and terminals.
create or replace function public.search_places(p_query text, p_limit integer default 8)
returns table (
  id uuid, name text, kind public.place_kind, city text, lat double precision, lng double precision,
  is_verified boolean, score real
)
language sql stable security definer set search_path = ''
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as t)
  select p.id, p.name, p.kind, p.city, p.lat, p.lng, p.is_verified,
    greatest(
      extensions.similarity(p.search_text, q.t),
      extensions.word_similarity(q.t, p.search_text),
      case when p.search_text like private.escape_like(q.t) || '%' then 1.0 else 0 end,
      case when p.search_text like '%' || private.escape_like(q.t) || '%' then 0.6 else 0 end
    )::real as score
  from public.places p, q
  where char_length(q.t) >= 2
    and (p.is_verified or p.created_by = auth.uid() or private.is_staff())
    and (
      p.search_text like '%' || private.escape_like(q.t) || '%'
      or extensions.word_similarity(q.t, p.search_text) > 0.45
    )
  order by score desc, p.is_verified desc, char_length(p.name)
  limit least(greatest(coalesce(p_limit, 8), 1), 20)
$$;

-- Origin-destination trip finder.
-- Chains legs from published routes (up to p_max_legs rides) and allows short
-- walking transfers (<= 500 m) between nearby stops, e.g. MRT -> LRT at Cubao.
create or replace function public.find_trips(
  p_origin uuid, p_destination uuid, p_max_legs integer default 4, p_limit integer default 8
) returns jsonb
language sql stable security definer set search_path = ''
as $$
with recursive
ends as (
  select o.lat as olat, o.lng as olng, d.lat as dlat, d.lng as dlng
  from public.places o, public.places d
  where o.id = p_origin and d.id = p_destination
),
stops as (
  select distinct p.id, p.lat, p.lng
  from public.places p
  join public.route_legs l on p.id in (l.from_place_id, l.to_place_id)
  join public.routes r on r.id = l.route_id and r.status = 'published'
),
origin_set as (
  select s.id, private.distance_m(s.lat, s.lng, e.olat, e.olng) as dist
  from stops s, ends e
  where abs(s.lat - e.olat) < 0.006 and abs(s.lng - e.olng) < 0.006
    and private.distance_m(s.lat, s.lng, e.olat, e.olng) <= 500
),
dest_set as (
  select s.id, private.distance_m(s.lat, s.lng, e.dlat, e.dlng) as dist
  from stops s, ends e
  where abs(s.lat - e.dlat) < 0.006 and abs(s.lng - e.dlng) < 0.006
    and private.distance_m(s.lat, s.lng, e.dlat, e.dlng) <= 500
),
hops as (
  select s.id as a_id, s.id as b_id, 0::double precision as dist from stops s
  union all
  select a.id, b.id, private.distance_m(a.lat, a.lng, b.lat, b.lng)
  from stops a join stops b
    on a.id <> b.id and abs(a.lat - b.lat) < 0.006 and abs(a.lng - b.lng) < 0.006
  where private.distance_m(a.lat, a.lng, b.lat, b.lng) <= 500
),
edges as (
  select distinct on (l.from_place_id, l.to_place_id, l.mode, coalesce(lower(l.signboard), ''))
    l.id as leg_id, l.from_place_id, l.to_place_id, l.fare::numeric as fare,
    coalesce(l.fare_discounted, round(l.fare * 0.8, 2))::numeric as fare_d, l.minutes
  from public.route_legs l
  join public.routes r on r.id = l.route_id and r.status = 'published'
  order by l.from_place_id, l.to_place_id, l.mode, coalesce(lower(l.signboard), ''),
    r.still_accurate_count - r.outdated_count desc, l.fare, l.minutes
),
trips (leg_ids, visited, last_place, depth, fare, fare_d, minutes, walk_m) as (
  select array[e.leg_id], array[e.from_place_id, e.to_place_id], e.to_place_id, 1,
    e.fare, e.fare_d, e.minutes + ceil(o.dist / 80)::integer, o.dist::double precision
  from edges e join origin_set o on o.id = e.from_place_id
  union all
  select t.leg_ids || e.leg_id, t.visited || e.to_place_id, e.to_place_id, t.depth + 1,
    t.fare + e.fare, t.fare_d + e.fare_d,
    -- walking time (80 m/min) plus ~5 min waiting at each transfer
    t.minutes + e.minutes + ceil(h.dist / 80)::integer + 5, t.walk_m + h.dist
  from trips t
  join hops h on h.a_id = t.last_place
  join edges e on e.from_place_id = h.b_id
  where t.depth < least(greatest(coalesce(p_max_legs, 4), 1), 5)
    and not (e.to_place_id = any (t.visited))
    and not exists (select 1 from dest_set d where d.id = t.last_place)
    and t.minutes < 360
),
found as (
  select t.*, t.minutes + ceil(d.dist / 80)::integer as total_minutes, t.walk_m + d.dist as total_walk
  from trips t join dest_set d on d.id = t.last_place
),
ranked as (
  select distinct on (f.leg_ids) f.*
  from found f
  order by f.leg_ids, f.total_minutes
),
best as (
  select * from ranked
  order by depth, total_minutes, fare
  limit least(greatest(coalesce(p_limit, 8), 1), 20)
)
select coalesce(jsonb_agg(trip order by (trip ->> 'transfers')::integer, (trip ->> 'minutes')::integer, (trip ->> 'fare')::numeric), '[]'::jsonb)
from (
  select jsonb_build_object(
    'fare', b.fare,
    'fare_discounted', b.fare_d,
    'minutes', b.total_minutes,
    'walk_m', round(b.total_walk)::integer,
    'transfers', b.depth - 1,
    'single_route_id', (
      select case when count(distinct l.route_id) = 1
        and count(*) = (select r.leg_count from public.routes r where r.id = min(l.route_id::text)::uuid)
        then min(l.route_id::text)::uuid end
      from public.route_legs l where l.id = any (b.leg_ids)
    ),
    'legs', (
      select jsonb_agg(jsonb_build_object(
        'leg_id', l.id, 'route_id', r.id, 'route_title', r.title, 'is_sample', r.is_sample,
        'still_accurate_count', r.still_accurate_count, 'outdated_count', r.outdated_count,
        'mode', l.mode, 'signboard', l.signboard, 'instructions', l.instructions,
        'fare', l.fare, 'fare_discounted', coalesce(l.fare_discounted, round(l.fare * 0.8, 2)),
        'minutes', l.minutes, 'path', l.path,
        'from', jsonb_build_object('id', fp.id, 'name', fp.name, 'lat', fp.lat, 'lng', fp.lng, 'kind', fp.kind),
        'to', jsonb_build_object('id', tp.id, 'name', tp.name, 'lat', tp.lat, 'lng', tp.lng, 'kind', tp.kind)
      ) order by x.ord)
      from unnest(b.leg_ids) with ordinality as x (leg_id, ord)
      join public.route_legs l on l.id = x.leg_id
      join public.routes r on r.id = l.route_id
      join public.places fp on fp.id = l.from_place_id
      join public.places tp on tp.id = l.to_place_id
    )
  ) as trip
  from best b
) s
$$;

-- Anyone may record a search (it powers analytics and "recent searches").
create or replace function public.log_search(
  p_origin_text text, p_destination_text text, p_origin uuid, p_destination uuid, p_result_count integer
) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_origin_text, ''))) < 2 or char_length(btrim(coalesce(p_destination_text, ''))) < 2 then
    return;
  end if;
  insert into public.search_logs (user_id, origin_text, destination_text, origin_place_id, destination_place_id, result_count)
  values (
    auth.uid(),
    left(btrim(p_origin_text), 120),
    left(btrim(p_destination_text), 120),
    (select id from public.places where id = p_origin),
    (select id from public.places where id = p_destination),
    greatest(coalesce(p_result_count, 0), 0)
  );
end;
$$;

-- Duplicate-question detection: answered threads and saved routes for the same trip.
create or replace function public.similar_questions(
  p_title text, p_origin uuid default null, p_destination uuid default null, p_limit integer default 5
) returns table (
  id uuid, title text, status public.question_status, answer_count integer, has_best_answer boolean,
  created_at timestamptz, score real
)
language sql stable security definer set search_path = ''
as $$
  select q.id, q.title, q.status, q.answer_count, q.best_answer_id is not null, q.created_at,
    (extensions.similarity(lower(q.title), lower(coalesce(p_title, '')))
      + case when p_origin is not null and q.origin_place_id = p_origin then 0.5 else 0 end
      + case when p_destination is not null and q.destination_place_id = p_destination then 0.5 else 0 end
      + case when q.answer_count > 0 then 0.1 else 0 end)::real as score
  from public.questions q
  where not q.is_removed
    and q.status <> 'merged'
    and (
      (char_length(btrim(coalesce(p_title, ''))) >= 6 and extensions.similarity(lower(q.title), lower(p_title)) > 0.25)
      or (p_origin is not null and p_destination is not null
          and q.origin_place_id = p_origin and q.destination_place_id = p_destination)
    )
  order by score desc, q.answer_count desc
  limit least(greatest(coalesce(p_limit, 5), 1), 10)
$$;

-- ---------------------------------------------------------------------------
-- Member actions
-- ---------------------------------------------------------------------------

create or replace function public.suggest_place(
  p_name text, p_kind public.place_kind, p_lat double precision, p_lng double precision,
  p_city text default null, p_address text default null
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_id uuid;
begin
  perform private.enforce_rate_limit(
    (select count(*) from public.places where created_by = v_uid and created_at > now() - interval '1 day'),
    30, 'new places per day');
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give the place a name (at least 2 characters).' using errcode = 'P0001';
  end if;
  insert into public.places (name, kind, lat, lng, city, address, created_by, is_verified)
  values (btrim(p_name), coalesce(p_kind, 'landmark'), p_lat, p_lng, nullif(btrim(p_city), ''), nullif(btrim(p_address), ''),
          v_uid, private.is_staff())
  returning id into v_id;
  return v_id;
end;
$$;

-- Validates and writes legs for a route (shared by submit and staff edit).
create or replace function private.write_route_legs(p_route uuid, p_legs jsonb, p_uid uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_leg jsonb;
  v_seq integer := 0;
  v_prev_to uuid;
  v_from uuid;
  v_to uuid;
begin
  if jsonb_typeof(p_legs) <> 'array' or jsonb_array_length(p_legs) < 1 then
    raise exception 'Add at least one ride (leg) to the route.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_legs) > 8 then
    raise exception 'A route can have at most 8 legs. Split very long trips into separate routes.' using errcode = 'P0001';
  end if;
  delete from public.route_legs where route_id = p_route;
  for v_leg in select * from jsonb_array_elements(p_legs) loop
    v_seq := v_seq + 1;
    v_from := nullif(v_leg ->> 'from_place_id', '')::uuid;
    v_to := nullif(v_leg ->> 'to_place_id', '')::uuid;
    if v_from is null or v_to is null then
      raise exception 'Leg %: choose both a pickup point and a drop-off point.', v_seq using errcode = 'P0001';
    end if;
    if v_from = v_to then
      raise exception 'Leg %: pickup and drop-off can''t be the same place.', v_seq using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.places p where p.id = v_from and (p.is_verified or p.created_by = p_uid or private.is_staff()))
      or not exists (select 1 from public.places p where p.id = v_to and (p.is_verified or p.created_by = p_uid or private.is_staff())) then
      raise exception 'Leg %: one of the places no longer exists. Pick it again from the list.', v_seq using errcode = 'P0001';
    end if;
    if v_prev_to is not null and v_prev_to <> v_from then
      raise exception 'Leg % must start where leg % ends. Add a "walk" leg if you transfer on foot.', v_seq, v_seq - 1 using errcode = 'P0001';
    end if;
    if coalesce((v_leg ->> 'minutes')::integer, 0) < 1 then
      raise exception 'Leg %: enter how many minutes the ride takes.', v_seq using errcode = 'P0001';
    end if;
    insert into public.route_legs (route_id, seq, mode, from_place_id, to_place_id, signboard, instructions, fare, fare_discounted, minutes, path)
    values (
      p_route, v_seq, (v_leg ->> 'mode')::public.transport_mode, v_from, v_to,
      nullif(btrim(v_leg ->> 'signboard'), ''), nullif(btrim(v_leg ->> 'instructions'), ''),
      coalesce(nullif(v_leg ->> 'fare', '')::numeric, 0), nullif(v_leg ->> 'fare_discounted', '')::numeric,
      (v_leg ->> 'minutes')::integer,
      case when jsonb_typeof(v_leg -> 'path') = 'array' then v_leg -> 'path' end
    );
    v_prev_to := v_to;
  end loop;
end;
$$;

create or replace function public.submit_route(p_route jsonb)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_staff boolean := private.is_staff();
  v_id uuid;
  v_legs jsonb := p_route -> 'legs';
begin
  perform private.enforce_rate_limit(
    (select count(*) from public.routes where submitted_by = v_uid and created_at > now() - interval '1 day'),
    10, 'route submissions per day');
  if jsonb_typeof(v_legs) <> 'array' or jsonb_array_length(v_legs) < 1 then
    raise exception 'Add at least one ride (leg) to the route.' using errcode = 'P0001';
  end if;

  insert into public.routes (
    title, summary, origin_place_id, destination_place_id, operating_hours,
    pwd_friendly, senior_friendly, heavy_load_friendly, accessibility_notes,
    submitted_by, status, reviewed_by, reviewed_at
  ) values (
    btrim(p_route ->> 'title'),
    nullif(btrim(p_route ->> 'summary'), ''),
    (v_legs -> 0 ->> 'from_place_id')::uuid,
    (v_legs -> (jsonb_array_length(v_legs) - 1) ->> 'to_place_id')::uuid,
    nullif(btrim(p_route ->> 'operating_hours'), ''),
    coalesce((p_route ->> 'pwd_friendly')::boolean, false),
    coalesce((p_route ->> 'senior_friendly')::boolean, false),
    coalesce((p_route ->> 'heavy_load_friendly')::boolean, false),
    nullif(btrim(p_route ->> 'accessibility_notes'), ''),
    v_uid, 'pending', null, null
  ) returning id into v_id;

  perform private.write_route_legs(v_id, v_legs, v_uid);

  -- Staff contributions skip the queue (still logged).
  if v_staff then
    update public.routes set status = 'published', reviewed_by = v_uid, reviewed_at = now() where id = v_id;
    perform private.log_action('route.published_by_staff', 'route', v_id::text, true, '{}');
  end if;
  return v_id;
exception
  when check_violation then
    raise exception 'Please check the route details: title must be 5-140 characters and fares/minutes must be reasonable numbers.' using errcode = 'P0001';
  when invalid_text_representation then
    raise exception 'One of the values isn''t valid (e.g. an unknown vehicle type). Please review the form.' using errcode = 'P0001';
end;
$$;

create or replace function public.confirm_route(p_route uuid, p_is_accurate boolean)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_row public.routes;
begin
  if not exists (select 1 from public.routes where id = p_route and status = 'published') then
    raise exception 'This route isn''t published, so it can''t be confirmed yet.' using errcode = 'P0001';
  end if;
  if p_is_accurate is null then
    delete from public.route_confirmations where route_id = p_route and user_id = v_uid;
  else
    insert into public.route_confirmations (route_id, user_id, is_accurate)
    values (p_route, v_uid, p_is_accurate)
    on conflict (route_id, user_id) do update set is_accurate = excluded.is_accurate, updated_at = now()
      where public.route_confirmations.is_accurate is distinct from excluded.is_accurate;
  end if;
  select * into v_row from public.routes where id = p_route;
  return jsonb_build_object('still_accurate_count', v_row.still_accurate_count, 'outdated_count', v_row.outdated_count, 'mine', p_is_accurate);
end;
$$;

create or replace function public.toggle_save_route(p_route uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
begin
  if exists (select 1 from public.route_saves where user_id = v_uid and route_id = p_route) then
    delete from public.route_saves where user_id = v_uid and route_id = p_route;
    return false;
  end if;
  if not exists (select 1 from public.routes where id = p_route and (status = 'published' or submitted_by = v_uid)) then
    raise exception 'That route isn''t available to save.' using errcode = 'P0001';
  end if;
  insert into public.route_saves (user_id, route_id) values (v_uid, p_route);
  return true;
end;
$$;

create or replace function public.add_route_comment(p_route uuid, p_kind public.comment_kind, p_body text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_id uuid;
begin
  perform private.enforce_rate_limit(
    (select count(*) from public.route_comments where author_id = v_uid and created_at > now() - interval '10 minutes'),
    10, 'comments in 10 minutes');
  if not exists (select 1 from public.routes where id = p_route and status = 'published') then
    raise exception 'You can only add tips to published routes.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 2 then
    raise exception 'Write a little more before posting.' using errcode = 'P0001';
  end if;
  insert into public.route_comments (route_id, author_id, kind, body)
  values (p_route, v_uid, coalesce(p_kind, 'tip'), left(btrim(p_body), 1000))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ask_question(
  p_title text, p_body text, p_origin uuid, p_destination uuid, p_origin_text text, p_destination_text text
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_id uuid;
begin
  perform private.enforce_rate_limit(
    (select count(*) from public.questions where author_id = v_uid and created_at > now() - interval '1 hour'),
    5, 'questions per hour');
  if char_length(btrim(coalesce(p_title, ''))) < 10 then
    raise exception 'Make the title a bit longer (at least 10 characters), e.g. "How to get from SM North to UP Diliman?"' using errcode = 'P0001';
  end if;
  insert into public.questions (author_id, title, body, origin_place_id, destination_place_id, origin_text, destination_text)
  values (
    v_uid, left(btrim(p_title), 160), nullif(left(btrim(coalesce(p_body, '')), 2000), ''),
    (select id from public.places where id = p_origin),
    (select id from public.places where id = p_destination),
    nullif(left(btrim(coalesce(p_origin_text, '')), 120), ''),
    nullif(left(btrim(coalesce(p_destination_text, '')), 120), '')
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.post_answer(p_question uuid, p_body text, p_route uuid default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_q public.questions;
  v_id uuid;
begin
  perform private.enforce_rate_limit(
    (select count(*) from public.answers where author_id = v_uid and created_at > now() - interval '10 minutes'),
    10, 'answers in 10 minutes');
  select * into v_q from public.questions where id = p_question;
  if v_q.id is null or v_q.is_removed then
    raise exception 'This question no longer exists.' using errcode = 'P0001';
  end if;
  if v_q.status = 'merged' then
    raise exception 'This question was merged into another thread. Please answer there instead.' using errcode = 'P0001';
  end if;
  if v_q.status = 'closed' then
    raise exception 'This question is closed to new answers.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 2 then
    raise exception 'Write a little more before posting.' using errcode = 'P0001';
  end if;
  insert into public.answers (question_id, author_id, body, route_id)
  values (p_question, v_uid, left(btrim(p_body), 3000),
          (select id from public.routes where id = p_route and status = 'published'))
  returning id into v_id;
  return v_id;
end;
$$;

-- p_value: 1 = upvote, -1 = downvote, 0 = remove my vote.
create or replace function public.vote_answer(p_answer uuid, p_value integer)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_author uuid;
  v_score integer;
begin
  select author_id into v_author from public.answers where id = p_answer and not is_removed;
  if not found then
    raise exception 'That answer is no longer available.' using errcode = 'P0001';
  end if;
  if v_author = v_uid then
    raise exception 'You can''t vote on your own answer.' using errcode = 'P0001';
  end if;
  if p_value not in (-1, 0, 1) then
    raise exception 'Invalid vote.' using errcode = 'P0001';
  end if;
  if p_value = 0 then
    delete from public.answer_votes where answer_id = p_answer and user_id = v_uid;
  else
    insert into public.answer_votes (answer_id, user_id, value) values (p_answer, v_uid, p_value)
    on conflict (answer_id, user_id) do update set value = excluded.value
      where public.answer_votes.value <> excluded.value;
  end if;
  select score into v_score from public.answers where id = p_answer;
  return v_score;
end;
$$;

-- Authors may edit for 30 minutes after posting. The deadline is checked here,
-- at commit time, so a form opened at 0:29 and submitted at 0:31 is rejected.
create or replace function public.edit_own_content(p_type public.content_type, p_id uuid, p_body text, p_title text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_author uuid;
  v_created timestamptz;
begin
  if p_type = 'question' then
    select author_id, created_at into v_author, v_created from public.questions where id = p_id and not is_removed;
  elsif p_type = 'answer' then
    select author_id, created_at into v_author, v_created from public.answers where id = p_id and not is_removed;
  elsif p_type = 'comment' then
    select author_id, created_at into v_author, v_created from public.route_comments where id = p_id and not is_removed;
  else
    raise exception 'That can''t be edited here.' using errcode = 'P0001';
  end if;
  if v_author is null or v_author <> v_uid then
    raise exception 'You can only edit your own posts.' using errcode = 'P0001';
  end if;
  if now() > v_created + private.edit_window() then
    raise exception 'The 30-minute edit window has closed. Post a follow-up instead.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 2 and p_type <> 'question' then
    raise exception 'Write a little more before saving.' using errcode = 'P0001';
  end if;
  if p_type = 'question' then
    if char_length(btrim(coalesce(p_title, ''))) < 10 then
      raise exception 'Make the title at least 10 characters.' using errcode = 'P0001';
    end if;
    update public.questions set title = left(btrim(p_title), 160), body = nullif(left(btrim(coalesce(p_body, '')), 2000), '') where id = p_id;
  elsif p_type = 'answer' then
    update public.answers set body = left(btrim(p_body), 3000) where id = p_id;
  else
    update public.route_comments set body = left(btrim(p_body), 1000) where id = p_id;
  end if;
end;
$$;

-- Authors can always take down their own post.
create or replace function public.delete_own_content(p_type public.content_type, p_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_count integer;
begin
  if p_type = 'question' then
    update public.questions set is_removed = true where id = p_id and author_id = v_uid;
  elsif p_type = 'answer' then
    update public.answers set is_removed = true where id = p_id and author_id = v_uid and not is_best;
  elsif p_type = 'comment' then
    update public.route_comments set is_removed = true where id = p_id and author_id = v_uid;
  else
    raise exception 'That can''t be deleted here.' using errcode = 'P0001';
  end if;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'You can only delete your own posts (best answers stay up).' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.create_report(
  p_type public.content_type, p_target uuid, p_reason public.report_reason, p_details text default null
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_id uuid;
  v_exists boolean;
begin
  perform private.enforce_rate_limit(
    (select count(*) from public.reports where reporter_id = v_uid and created_at > now() - interval '1 day'),
    20, 'reports per day');
  v_exists := case p_type
    when 'route' then exists (select 1 from public.routes where id = p_target and status = 'published')
    when 'question' then exists (select 1 from public.questions where id = p_target and not is_removed)
    when 'answer' then exists (select 1 from public.answers where id = p_target and not is_removed)
    when 'comment' then exists (select 1 from public.route_comments where id = p_target and not is_removed)
    when 'place' then exists (select 1 from public.places where id = p_target and is_verified)
  end;
  if not coalesce(v_exists, false) then
    raise exception 'That item no longer exists.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reports where reporter_id = v_uid and target_type = p_type and target_id = p_target and status = 'open') then
    raise exception 'You already reported this. Moderators will review it soon - thank you!' using errcode = 'P0001';
  end if;
  insert into public.reports (target_type, target_id, reason, details, reporter_id)
  values (p_type, p_target, p_reason, nullif(left(btrim(coalesce(p_details, '')), 1000), ''), v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

-- Question author (or staff) picks the best answer. Sensitive: logged.
create or replace function public.mark_best_answer(p_answer uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a public.answers;
  v_q public.questions;
begin
  select * into v_a from public.answers where id = p_answer and not is_removed;
  if v_a.id is null then
    return jsonb_build_object('ok', false, 'error', 'That answer is no longer available.');
  end if;
  select * into v_q from public.questions where id = v_a.question_id;
  if v_uid is null or not (v_q.author_id = v_uid or private.is_staff())
     or exists (select 1 from public.profiles where id = v_uid and is_banned) then
    perform private.log_action('answer.mark_best', 'answer', p_answer::text, false, jsonb_build_object('reason', 'not allowed'));
    return jsonb_build_object('ok', false, 'error', 'Only the person who asked (or a moderator) can choose the best answer.');
  end if;
  update public.answers set is_best = false where question_id = v_q.id and is_best and id <> p_answer;
  update public.answers set is_best = not is_best where id = p_answer;
  update public.questions set best_answer_id = case when best_answer_id = p_answer then null else p_answer end where id = v_q.id;
  perform private.log_action('answer.mark_best', 'answer', p_answer::text, true, jsonb_build_object('question', v_q.id));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff (moderator/admin) actions
-- ---------------------------------------------------------------------------
create or replace function private.deny(p_action text, p_type text, p_id text, p_message text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform private.log_action(p_action, p_type, p_id, false, jsonb_build_object('reason', 'not staff'));
  return jsonb_build_object('ok', false, 'error', coalesce(p_message, 'Only moderators can do that.'));
end;
$$;

create or replace function public.moderate_route(p_route uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_status public.route_status;
  v_old public.route_status;
begin
  if not private.is_staff() then
    return private.deny('route.moderate', 'route', p_route::text);
  end if;
  v_status := case p_decision when 'publish' then 'published' when 'reject' then 'rejected' when 'archive' then 'archived'
                              when 'pending' then 'pending' end;
  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'Unknown decision.');
  end if;
  select status into v_old from public.routes where id = p_route for update;
  if v_old is null then
    return jsonb_build_object('ok', false, 'error', 'That route no longer exists.');
  end if;
  if v_status = 'rejected' and char_length(btrim(coalesce(p_note, ''))) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Add a short note so the contributor knows what to fix.');
  end if;
  update public.routes set status = v_status, reviewed_by = auth.uid(), reviewed_at = now(),
    review_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  where id = p_route;
  perform private.log_action('route.' || p_decision, 'route', p_route::text, true,
    jsonb_build_object('from', v_old, 'to', v_status, 'note', p_note));
  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

create or replace function public.admin_update_route(p_route_id uuid, p_route jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_legs jsonb := p_route -> 'legs';
begin
  if not private.is_staff() then
    return private.deny('route.edit', 'route', p_route_id::text);
  end if;
  if not exists (select 1 from public.routes where id = p_route_id) then
    return jsonb_build_object('ok', false, 'error', 'That route no longer exists.');
  end if;
  begin
    perform private.write_route_legs(p_route_id, v_legs, auth.uid());
    update public.routes set
      title = btrim(p_route ->> 'title'),
      summary = nullif(btrim(p_route ->> 'summary'), ''),
      origin_place_id = (v_legs -> 0 ->> 'from_place_id')::uuid,
      destination_place_id = (v_legs -> (jsonb_array_length(v_legs) - 1) ->> 'to_place_id')::uuid,
      operating_hours = nullif(btrim(p_route ->> 'operating_hours'), ''),
      pwd_friendly = coalesce((p_route ->> 'pwd_friendly')::boolean, false),
      senior_friendly = coalesce((p_route ->> 'senior_friendly')::boolean, false),
      heavy_load_friendly = coalesce((p_route ->> 'heavy_load_friendly')::boolean, false),
      accessibility_notes = nullif(btrim(p_route ->> 'accessibility_notes'), ''),
      is_sample = false
    where id = p_route_id;
  exception
    when raise_exception then
      return jsonb_build_object('ok', false, 'error', sqlerrm);
    when check_violation then
      return jsonb_build_object('ok', false, 'error', 'Please check the details: title 5-140 characters, fares and minutes within range.');
  end;
  perform private.log_action('route.edit', 'route', p_route_id::text, true, '{}');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.resolve_report(p_report uuid, p_status public.report_status, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_staff() then
    return private.deny('report.resolve', 'report', p_report::text);
  end if;
  if p_status = 'open' then
    update public.reports set status = 'open', resolved_by = null, resolved_at = null where id = p_report;
  else
    update public.reports set status = p_status, resolved_by = auth.uid(), resolved_at = now(),
      resolution_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
    where id = p_report and status = 'open';
    if not found then
      return jsonb_build_object('ok', false, 'error', 'This report was already handled by someone else. Refresh to see the latest.');
    end if;
  end if;
  perform private.log_action('report.' || p_status, 'report', p_report::text, true, jsonb_build_object('note', p_note));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_content_removed(p_type public.content_type, p_id uuid, p_removed boolean, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_staff() then
    return private.deny('content.remove', p_type::text, p_id::text);
  end if;
  if p_type = 'question' then
    update public.questions set is_removed = p_removed where id = p_id;
  elsif p_type = 'answer' then
    update public.answers set is_removed = p_removed, is_best = case when p_removed then false else is_best end where id = p_id;
    if p_removed then
      update public.questions set best_answer_id = null where best_answer_id = p_id;
    end if;
  elsif p_type = 'comment' then
    update public.route_comments set is_removed = p_removed where id = p_id;
  elsif p_type = 'route' then
    update public.routes set status = case when p_removed then 'archived'::public.route_status else 'published'::public.route_status end,
      reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  elsif p_type = 'place' then
    update public.places set is_verified = not p_removed where id = p_id;
  end if;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'That item no longer exists.');
  end if;
  perform private.log_action(case when p_removed then 'content.remove' else 'content.restore' end,
    p_type::text, p_id::text, true, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.merge_question(p_source uuid, p_target uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_target public.questions;
begin
  if not private.is_staff() then
    return private.deny('question.merge', 'question', p_source::text);
  end if;
  if p_source = p_target then
    return jsonb_build_object('ok', false, 'error', 'Pick a different question to merge into.');
  end if;
  select * into v_target from public.questions where id = p_target and not is_removed;
  if v_target.id is null or v_target.status = 'merged' then
    return jsonb_build_object('ok', false, 'error', 'The target question must be an active (not merged) thread.');
  end if;
  if not exists (select 1 from public.questions where id = p_source and status <> 'merged') then
    return jsonb_build_object('ok', false, 'error', 'That question was already merged or no longer exists.');
  end if;
  -- Move answers over; a moved "best answer" is no longer best in the new thread.
  update public.answers set is_best = false where question_id = p_source and is_best;
  update public.questions set best_answer_id = null where id = p_source;
  update public.answers set question_id = p_target where question_id = p_source;
  update public.questions set status = 'merged', merged_into_id = p_target, answer_count = 0 where id = p_source;
  perform private.recompute_question(p_target);
  perform private.log_action('question.merge', 'question', p_source::text, true, jsonb_build_object('into', p_target));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_question_closed(p_question uuid, p_closed boolean)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_staff() then
    return private.deny('question.close', 'question', p_question::text);
  end if;
  update public.questions set status = case when p_closed then 'closed'::public.question_status else 'open'::public.question_status end
  where id = p_question and status <> 'merged';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That question can''t be changed (it may be merged).');
  end if;
  if not p_closed then
    perform private.recompute_question(p_question);
  end if;
  perform private.log_action(case when p_closed then 'question.close' else 'question.reopen' end, 'question', p_question::text, true, '{}');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.upsert_place(p_place jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid := nullif(p_place ->> 'id', '')::uuid;
begin
  if not private.is_staff() then
    return private.deny('place.upsert', 'place', coalesce(v_id::text, 'new'));
  end if;
  begin
    if v_id is null then
      insert into public.places (name, aliases, kind, city, address, description, lat, lng, modes, hours_open, hours_close, hours_note, is_verified, created_by)
      values (
        btrim(p_place ->> 'name'),
        coalesce(array(select btrim(x) from jsonb_array_elements_text(coalesce(p_place -> 'aliases', '[]')) x where btrim(x) <> ''), '{}'),
        coalesce((p_place ->> 'kind')::public.place_kind, 'landmark'),
        nullif(btrim(p_place ->> 'city'), ''), nullif(btrim(p_place ->> 'address'), ''), nullif(btrim(p_place ->> 'description'), ''),
        (p_place ->> 'lat')::double precision, (p_place ->> 'lng')::double precision,
        coalesce(array(select x::public.transport_mode from jsonb_array_elements_text(coalesce(p_place -> 'modes', '[]')) x), '{}'),
        nullif(p_place ->> 'hours_open', '')::time, nullif(p_place ->> 'hours_close', '')::time,
        nullif(btrim(p_place ->> 'hours_note'), ''),
        coalesce((p_place ->> 'is_verified')::boolean, true), auth.uid()
      ) returning id into v_id;
    else
      update public.places set
        name = btrim(p_place ->> 'name'),
        aliases = coalesce(array(select btrim(x) from jsonb_array_elements_text(coalesce(p_place -> 'aliases', '[]')) x where btrim(x) <> ''), '{}'),
        kind = coalesce((p_place ->> 'kind')::public.place_kind, kind),
        city = nullif(btrim(p_place ->> 'city'), ''), address = nullif(btrim(p_place ->> 'address'), ''),
        description = nullif(btrim(p_place ->> 'description'), ''),
        lat = (p_place ->> 'lat')::double precision, lng = (p_place ->> 'lng')::double precision,
        modes = coalesce(array(select x::public.transport_mode from jsonb_array_elements_text(coalesce(p_place -> 'modes', '[]')) x), '{}'),
        hours_open = nullif(p_place ->> 'hours_open', '')::time, hours_close = nullif(p_place ->> 'hours_close', '')::time,
        hours_note = nullif(btrim(p_place ->> 'hours_note'), ''),
        is_verified = coalesce((p_place ->> 'is_verified')::boolean, is_verified)
      where id = v_id;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'That place no longer exists.');
      end if;
    end if;
  exception
    when check_violation or not_null_violation then
      return jsonb_build_object('ok', false, 'error', 'Check the name (2-120 characters) and the map pin (must be inside the Philippines).');
    when invalid_text_representation or invalid_datetime_format then
      return jsonb_build_object('ok', false, 'error', 'One of the values (hours, kind or vehicle type) isn''t valid.');
  end;
  perform private.log_action('place.upsert', 'place', v_id::text, true, jsonb_build_object('name', p_place ->> 'name'));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.upsert_advisory(p_advisory jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid := nullif(p_advisory ->> 'id', '')::uuid;
begin
  if not private.is_staff() then
    return private.deny('advisory.upsert', 'advisory', coalesce(v_id::text, 'new'));
  end if;
  begin
    if v_id is null then
      insert into public.advisories (title, body, kind, severity, area, starts_at, ends_at, created_by)
      values (
        btrim(p_advisory ->> 'title'), nullif(btrim(p_advisory ->> 'body'), ''),
        coalesce((p_advisory ->> 'kind')::public.advisory_kind, 'other'),
        coalesce((p_advisory ->> 'severity')::public.advisory_severity, 'info'),
        nullif(btrim(p_advisory ->> 'area'), ''),
        coalesce(nullif(p_advisory ->> 'starts_at', '')::timestamptz, now()),
        nullif(p_advisory ->> 'ends_at', '')::timestamptz,
        auth.uid()
      ) returning id into v_id;
    else
      update public.advisories set
        title = btrim(p_advisory ->> 'title'), body = nullif(btrim(p_advisory ->> 'body'), ''),
        kind = coalesce((p_advisory ->> 'kind')::public.advisory_kind, kind),
        severity = coalesce((p_advisory ->> 'severity')::public.advisory_severity, severity),
        area = nullif(btrim(p_advisory ->> 'area'), ''),
        starts_at = coalesce(nullif(p_advisory ->> 'starts_at', '')::timestamptz, starts_at),
        ends_at = nullif(p_advisory ->> 'ends_at', '')::timestamptz
      where id = v_id;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'That advisory no longer exists.');
      end if;
    end if;
  exception
    when check_violation or not_null_violation then
      return jsonb_build_object('ok', false, 'error', 'Check the title (5-140 characters) and make sure the end time is after the start time.');
    when invalid_text_representation or invalid_datetime_format then
      return jsonb_build_object('ok', false, 'error', 'One of the dates or options isn''t valid.');
  end;
  perform private.log_action('advisory.upsert', 'advisory', v_id::text, true, jsonb_build_object('title', p_advisory ->> 'title'));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.delete_advisory(p_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_staff() then
    return private.deny('advisory.delete', 'advisory', p_id::text);
  end if;
  delete from public.advisories where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That advisory was already deleted.');
  end if;
  perform private.log_action('advisory.delete', 'advisory', p_id::text, true, '{}');
  return jsonb_build_object('ok', true);
end;
$$;

-- Suspend/restore a member. Moderators can't suspend staff; only admins can.
create or replace function public.set_user_banned(p_user uuid, p_banned boolean)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_target_role public.user_role;
begin
  if not private.is_staff() then
    return private.deny('profile.ban', 'profile', p_user::text);
  end if;
  select role into v_target_role from public.profiles where id = p_user;
  if v_target_role is null then
    return jsonb_build_object('ok', false, 'error', 'That member no longer exists.');
  end if;
  if p_user = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'You can''t suspend yourself.');
  end if;
  if v_target_role <> 'member' and not private.is_admin() then
    return private.deny('profile.ban', 'profile', p_user::text, 'Only admins can suspend moderators or admins.');
  end if;
  update public.profiles set is_banned = p_banned where id = p_user;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_user_role(p_user uuid, p_role public.user_role)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    return private.deny('profile.set_role', 'profile', p_user::text, 'Only admins can change roles.');
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'You can''t remove your own admin role. Ask another admin.');
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That member no longer exists.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Admin-only member search: 2+ characters, LIKE wildcards escaped, max 8 rows,
-- emails masked (ku•••@gmail.com).
create or replace function public.search_users(p_query text)
returns table (
  id uuid, username text, display_name text, role public.user_role, is_banned boolean,
  points integer, email_masked text, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_pattern text;
begin
  if not private.is_admin() then
    raise exception 'Only admins can search members.' using errcode = '42501';
  end if;
  if char_length(v_q) < 2 then
    raise exception 'Type at least 2 characters to search.' using errcode = 'P0001';
  end if;
  v_pattern := '%' || private.escape_like(lower(v_q)) || '%';
  return query
    select p.id, p.username, p.display_name, p.role, p.is_banned, p.points, private.mask_email(u.email::text), p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(p.username) like v_pattern
       or lower(p.display_name) like v_pattern
       or lower(u.email::text) like v_pattern
    order by (lower(p.username) = lower(v_q)) desc, p.points desc
    limit 8;
end;
$$;

-- Dashboard numbers for staff.
create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'Only moderators can view this.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pending_routes', (select count(*) from public.routes where status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'unanswered_questions', (select count(*) from public.questions where status = 'open' and not is_removed),
    'published_routes', (select count(*) from public.routes where status = 'published'),
    'members', (select count(*) from public.profiles),
    'searches_7d', (select count(*) from public.search_logs where created_at > now() - interval '7 days'),
    'zero_result_searches_7d', (select count(*) from public.search_logs where created_at > now() - interval '7 days' and result_count = 0),
    'active_advisories', (select count(*) from public.advisories where starts_at <= now() and (ends_at is null or ends_at > now()))
  );
end;
$$;

create or replace function public.admin_analytics(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  if not private.is_staff() then
    raise exception 'Only moderators can view analytics.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', least(greatest(coalesce(p_days, 30), 1), 365),
    'top_searches', coalesce((
      select jsonb_agg(t order by t.searches desc) from (
        select lower(s.origin_text) as origin, lower(s.destination_text) as destination,
          count(*)::integer as searches, round(avg(s.result_count), 1) as avg_results,
          max(s.created_at) as last_searched
        from public.search_logs s where s.created_at >= v_since
        group by 1, 2 order by count(*) desc limit 15
      ) t), '[]'::jsonb),
    'missing_routes', coalesce((
      select jsonb_agg(t order by t.searches desc) from (
        select lower(s.origin_text) as origin, lower(s.destination_text) as destination,
          count(*)::integer as searches, max(s.created_at) as last_searched
        from public.search_logs s where s.created_at >= v_since and s.result_count = 0
        group by 1, 2 order by count(*) desc limit 15
      ) t), '[]'::jsonb),
    'asked_areas', coalesce((
      select jsonb_agg(t order by t.questions desc) from (
        select area, count(*)::integer as questions,
          count(*) filter (where status = 'open')::integer as unanswered
        from (
          select coalesce(op.name, nullif(lower(q.origin_text), ''), 'Unspecified') as area, q.status
          from public.questions q left join public.places op on op.id = q.origin_place_id
          where q.created_at >= v_since and not q.is_removed
          union all
          select coalesce(dp.name, nullif(lower(q.destination_text), ''), 'Unspecified'), q.status
          from public.questions q left join public.places dp on dp.id = q.destination_place_id
          where q.created_at >= v_since and not q.is_removed
        ) x
        group by area order by count(*) desc limit 15
      ) t), '[]'::jsonb),
    'unanswered', coalesce((
      select jsonb_agg(t order by t.created_at) from (
        select q.id, q.title, q.created_at, q.origin_text, q.destination_text
        from public.questions q
        where q.status = 'open' and not q.is_removed
        order by q.created_at limit 20
      ) t), '[]'::jsonb),
    'totals', jsonb_build_object(
      'searches', (select count(*) from public.search_logs where created_at >= v_since),
      'zero_result_searches', (select count(*) from public.search_logs where created_at >= v_since and result_count = 0),
      'questions', (select count(*) from public.questions where created_at >= v_since and not is_removed),
      'answers', (select count(*) from public.answers where created_at >= v_since and not is_removed),
      'routes_submitted', (select count(*) from public.routes where created_at >= v_since),
      'routes_published', (select count(*) from public.routes where published_at >= v_since)
    ),
    'searches_by_day', coalesce((
      select jsonb_agg(t order by t.day) from (
        select (s.created_at at time zone 'Asia/Manila')::date as day, count(*)::integer as searches,
          count(*) filter (where s.result_count = 0)::integer as zero_results
        from public.search_logs s where s.created_at >= v_since group by 1
      ) t), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.current_profile_role() to anon, authenticated;

grant execute on function public.search_places(text, integer) to anon, authenticated;
grant execute on function public.find_trips(uuid, uuid, integer, integer) to anon, authenticated;
grant execute on function public.log_search(text, text, uuid, uuid, integer) to anon, authenticated;
grant execute on function public.similar_questions(text, uuid, uuid, integer) to anon, authenticated;

grant execute on function public.suggest_place(text, public.place_kind, double precision, double precision, text, text) to authenticated;
grant execute on function public.submit_route(jsonb) to authenticated;
grant execute on function public.confirm_route(uuid, boolean) to authenticated;
grant execute on function public.toggle_save_route(uuid) to authenticated;
grant execute on function public.add_route_comment(uuid, public.comment_kind, text) to authenticated;
grant execute on function public.ask_question(text, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.post_answer(uuid, text, uuid) to authenticated;
grant execute on function public.vote_answer(uuid, integer) to authenticated;
grant execute on function public.edit_own_content(public.content_type, uuid, text, text) to authenticated;
grant execute on function public.delete_own_content(public.content_type, uuid) to authenticated;
grant execute on function public.create_report(public.content_type, uuid, public.report_reason, text) to authenticated;
grant execute on function public.mark_best_answer(uuid) to authenticated;

grant execute on function public.moderate_route(uuid, text, text) to authenticated;
grant execute on function public.admin_update_route(uuid, jsonb) to authenticated;
grant execute on function public.resolve_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.set_content_removed(public.content_type, uuid, boolean, text) to authenticated;
grant execute on function public.merge_question(uuid, uuid) to authenticated;
grant execute on function public.set_question_closed(uuid, boolean) to authenticated;
grant execute on function public.upsert_place(jsonb) to authenticated;
grant execute on function public.upsert_advisory(jsonb) to authenticated;
grant execute on function public.delete_advisory(uuid) to authenticated;
grant execute on function public.set_user_banned(uuid, boolean) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_analytics(integer) to authenticated;
