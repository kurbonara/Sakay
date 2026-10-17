-- =============================================================================
-- Sakay: transit lines (imported from OpenStreetMap) + a new trip engine
-- -----------------------------------------------------------------------------
-- Reported: "Calumpit -> Bulacan State University" found nothing. Sakay only
-- knew hand-made sample routes. This migration adds:
--   * transit_lines / transit_line_points: whole bus, jeepney, train and ferry
--     lines with their real shape (filled by the OSM import migrations that
--     scripts/osm-transit/build.ts generates).
--   * a trip engine that boards and alights ANYWHERE along a line (except on
--     expressways; trains/ferries only at stations), chains up to 3 rides with
--     short walking transfers, and treats community routes the same way.
--   * fare/time estimates from LTFRB fare formulas when a line has no fare.
-- =============================================================================

create table public.transit_lines (
  id bigint primary key,                       -- OpenStreetMap relation id
  mode public.transport_mode not null,
  name text not null,
  ref text,
  operator text,
  network text,
  from_name text,
  to_name text,
  fare_text text,                              -- OSM "charge", e.g. "615 PHP"
  modern boolean not null default false,       -- modern jeep / aircon fare matrix
  provincial boolean not null default false,   -- long-distance bus fare matrix
  length_m integer not null,
  stops_only boolean not null default false,   -- trains/ferries: board at stations only
  osm_timestamp text,
  imported_at timestamptz not null default now()
);

create table public.transit_line_points (
  line_id bigint not null references public.transit_lines (id) on delete cascade,
  seq integer not null,
  lat double precision not null,
  lng double precision not null,
  cum_m integer not null,                      -- distance from the start of the line
  boardable boolean not null default true,     -- false on expressways / between stations
  stop_name text,
  road_name text,
  -- ~440 m grid cells for fast "what passes near here?" lookups
  cell_lat integer generated always as (floor(lat / 0.004)::integer) stored,
  cell_lng integer generated always as (floor(lng / 0.004)::integer) stored,
  primary key (line_id, seq)
);
create index transit_points_cell_idx on public.transit_line_points (cell_lat, cell_lng);

