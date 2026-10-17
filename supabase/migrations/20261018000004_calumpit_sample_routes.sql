-- =============================================================================
-- Sakay: Calumpit starter routes
-- Reported: "Calumpit -> Bulacan State University" found nothing. OpenStreetMap
-- has no mapped jeepney/bus line within 2 km of Calumpit (only NLEX buses that
-- don't stop there), so the MacArthur Highway jeep is added as a SAMPLE route
-- (fares/times are estimates; riders confirm or report them).
-- =============================================================================

create or replace function pg_temp.sid(p_key text) returns uuid language sql immutable as $$
  select md5('sakay-sample:' || p_key)::uuid
$$;

insert into public.places (id, name, aliases, kind, city, lat, lng, modes, hours_open, hours_close, hours_note, is_verified, description) values
  (pg_temp.sid('calumpit'), 'Calumpit (Town Proper / Public Market)', '{"Calumpit","Calumpit Bulacan","Calumpit market","Calumpit town hall"}', 'terminal', 'Calumpit', 14.9152, 120.7662, '{jeepney,tricycle}', '04:30', '21:00', 'Jeeps to Malolos along MacArthur Highway', true, null),
  (pg_temp.sid('malolos-mcarthur-sumapang'), 'MacArthur Highway – Sumapang Matanda (Malolos)', '{"Sumapang Matanda","Sumapang"}', 'landmark', 'Malolos', 14.8730, 120.8080, '{jeepney}', null, null, null, true, null)
on conflict (id) do nothing;

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

select pg_temp.add_route('calumpit-bulsu', 'Calumpit to BulSU by jeep (MacArthur Highway)',
  'Southbound jeepney along MacArthur Highway; get off at the Bulacan State University main gate.', '4:30 AM - 9:00 PM',
  false, false, false, null,
  '[{"mode":"jeepney","from":"calumpit","to":"bulsu","sign":"CALUMPIT - MALOLOS","fare":20,"min":25,"how":"Ride at the jeepney stop near Calumpit public market (southbound side of MacArthur Highway). Tell the driver \"BulSU po\"."}]');

select pg_temp.add_route('calumpit-crossing', 'Calumpit to Malolos Crossing by jeep',
  'Same MacArthur Highway jeep, all the way to the Malolos Crossing terminal.', '4:30 AM - 9:00 PM',
  false, false, false, null,
  '[{"mode":"jeepney","from":"calumpit","to":"malolos-crossing","sign":"CALUMPIT - MALOLOS","fare":22,"min":32,"how":"Southbound side of MacArthur Highway; last stop is Malolos Crossing."}]');

select pg_temp.add_route('sumapang-bulsu', 'Sumapang (Malolos) to BulSU by jeep',
  'Short MacArthur Highway jeep ride to BulSU.', '5:00 AM - 9:00 PM',
  false, false, false, null,
  '[{"mode":"jeepney","from":"malolos-mcarthur-sumapang","to":"bulsu","sign":"MALOLOS / CROSSING","fare":13,"min":8}]');
