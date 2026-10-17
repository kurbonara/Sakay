-- =============================================================================
-- Sakay: trip search from any map point
-- -----------------------------------------------------------------------------
-- Autocomplete now also offers places from OpenStreetMap (via the Photon
-- geocoder) that aren't in Sakay yet, e.g. "National Shrine of Saint Anne,
-- Hagonoy". Those have coordinates but no row in `places`, so the trip finder
-- gets a coordinate-based entry point. The uuid version now just looks up the
-- two places and calls it, so both always behave the same.
-- =============================================================================

create or replace function public.find_trips_at(
  p_from_lat double precision, p_from_lng double precision, p_to_lat double precision, p_to_lng double precision,
  p_max_legs integer default 4, p_limit integer default 8, p_radius integer default 500
) returns jsonb
language sql stable security definer set search_path = ''
as $$
with recursive
cfg as (
  select least(greatest(coalesce(p_max_legs, 4), 1), 5) as max_rides,
         least(greatest(coalesce(p_radius, 500), 100), 3000)::double precision as radius
),
ends as (
  select p_from_lat as olat, p_from_lng as olng, p_to_lat as dlat, p_to_lng as dlng
  where p_from_lat between 4 and 22 and p_to_lat between 4 and 22
    and p_from_lng between 116 and 127 and p_to_lng between 116 and 127
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

create or replace function public.find_trips(
  p_origin uuid, p_destination uuid, p_max_legs integer default 4, p_limit integer default 8, p_radius integer default 500
) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select public.find_trips_at(o.lat, o.lng, d.lat, d.lng, p_max_legs, p_limit, p_radius)
     from public.places o, public.places d
     where o.id = p_origin and d.id = p_destination),
    '[]'::jsonb)
$$;

revoke all on function public.find_trips_at(double precision, double precision, double precision, double precision, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.find_trips_at(double precision, double precision, double precision, double precision, integer, integer, integer) to anon, authenticated;
revoke all on function public.find_trips(uuid, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.find_trips(uuid, uuid, integer, integer, integer) to anon, authenticated;