alter table public.transit_lines enable row level security;
alter table public.transit_line_points enable row level security;
create policy "Transit lines are public" on public.transit_lines for select to anon, authenticated using (true);
create policy "Transit points are public" on public.transit_line_points for select to anon, authenticated using (true);
revoke all on public.transit_lines, public.transit_line_points from anon, authenticated;
grant select on public.transit_lines, public.transit_line_points to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Loader used by the generated OSM import migrations. Geometry arrives as a
-- Google "encoded polyline" (compact text), resampled to ~200 m spacing.
--   p_board: [[from_seq, true|false], ...]  runs of boardable / not boardable
--   p_roads: [[from_seq, "MacArthur Highway"], ...]  runs of road names
--   p_stops: [[seq, "Stop name"], ...]
-- ---------------------------------------------------------------------------
create or replace function private.load_transit_line(
  p_id bigint, p_mode public.transport_mode, p_name text, p_ref text, p_operator text, p_network text,
  p_from text, p_to text, p_fare text, p_modern boolean, p_provincial boolean, p_stops_only boolean, p_timestamp text,
  p_polyline text, p_board jsonb, p_roads jsonb, p_stops jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  i integer := 1;
  n integer := length(p_polyline);
  lat bigint := 0;
  lng bigint := 0;
  shift integer;
  result bigint;
  b integer;
  seq integer := 0;
  plat double precision;
  plng double precision;
  cum double precision := 0;
  lats double precision[] := '{}';
  lngs double precision[] := '{}';
  cums integer[] := '{}';
begin
  while i <= n loop
    shift := 0; result := 0;
    loop
      b := ascii(substr(p_polyline, i, 1)) - 63; i := i + 1;
      result := result | ((b & 31)::bigint << shift); shift := shift + 5;
      exit when b < 32;
    end loop;
    lat := lat + case when result & 1 = 1 then ~(result >> 1) else result >> 1 end;
    shift := 0; result := 0;
    loop
      b := ascii(substr(p_polyline, i, 1)) - 63; i := i + 1;
      result := result | ((b & 31)::bigint << shift); shift := shift + 5;
      exit when b < 32;
    end loop;
    lng := lng + case when result & 1 = 1 then ~(result >> 1) else result >> 1 end;
    if seq > 0 then
      cum := cum + private.distance_m(plat, plng, lat / 1e5, lng / 1e5);
    end if;
    plat := lat / 1e5; plng := lng / 1e5;
    lats := lats || plat; lngs := lngs || plng; cums := cums || round(cum)::integer;
    seq := seq + 1;
  end loop;

  insert into public.transit_lines (id, mode, name, ref, operator, network, from_name, to_name, fare_text, modern, provincial, length_m, stops_only, osm_timestamp)
  values (p_id, p_mode, p_name, p_ref, p_operator, p_network, p_from, p_to, p_fare, p_modern, p_provincial, round(cum), p_stops_only, p_timestamp)
  on conflict (id) do nothing;
  if not found then return; end if;

  insert into public.transit_line_points (line_id, seq, lat, lng, cum_m, boardable, stop_name, road_name)
  select p_id, x.seq, x.lat, x.lng, x.cum,
    -- trains/ferries: only at stations, whatever p_board says
    case when p_stops_only then x.stop is not null else x.board end,
    x.stop, x.road
  from (
    select g.s - 1 as seq, lats[g.s] as lat, lngs[g.s] as lng, cums[g.s] as cum,
      coalesce((select (rb ->> 1)::boolean from jsonb_array_elements(p_board) rb where (rb ->> 0)::int <= g.s - 1 order by (rb ->> 0)::int desc limit 1), true) as board,
      (select st ->> 1 from jsonb_array_elements(p_stops) st where (st ->> 0)::int = g.s - 1 limit 1) as stop,
      (select rr ->> 1 from jsonb_array_elements(p_roads) rr where (rr ->> 0)::int <= g.s - 1 order by (rr ->> 0)::int desc limit 1) as road
    from generate_series(1, array_length(lats, 1)) as g (s)
  ) x;
end;
$$;
revoke all on function private.load_transit_line(bigint, public.transport_mode, text, text, text, text, text, text, text, boolean, boolean, boolean, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fare and time estimates (approximate LTFRB matrices, 2023-2025)
-- ---------------------------------------------------------------------------
create or replace function private.estimate_fare(p_mode public.transport_mode, p_modern boolean, p_provincial boolean, p_meters double precision)
returns numeric
language sql immutable set search_path = ''
as $$
  select round(case p_mode
    when 'jeepney' then case when p_modern then 15 + greatest(0, p_meters / 1000 - 4) * 2.20 else 13 + greatest(0, p_meters / 1000 - 4) * 1.80 end
    when 'bus' then case when p_provincial then greatest(15, p_meters / 1000 * 2.30) else 15 + greatest(0, p_meters / 1000 - 5) * 2.65 end
    when 'uv_express' then greatest(15, p_meters / 1000 * 2.40)
    when 'train' then least(13 + p_meters / 1000 * 1.2, 55)
    when 'ferry' then greatest(50, p_meters / 1000 * 3)
    when 'tricycle' then 20 + p_meters / 1000 * 10
    else 0
  end)
$$;

create or replace function private.estimate_minutes(p_mode public.transport_mode, p_provincial boolean, p_meters double precision)
returns integer
language sql immutable set search_path = ''
as $$
  select greatest(1, ceil(p_meters / 1000 / (case p_mode
    when 'jeepney' then 14
    when 'bus' then case when p_provincial then 38 else 16 end
    when 'uv_express' then 28
    when 'train' then 32
    when 'ferry' then 18
    when 'tricycle' then 15
    else 4.8
  end) * 60)::integer + case when p_mode = 'train' then 2 else 0 end)
$$;

-- Walking time with a 25% detour allowance at 80 m/min.
create or replace function private.walk_minutes(p_meters double precision)
returns integer
language sql immutable set search_path = ''
as $$ select ceil(p_meters * 1.25 / 80)::integer $$;

-- ---------------------------------------------------------------------------
-- Unified view of every rideable "line": OSM lines plus each community leg.
-- key = 'o:<osm id>' or 'c:<route_legs.id>'.
-- ---------------------------------------------------------------------------
create or replace function private.point_info(p_key text, p_seq integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
  r record;
begin
  if left(p_key, 2) = 'c:' then
    select into v jsonb_build_object('id', p.id, 'name', p.name, 'lat', p.lat, 'lng', p.lng, 'kind', p.kind)
    from public.route_legs l join public.places p on p.id = case when p_seq = 0 then l.from_place_id else l.to_place_id end
    where l.id = substr(p_key, 3)::uuid;
    return v;
  end if;
  select tp.lat, tp.lng, tp.stop_name, tp.road_name into r
  from public.transit_line_points tp where tp.line_id = substr(p_key, 3)::bigint and tp.seq = p_seq;
  if r.lat is null then return null; end if;
  -- Name the spot: mapped stop > nearby Sakay landmark > road name.
  return jsonb_build_object(
    'id', null,
    'lat', r.lat, 'lng', r.lng, 'kind', 'other',
    'name', coalesce(
      r.stop_name,
      (select case when r.road_name is not null then r.road_name || ' (near ' || p.name || ')' else 'Near ' || p.name end
       from public.places p
       where p.is_verified and abs(p.lat - r.lat) < 0.003 and abs(p.lng - r.lng) < 0.003
         and private.distance_m(p.lat, p.lng, r.lat, r.lng) <= 300
       order by private.distance_m(p.lat, p.lng, r.lat, r.lng) limit 1),
      r.road_name,
      'Along the route'
    )
  );
end;
$$;

create or replace function private.leg_json(p_key text, p_from integer, p_to integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  l record;
  t public.transit_lines;
  meters double precision;
  fare numeric;
  path jsonb;
begin
  if left(p_key, 2) = 'c:' then
    select rl.id, rl.mode, rl.signboard, rl.instructions, rl.fare, coalesce(rl.fare_discounted, round(rl.fare * 0.8, 2)) as fare_d,
      rl.minutes, rl.path, r.id as route_id, r.title, r.is_sample, r.still_accurate_count, r.outdated_count
    into l
    from public.route_legs rl join public.routes r on r.id = rl.route_id
    where rl.id = substr(p_key, 3)::uuid;
    return jsonb_build_object(
      'leg_id', l.id, 'source', 'community', 'route_id', l.route_id, 'route_title', l.title, 'line_id', null,
      'is_sample', l.is_sample, 'estimated', false,
      'still_accurate_count', l.still_accurate_count, 'outdated_count', l.outdated_count,
      'mode', l.mode, 'signboard', l.signboard, 'instructions', l.instructions,
      'fare', l.fare, 'fare_discounted', l.fare_d, 'minutes', l.minutes, 'path', l.path,
      'from', private.point_info(p_key, 0), 'to', private.point_info(p_key, 1)
    );
  end if;

  select * into t from public.transit_lines where id = substr(p_key, 3)::bigint;
  select (b.cum_m - a.cum_m) into meters
  from public.transit_line_points a, public.transit_line_points b
  where a.line_id = t.id and b.line_id = t.id and a.seq = p_from and b.seq = p_to;
  select jsonb_agg(jsonb_build_array(tp.lat, tp.lng) order by tp.seq) into path
  from public.transit_line_points tp where tp.line_id = t.id and tp.seq between p_from and p_to;
  fare := private.estimate_fare(t.mode, t.modern, t.provincial, meters);
  return jsonb_build_object(
    'leg_id', p_key || ':' || p_from || '-' || p_to, 'source', 'osm', 'route_id', null, 'line_id', t.id,
    'route_title', t.name, 'ref', t.ref, 'operator', t.operator, 'fare_text', t.fare_text,
    'is_sample', false, 'estimated', true, 'still_accurate_count', 0, 'outdated_count', 0,
    'mode', t.mode,
    'signboard', coalesce(nullif(regexp_replace(t.name, '\s*\((in|out)bound\)|\s*\((north|south|east|west)bound\)', '', 'gi'), ''), t.ref),
    'instructions', null,
    'fare', fare, 'fare_discounted', round(fare * 0.8),
    'minutes', private.estimate_minutes(t.mode, t.provincial, meters),
    'distance_m', round(meters),
    'path', path,
    'from', private.point_info(p_key, p_from), 'to', private.point_info(p_key, p_to)
  );
end;
$$;

-- A walking leg between two points (null if they're basically the same spot).
create or replace function private.walk_leg(p_from jsonb, p_to jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  d double precision;
begin
  if p_from is null or p_to is null then return null; end if;
  d := private.distance_m((p_from ->> 'lat')::float8, (p_from ->> 'lng')::float8, (p_to ->> 'lat')::float8, (p_to ->> 'lng')::float8);
  if d < 40 then return null; end if;
  return jsonb_build_object(
    'leg_id', 'walk:' || md5(p_from::text || p_to::text), 'source', 'walk', 'route_id', null, 'line_id', null,
    'route_title', null, 'is_sample', false, 'estimated', false, 'still_accurate_count', 0, 'outdated_count', 0,
    'mode', 'walk', 'signboard', null, 'instructions', null,
    'fare', 0, 'fare_discounted', 0, 'minutes', private.walk_minutes(d), 'distance_m', round(d),
    'path', null, 'from', p_from, 'to', p_to
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The trip engine
-- ---------------------------------------------------------------------------
drop function if exists public.find_trips_at(double precision, double precision, double precision, double precision, integer, integer, integer);
drop function if exists public.find_trips(uuid, uuid, integer, integer, integer);

create or replace function public.find_trips_at(
  p_from_lat double precision, p_from_lng double precision, p_to_lat double precision, p_to_lng double precision,
  p_max_legs integer default 3, p_limit integer default 8, p_radius integer default 600,
  p_from_name text default null, p_to_name text default null
) returns jsonb
-- volatile: it uses scratch temp tables (dropped at commit)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_radius double precision := least(greatest(coalesce(p_radius, 600), 100), 3000);
  v_transfer constant double precision := 600;
  v_cell constant double precision := 0.004;
  v_max_rides integer := least(greatest(coalesce(p_max_legs, 3), 1), 3);
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_found integer;
  v_result jsonb;
  v_box double precision;
  v_cmin_lat integer;
  v_cmax_lat integer;
  v_cmin_lng integer;
  v_cmax_lng integer;
begin
  if not (p_from_lat between 4 and 22 and p_to_lat between 4 and 22 and p_from_lng between 116 and 127 and p_to_lng between 116 and 127) then
    return '[]'::jsonb;
  end if;

  -- Rideable segments: every OSM line point plus both ends of each published community leg.
  create temp table if not exists _pts (k text, seq int, lat float8, lng float8, cum float8, board bool, mode public.transport_mode, prov bool, fixed_min int, cl int, cn int) on commit drop;
  create temp table if not exists _cand (rides int, k1 text, f1 int, t1 int, k2 text, f2 int, t2 int, k3 text, f3 int, t3 int, cost float8) on commit drop;
  truncate _pts; truncate _cand;

  -- Candidates near origin / destination / reachable lines are loaded lazily below.
  -- Community legs (small set, always loaded).
  insert into _pts
  select 'c:' || l.id, s.seq, s.lat, s.lng, case when s.seq = 0 then 0 else private.distance_m(fp.lat, fp.lng, tp.lat, tp.lng) end,
    true, l.mode, false, l.minutes, floor(s.lat / v_cell)::int, floor(s.lng / v_cell)::int
  from public.route_legs l
  join public.routes r on r.id = l.route_id and r.status = 'published'
  join public.places fp on fp.id = l.from_place_id
  join public.places tp on tp.id = l.to_place_id
  cross join lateral (values (0, fp.lat, fp.lng), (1, tp.lat, tp.lng)) as s (seq, lat, lng)
  where l.mode <> 'walk';

  -- OSM lines that pass near the origin or destination. Only the part of each
  -- line inside the trip's corridor (bounding box + margin) is loaded.
  v_box := greatest(abs(p_from_lat - p_to_lat), abs(p_from_lng - p_to_lng)) * 0.35 + 0.05;
  v_cmin_lat := floor((least(p_from_lat, p_to_lat) - v_box) / v_cell);
  v_cmax_lat := floor((greatest(p_from_lat, p_to_lat) + v_box) / v_cell);
  v_cmin_lng := floor((least(p_from_lng, p_to_lng) - v_box) / v_cell);
  v_cmax_lng := floor((greatest(p_from_lng, p_to_lng) + v_box) / v_cell);
  insert into _pts
  select 'o:' || p.line_id, p.seq, p.lat, p.lng, p.cum_m, p.boardable, t.mode, t.provincial, null, p.cell_lat, p.cell_lng
  from public.transit_line_points p
  join public.transit_lines t on t.id = p.line_id
  where p.cell_lat between v_cmin_lat and v_cmax_lat and p.cell_lng between v_cmin_lng and v_cmax_lng
    and p.line_id in (
    select distinct q.line_id from public.transit_line_points q
    where q.boardable and (
      (q.cell_lat between floor((p_from_lat - v_radius / 111000) / v_cell) and floor((p_from_lat + v_radius / 111000) / v_cell)
       and q.cell_lng between floor((p_from_lng - v_radius / 107000) / v_cell) and floor((p_from_lng + v_radius / 107000) / v_cell))
      or
      (q.cell_lat between floor((p_to_lat - v_radius / 111000) / v_cell) and floor((p_to_lat + v_radius / 111000) / v_cell)
       and q.cell_lng between floor((p_to_lng - v_radius / 107000) / v_cell) and floor((p_to_lng + v_radius / 107000) / v_cell))
    )
  );
  create index if not exists _pts_k on _pts (k, seq);
  create index if not exists _pts_cell on _pts (cl, cn);
  analyze _pts;

  -- Where the trip can really start/end: the point itself, plus places that a
  -- community route connects to it on foot (e.g. "walk from LRT-2 Legarda to UST").
  create temp table if not exists _ot (lat float8, lng float8, extra float8) on commit drop;
  create temp table if not exists _dt (lat float8, lng float8, extra float8) on commit drop;
  truncate _ot; truncate _dt;
  insert into _ot values (p_from_lat, p_from_lng, 0);
  insert into _ot
  select tp.lat, tp.lng, w.minutes * 80
  from public.route_legs w
  join public.routes r on r.id = w.route_id and r.status = 'published'
  join public.places fp on fp.id = w.from_place_id
  join public.places tp on tp.id = w.to_place_id
  where w.mode = 'walk' and private.distance_m(fp.lat, fp.lng, p_from_lat, p_from_lng) <= 150;
  insert into _dt values (p_to_lat, p_to_lng, 0);
  insert into _dt
  select fp.lat, fp.lng, w.minutes * 80
  from public.route_legs w
  join public.routes r on r.id = w.route_id and r.status = 'published'
  join public.places fp on fp.id = w.from_place_id
  join public.places tp on tp.id = w.to_place_id
  where w.mode = 'walk' and private.distance_m(tp.lat, tp.lng, p_to_lat, p_to_lng) <= 150;

  -- Best boarding point per line near the origin, best alighting point per line near the destination.
  create temp table if not exists _o (k text, seq int, walk float8) on commit drop;
  create temp table if not exists _d (k text, seq int, walk float8) on commit drop;
  truncate _o; truncate _d;
  insert into _o
  select distinct on (k) k, seq, w from (
    select p.k, p.seq, private.distance_m(p.lat, p.lng, t.lat, t.lng) + t.extra as w, private.distance_m(p.lat, p.lng, t.lat, t.lng) as near
    from _pts p cross join _ot t where p.board
  ) x where near <= v_radius order by k, w, seq;
  insert into _d
  select distinct on (k) k, seq, w from (
    select p.k, p.seq, private.distance_m(p.lat, p.lng, t.lat, t.lng) + t.extra as w, private.distance_m(p.lat, p.lng, t.lat, t.lng) as near
    from _pts p cross join _dt t where p.board
  ) x where near <= v_radius order by k, w, seq desc;
  -- Keep the closest 60 lines on each side, plus every train and community route in range
  -- (busy areas like Cubao have 100+ bus lines; the MRT must never be crowded out).
  delete from _o where k not in (select k from _o order by walk limit 60)
    and left(k, 2) = 'o:' and substr(k, 3)::bigint not in (select id from public.transit_lines where stops_only);
  delete from _d where k not in (select k from _d order by walk limit 60)
    and left(k, 2) = 'o:' and substr(k, 3)::bigint not in (select id from public.transit_lines where stops_only);

  -- 1 ride
  insert into _cand (rides, k1, f1, t1, cost)
  select 1, o.k, o.seq, d.seq,
    private.walk_minutes(o.walk) + private.walk_minutes(d.walk)
    + coalesce(a.fixed_min, private.estimate_minutes(a.mode, a.prov, b.cum - a.cum))
  from _o o join _d d on d.k = o.k and d.seq > o.seq
  join _pts a on a.k = o.k and a.seq = o.seq
  join _pts b on b.k = d.k and b.seq = d.seq
  where b.cum - a.cum > 0 and (a.fixed_min is not null or b.cum - a.cum >= 700);

  -- 2 rides: get off line A somewhere after boarding, walk <= 400 m, board line B before its stop near the destination.
  if v_max_rides >= 2 then
    insert into _cand (rides, k1, f1, t1, k2, f2, t2, cost)
    select distinct on (o.k, d.k) 2, o.k, o.seq, pa.seq, d.k, pb.seq, d.seq,
      private.walk_minutes(o.walk) + private.walk_minutes(d.walk)
      + coalesce(a0.fixed_min, private.estimate_minutes(a0.mode, a0.prov, pa.cum - a0.cum))
      + private.walk_minutes(private.distance_m(pa.lat, pa.lng, pb.lat, pb.lng)) + 6
      + coalesce(pb.fixed_min, private.estimate_minutes(pb.mode, pb.prov, b1.cum - pb.cum)) as cost
    from _o o
    join _pts a0 on a0.k = o.k and a0.seq = o.seq
    join _pts pa on pa.k = o.k and pa.seq > o.seq and pa.board and (left(o.k, 2) = 'o:' or pa.seq = 1)
    join _pts pb on pb.cl between pa.cl - 1 and pa.cl + 1 and pb.cn between pa.cn - 1 and pa.cn + 1 and pb.board and pb.k <> o.k
    join _d d on d.k = pb.k and pb.seq < d.seq
    join _pts b1 on b1.k = d.k and b1.seq = d.seq
    where private.distance_m(pa.lat, pa.lng, pb.lat, pb.lng) <= v_transfer
      and (left(pb.k, 2) = 'o:' or pb.seq = 0)
      and pa.cum - a0.cum > 0 and b1.cum - pb.cum > 0
      and (a0.fixed_min is not null or pa.cum - a0.cum >= 700) and (pb.fixed_min is not null or b1.cum - pb.cum >= 700)
      and not exists (select 1 from _cand c where c.rides = 1 and c.k1 in (o.k, d.k))
    order by o.k, d.k, cost;
  end if;

  select count(*) into v_found from _cand;

  -- 3 rides (only when nothing shorter exists): A near origin -> any line B -> C near destination.
  if v_max_rides >= 3 and v_found < 3 then
    -- Middle lines must pass near BOTH an origin-side line (after boarding)
    -- and a destination-side line (before alighting). Work on grid cells, not points.
    create temp table if not exists _ca (cl int, cn int) on commit drop;
    create temp table if not exists _cd (cl int, cn int) on commit drop;
    create temp table if not exists _mid (line_id bigint) on commit drop;
    truncate _ca; truncate _cd; truncate _mid;
    insert into _ca select distinct a.cl + dx, a.cn + dy
      from _o o join _pts a on a.k = o.k and a.seq > o.seq and a.board, generate_series(-1, 1) dx, generate_series(-1, 1) dy;
    insert into _cd select distinct a.cl + dx, a.cn + dy
      from _d d join _pts a on a.k = d.k and a.seq < d.seq and a.board, generate_series(-1, 1) dx, generate_series(-1, 1) dy;
    insert into _mid
    select line_id from (
      select q.line_id from public.transit_line_points q join _ca c on q.cell_lat = c.cl and q.cell_lng = c.cn where q.boardable
      intersect
      select q.line_id from public.transit_line_points q join _cd c on q.cell_lat = c.cl and q.cell_lng = c.cn where q.boardable
    ) x
    where ('o:' || line_id) not in (select k from _o union select k from _d)
    limit 150;
    insert into _pts
    select 'o:' || p.line_id, p.seq, p.lat, p.lng, p.cum_m, p.boardable, t.mode, t.provincial, null, p.cell_lat, p.cell_lng
    from public.transit_line_points p
    join public.transit_lines t on t.id = p.line_id
    where p.line_id in (select line_id from _mid)
      and ('o:' || p.line_id) not in (select distinct k from _pts)
      and p.cell_lat between v_cmin_lat and v_cmax_lat and p.cell_lng between v_cmin_lng and v_cmax_lng;
    analyze _pts;

    create temp table if not exists _ab (ka text, fa int, ta int, kb text, fb int, cost float8) on commit drop;
    truncate _ab;
    insert into _ab
    select distinct on (o.k, pb.k) o.k, o.seq, pa.seq, pb.k, pb.seq,
      private.walk_minutes(o.walk)
      + coalesce(a0.fixed_min, private.estimate_minutes(a0.mode, a0.prov, pa.cum - a0.cum))
      + private.walk_minutes(private.distance_m(pa.lat, pa.lng, pb.lat, pb.lng)) + 6 as cost
    from _o o
    join _pts a0 on a0.k = o.k and a0.seq = o.seq
    join _pts pa on pa.k = o.k and pa.seq > o.seq and pa.board and (left(o.k, 2) = 'o:' or pa.seq = 1)
    join _pts pb on pb.cl between pa.cl - 1 and pa.cl + 1 and pb.cn between pa.cn - 1 and pa.cn + 1 and pb.board and pb.k <> o.k
    where private.distance_m(pa.lat, pa.lng, pb.lat, pb.lng) <= v_transfer
      and (left(pb.k, 2) = 'o:' or pb.seq = 0)
      and pb.k not in (select k from _d)
      and (left(pb.k, 2) = 'c:' or substr(pb.k, 3)::bigint in (select line_id from _mid))
      and pa.cum - a0.cum > 0 and (a0.fixed_min is not null or pa.cum - a0.cum >= 700)
    order by o.k, pb.k, cost;
    delete from _ab where (ka, kb) not in (select ka, kb from _ab order by cost limit 300);

    insert into _cand (rides, k1, f1, t1, k2, f2, t2, k3, f3, t3, cost)
    select distinct on (ab.ka, ab.kb, d.k) 3, ab.ka, ab.fa, ab.ta, ab.kb, ab.fb, pb.seq, d.k, pc.seq, d.seq,
      ab.cost
      + coalesce(b0.fixed_min, private.estimate_minutes(b0.mode, b0.prov, pb.cum - b0.cum))
      + private.walk_minutes(private.distance_m(pb.lat, pb.lng, pc.lat, pc.lng)) + 6
      + coalesce(pc.fixed_min, private.estimate_minutes(pc.mode, pc.prov, c1.cum - pc.cum))
      + private.walk_minutes(d.walk) as cost
    from _ab ab
    join _pts b0 on b0.k = ab.kb and b0.seq = ab.fb
    join _pts pb on pb.k = ab.kb and pb.seq > ab.fb and pb.board and (left(ab.kb, 2) = 'o:' or pb.seq = 1)
    join _pts pc on pc.cl between pb.cl - 1 and pb.cl + 1 and pc.cn between pb.cn - 1 and pb.cn + 1 and pc.board and pc.k not in (ab.ka, ab.kb)
    join _d d on d.k = pc.k and pc.seq < d.seq
    join _pts c1 on c1.k = d.k and c1.seq = d.seq
    where private.distance_m(pb.lat, pb.lng, pc.lat, pc.lng) <= v_transfer
      and (left(pc.k, 2) = 'o:' or pc.seq = 0)
      and pb.cum - b0.cum > 0 and c1.cum - pc.cum > 0
      and (b0.fixed_min is not null or pb.cum - b0.cum >= 700) and (pc.fixed_min is not null or c1.cum - pc.cum >= 700)
    order by ab.ka, ab.kb, d.k, cost;
  end if;

  -- Build the answer: best few trips, with walking legs between rides.
  with best as (
    select * from _cand
    order by cost + (rides - 1) * 12, rides
    limit v_limit
  ),
  built as (
    select b.*,
      (select jsonb_agg(leg order by ord) from (
        select 1 as ord, private.leg_json(b.k1, b.f1, b.t1) as leg
        union all select 2, private.leg_json(b.k2, b.f2, b.t2) where b.k2 is not null
        union all select 3, private.leg_json(b.k3, b.f3, b.t3) where b.k3 is not null
      ) x) as rides_json
    from best b
  ),
  with_walks as (
    select bt.cost, bt.rides,
      (
        select jsonb_agg(leg order by ord) from (
          -- walk from the starting point to the first ride
          select 0 as ord, private.walk_leg(jsonb_build_object('id', null, 'name', coalesce(p_from_name, 'Starting point'), 'lat', p_from_lat, 'lng', p_from_lng, 'kind', 'other'), bt.rides_json -> 0 -> 'from') as leg
          union all
          select i * 2 + 1, bt.rides_json -> i from generate_series(0, jsonb_array_length(bt.rides_json) - 1) i
          union all
          select i * 2 + 2, private.walk_leg(bt.rides_json -> i -> 'to', bt.rides_json -> (i + 1) -> 'from')
          from generate_series(0, jsonb_array_length(bt.rides_json) - 2) i
          union all
          select 99, private.walk_leg(bt.rides_json -> -1 -> 'to', jsonb_build_object('id', null, 'name', coalesce(p_to_name, 'Destination'), 'lat', p_to_lat, 'lng', p_to_lng, 'kind', 'other'))
        ) x where leg is not null
      ) as legs
    from built bt
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'fare', (select sum((l ->> 'fare')::numeric) from jsonb_array_elements(w.legs) l),
      'fare_discounted', (select sum((l ->> 'fare_discounted')::numeric) from jsonb_array_elements(w.legs) l),
      'minutes', (select sum((l ->> 'minutes')::int) from jsonb_array_elements(w.legs) l) + (w.rides - 1) * 5,
      'walk_m', (select coalesce(sum((l ->> 'distance_m')::int), 0) from jsonb_array_elements(w.legs) l where l ->> 'mode' = 'walk'),
      'transfers', w.rides - 1,
      'estimated', (select bool_or((l ->> 'estimated')::boolean) from jsonb_array_elements(w.legs) l),
      'single_route_id', (
        select case when count(distinct l ->> 'route_id') = 1 and bool_and(l ->> 'source' = 'community')
          and count(*) = (select count(*) from public.route_legs rl where rl.route_id = min(l ->> 'route_id')::uuid and rl.mode <> 'walk')
          then min(l ->> 'route_id')::uuid end
        from jsonb_array_elements(w.legs) l where l ->> 'mode' <> 'walk'
      ),
      'legs', w.legs
    ) order by w.cost + (w.rides - 1) * 12), '[]'::jsonb)
  into v_result
  from with_walks w;
  return v_result;
end;
$$;

-- The place-id version (used by the ask form and older links).
create or replace function public.find_trips(
  p_origin uuid, p_destination uuid, p_max_legs integer default 3, p_limit integer default 8, p_radius integer default 600
) returns jsonb
language sql volatile security definer set search_path = ''
as $$
  select coalesce(
    (select public.find_trips_at(o.lat, o.lng, d.lat, d.lng, p_max_legs, p_limit, p_radius, o.name, d.name)
     from public.places o, public.places d
     where o.id = p_origin and d.id = p_destination),
    '[]'::jsonb)
$$;

revoke all on function private.estimate_fare(public.transport_mode, boolean, boolean, double precision) from public, anon, authenticated;
revoke all on function private.estimate_minutes(public.transport_mode, boolean, double precision) from public, anon, authenticated;
revoke all on function private.walk_minutes(double precision) from public, anon, authenticated;
revoke all on function private.point_info(text, integer) from public, anon, authenticated;
revoke all on function private.leg_json(text, integer, integer) from public, anon, authenticated;
revoke all on function private.walk_leg(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.find_trips_at(double precision, double precision, double precision, double precision, integer, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.find_trips(uuid, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.find_trips_at(double precision, double precision, double precision, double precision, integer, integer, integer, text, text) to anon, authenticated;
grant execute on function public.find_trips(uuid, uuid, integer, integer, integer) to anon, authenticated;
