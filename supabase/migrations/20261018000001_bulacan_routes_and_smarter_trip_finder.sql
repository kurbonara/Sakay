-- =============================================================================
-- Sakay: Bulacan starter data + smarter trip finder
-- -----------------------------------------------------------------------------
-- Reported: "From Malolos -> SM Megamall" and "Hagonoy -> SM Megamall" found
-- nothing. Causes:
--   1. No Bulacan places/routes existed yet.
--   2. find_trips counted walking legs as rides, so jeep + bus + walk + train +
--      walk (5 legs) went over the 4-ride limit.
--   3. A trip had to start within 500 m of the exact place picked; a town
--      landmark ~1 km from the terminal never matched.
-- Fixes: add Bulacan sample data; count only real rides toward the limit; add a
-- p_radius parameter so the app can widen the search (the UI retries at 2 km);
-- rank places that are real stops first in autocomplete.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Places (approximate pins; moderators can fine-tune them in Admin → Places)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.sid(p_key text) returns uuid language sql immutable as $$
  select md5('sakay-sample:' || p_key)::uuid
$$;

insert into public.places (id, name, aliases, kind, city, lat, lng, modes, hours_open, hours_close, hours_note, is_verified, description) values
  (pg_temp.sid('malolos-crossing'), 'Malolos Crossing (bus & jeep terminal)', '{"Malolos","Malolos terminal","Crossing Malolos","Malolos Bulacan"}', 'terminal', 'Malolos', 14.8470, 120.8195, '{bus,jeepney,uv_express,tricycle}', '04:00', '22:00', 'Buses to Cubao and Monumento; jeeps to Hagonoy, Calumpit and Bulacan towns', true, 'Main loading area along MacArthur Highway in Malolos.'),
  (pg_temp.sid('malolos-cathedral'), 'Malolos Cathedral (Barasoain area)', '{"Malolos","Barasoain Church","Malolos Cathedral","Malolos City Hall"}', 'church', 'Malolos', 14.8440, 120.8115, '{}', null, null, null, true, null),
  (pg_temp.sid('bulsu'), 'Bulacan State University (Main Campus)', '{"BulSU","BSU Malolos","Bulacan State University"}', 'school', 'Malolos', 14.8578, 120.8148, '{}', null, null, null, true, null),
  (pg_temp.sid('hagonoy'), 'Hagonoy (Town Proper / Public Market)', '{"Hagonoy","Hagonoy Bulacan","Hagonoy Market","Hagonoy Church","St. Anne Parish Hagonoy"}', 'terminal', 'Hagonoy', 14.8340, 120.7330, '{jeepney,tricycle}', '04:30', '21:00', 'Jeeps to Malolos Crossing', true, null),
  (pg_temp.sid('carousel-monumento'), 'EDSA Carousel – Monumento Station', '{"Carousel Monumento","EDSA Bus Monumento"}', 'station', 'Caloocan', 14.6558, 120.9850, '{bus}', '04:00', '23:00', 'Busway stop; some trips run 24 hours', true, null),
  (pg_temp.sid('carousel-ortigas'), 'EDSA Carousel – Ortigas Station', '{"Carousel Ortigas","EDSA Bus Ortigas"}', 'station', 'Mandaluyong', 14.5872, 121.0571, '{bus}', '04:00', '23:00', 'Busway stop near SM Megamall and Robinsons Galleria', true, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Sample routes (fares and times are estimates; flagged "Sample")
-- ---------------------------------------------------------------------------
create or replace function pg_temp.add_route(
  p_key text, p_title text, p_summary text, p_hours text,
  p_pwd boolean, p_senior boolean, p_heavy boolean, p_access_notes text, p_legs jsonb
) returns void language plpgsql as $$
declare
  v_id uuid := pg_temp.sid('route:' || p_key);
  v_leg jsonb;
  v_seq integer := 0;
begin
  if exists (select 1 from public.routes where id = v_id) then return; end if;
  insert into public.routes (id, title, summary, operating_hours, origin_place_id, destination_place_id, status, is_sample,
    pwd_friendly, senior_friendly, heavy_load_friendly, accessibility_notes, published_at)
  values (v_id, p_title, p_summary, p_hours,
    pg_temp.sid(p_legs -> 0 ->> 'from'), pg_temp.sid(p_legs -> (jsonb_array_length(p_legs) - 1) ->> 'to'),
    'published', true, p_pwd, p_senior, p_heavy, p_access_notes, now());
  for v_leg in select * from jsonb_array_elements(p_legs) loop
    v_seq := v_seq + 1;
    insert into public.route_legs (route_id, seq, mode, from_place_id, to_place_id, signboard, instructions, fare, minutes)
    values (v_id, v_seq, (v_leg ->> 'mode')::public.transport_mode, pg_temp.sid(v_leg ->> 'from'), pg_temp.sid(v_leg ->> 'to'),
      v_leg ->> 'sign', v_leg ->> 'how', coalesce((v_leg ->> 'fare')::numeric, 0), (v_leg ->> 'min')::integer);
  end loop;
end;
$$;

select pg_temp.add_route('hagonoy-malolos', 'Hagonoy to Malolos Crossing by jeep',
  'Jeepney from Hagonoy town proper to the Malolos Crossing terminal.', '4:30 AM - 9:00 PM',
  false, false, false, 'Jeeps fill up fast before 7 AM; expect standing room only on market days.',
  '[{"mode":"jeepney","from":"hagonoy","to":"malolos-crossing","sign":"HAGONOY - MALOLOS","fare":40,"min":40,"how":"Ride at the jeepney stop near the Hagonoy public market. Get off at Malolos Crossing (last stop)."}]');

select pg_temp.add_route('malolos-town-crossing', 'Malolos Cathedral / City Hall to Malolos Crossing by tricycle',
  'Short tricycle hop from the Barasoain / Cathedral area to the bus terminal.', '5:00 AM - 10:00 PM',
  false, false, false, null,
  '[{"mode":"tricycle","from":"malolos-cathedral","to":"malolos-crossing","sign":"CROSSING","fare":30,"min":10,"how":"Special trip; agree on the fare before riding."}]');

select pg_temp.add_route('bulsu-crossing', 'BulSU to Malolos Crossing by jeep',
  'Any southbound jeep along MacArthur Highway passes the Crossing.', '5:00 AM - 9:00 PM',
  false, false, false, null,
  '[{"mode":"jeepney","from":"bulsu","to":"malolos-crossing","sign":"MALOLOS CROSSING / GUIGUINTO","fare":13,"min":8}]');

select pg_temp.add_route('malolos-cubao-bus', 'Malolos to Cubao by bus (via NLEX)',
  'Provincial bus from Malolos Crossing to the Araneta City Bus Port in Cubao.', '4:00 AM - 9:00 PM',
  false, true, true, 'Aircon buses with luggage space; seats fill up 6-8 AM.',
  '[{"mode":"bus","from":"malolos-crossing","to":"cubao-busport","sign":"MALOLOS - CUBAO (NLEX)","fare":110,"min":100,"how":"Board at the Crossing bus stop, southbound side. Tell the conductor you are going to Cubao."}]');

select pg_temp.add_route('cubao-busport-megamall', 'Cubao Bus Port to SM Megamall via MRT-3',
  'Walk to MRT-3 Cubao, ride southbound to Ortigas, then walk to Megamall.', '4:30 AM - 10:30 PM',
  true, true, false, 'Elevators at Cubao and Ortigas stations; may be under maintenance.',
  '[{"mode":"walk","from":"cubao-busport","to":"mrt-cubao","fare":0,"min":8,"how":"Walk through Gateway Mall to the MRT-3 Araneta Center-Cubao station."},
    {"mode":"train","from":"mrt-cubao","to":"mrt-ortigas","sign":"MRT-3 Southbound (to Taft Avenue)","fare":16,"min":8,"how":"Get off at Ortigas (2 stops)."},
    {"mode":"walk","from":"mrt-ortigas","to":"megamall","fare":0,"min":6,"how":"Use the walkway from Ortigas station to SM Megamall."}]');

select pg_temp.add_route('malolos-monumento-bus', 'Malolos to Monumento by bus (via MacArthur)',
  'Ordinary/aircon bus along MacArthur Highway to Monumento.', '4:00 AM - 10:00 PM',
  false, false, true, null,
  '[{"mode":"bus","from":"malolos-crossing","to":"carousel-monumento","sign":"MALOLOS - MONUMENTO","fare":75,"min":90,"how":"Southbound side of the Crossing. Get off at Monumento near the EDSA Carousel stop."}]');

select pg_temp.add_route('carousel-monumento-ortigas', 'Monumento to SM Megamall by EDSA Carousel',
  'EDSA Carousel bus southbound from Monumento to Ortigas, then walk to Megamall.', '4:00 AM - 11:00 PM',
  true, true, false, 'Busway stations have ramps; some have stairs only.',
  '[{"mode":"bus","from":"carousel-monumento","to":"carousel-ortigas","sign":"EDSA CAROUSEL - PITX","fare":45,"min":45,"how":"Pay with beep card or cash. Get off at Ortigas."},
    {"mode":"walk","from":"carousel-ortigas","to":"megamall","fare":0,"min":6}]');

-- ---------------------------------------------------------------------------
-- 3. Trip finder: rides (not walks) count toward the limit; adjustable radius.
-- ---------------------------------------------------------------------------
drop function if exists public.find_trips(uuid, uuid, integer, integer);

create or replace function public.find_trips(
  p_origin uuid, p_destination uuid, p_max_legs integer default 4, p_limit integer default 8, p_radius integer default 500
) returns jsonb
language sql stable security definer set search_path = ''
as $$
with recursive
cfg as (
  select least(greatest(coalesce(p_max_legs, 4), 1), 5) as max_rides,
         least(greatest(coalesce(p_radius, 500), 100), 3000)::double precision as radius
),
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
  from stops s, ends e, cfg
  where abs(s.lat - e.olat) < cfg.radius / 90000 and abs(s.lng - e.olng) < cfg.radius / 90000
    and private.distance_m(s.lat, s.lng, e.olat, e.olng) <= cfg.radius
),
dest_set as (
  select s.id, private.distance_m(s.lat, s.lng, e.dlat, e.dlng) as dist
  from stops s, ends e, cfg
  where abs(s.lat - e.dlat) < cfg.radius / 90000 and abs(s.lng - e.dlng) < cfg.radius / 90000
    and private.distance_m(s.lat, s.lng, e.dlat, e.dlng) <= cfg.radius
),
-- Walking transfers between stops stay short (500 m) whatever the end radius is.
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
    coalesce(l.fare_discounted, round(l.fare * 0.8, 2))::numeric as fare_d, l.minutes,
    (l.mode <> 'walk')::integer as ride
  from public.route_legs l
  join public.routes r on r.id = l.route_id and r.status = 'published'
  order by l.from_place_id, l.to_place_id, l.mode, coalesce(lower(l.signboard), ''),
    r.still_accurate_count - r.outdated_count desc, l.fare, l.minutes
),
trips (leg_ids, ride_ids, visited, last_place, rides, legs_n, fare, fare_d, minutes, walk_m) as (
  select array[e.leg_id], case when e.ride = 1 then array[e.leg_id] else '{}'::uuid[] end,
    array[e.from_place_id, e.to_place_id], e.to_place_id, e.ride, 1,
    e.fare, e.fare_d, e.minutes + ceil(o.dist / 80)::integer, o.dist::double precision
  from edges e join origin_set o on o.id = e.from_place_id
  union all
  select t.leg_ids || e.leg_id, t.ride_ids || case when e.ride = 1 then array[e.leg_id] else '{}'::uuid[] end, t.visited || e.to_place_id, e.to_place_id, t.rides + e.ride, t.legs_n + 1,
    t.fare + e.fare, t.fare_d + e.fare_d,
    -- walking time (80 m/min) plus ~5 min waiting when boarding another vehicle
    t.minutes + e.minutes + ceil(h.dist / 80)::integer + case when e.ride = 1 and t.rides > 0 then 5 else 0 end,
    t.walk_m + h.dist
  from trips t
  join hops h on h.a_id = t.last_place
  join edges e on e.from_place_id = h.b_id
  cross join cfg
  where t.rides + e.ride <= cfg.max_rides
    and t.legs_n < 8
    and not (e.to_place_id = any (t.visited))
    and not exists (select 1 from dest_set d where d.id = t.last_place)
    and t.minutes < 420
),
found as (
  select t.*, t.minutes + ceil(d.dist / 80)::integer as total_minutes, t.walk_m + d.dist as total_walk
  from trips t join dest_set d on d.id = t.last_place
  where t.rides > 0
),
-- Same vehicles in the same order = same trip (walkway variations don't count).
ranked as (
  select distinct on (f.ride_ids) f.*
  from found f
  order by f.ride_ids, f.total_minutes, f.total_walk
),
best as (
  select * from ranked
  order by rides, total_minutes, fare
  limit least(greatest(coalesce(p_limit, 8), 1), 20)
)
select coalesce(jsonb_agg(trip order by (trip ->> 'transfers')::integer, (trip ->> 'minutes')::integer, (trip ->> 'fare')::numeric), '[]'::jsonb)
from (
  select jsonb_build_object(
    'fare', b.fare,
    'fare_discounted', b.fare_d,
    'minutes', b.total_minutes,
    'walk_m', round(b.total_walk)::integer,
    'transfers', greatest(b.rides - 1, 0),
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

revoke all on function public.find_trips(uuid, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.find_trips(uuid, uuid, integer, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Autocomplete: among equally good matches, real stops/terminals come first
--    (typing "Malolos" should suggest the terminal before the church).
-- ---------------------------------------------------------------------------
create or replace function public.search_places(p_query text, p_limit integer default 8)
returns table (
  id uuid, name text, kind public.place_kind, city text, lat double precision, lng double precision,
  is_verified boolean, score real
)
language sql stable security definer set search_path = ''
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as t),
  used as (
    select l.from_place_id as place_id from public.route_legs l join public.routes r on r.id = l.route_id and r.status = 'published'
    union
    select l.to_place_id from public.route_legs l join public.routes r on r.id = l.route_id and r.status = 'published'
  )
  select p.id, p.name, p.kind, p.city, p.lat, p.lng, p.is_verified,
    (greatest(
      extensions.similarity(p.search_text, q.t),
      extensions.word_similarity(q.t, p.search_text),
      case when p.search_text like private.escape_like(q.t) || '%' then 1.0 else 0 end,
      case when p.search_text like '%' || private.escape_like(q.t) || '%' then 0.6 else 0 end
    )
    + case when exists (select 1 from used u where u.place_id = p.id) then 0.05 else 0 end
    + case when p.kind in ('terminal', 'station') then 0.02 else 0 end)::real as score
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

revoke all on function public.search_places(text, integer) from public, anon, authenticated;
grant execute on function public.search_places(text, integer) to anon, authenticated;
