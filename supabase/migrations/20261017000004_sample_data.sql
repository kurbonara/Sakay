-- =============================================================================
-- Sakay: starter data for Metro Manila
-- -----------------------------------------------------------------------------
-- Real landmarks/stations with approximate coordinates, plus SAMPLE routes so
-- the app is useful on day one. Sample routes are flagged `is_sample = true`
-- and shown with a "Sample - please verify" badge. Fares and travel times are
-- rough estimates; the community confirms or reports them, and moderators can
-- edit or archive them from the admin dashboard.
-- IDs are deterministic (md5 of a key) so later migrations can reference them.
-- =============================================================================

create function pg_temp.sid(p_key text) returns uuid language sql immutable as $$
  select md5('sakay-sample:' || p_key)::uuid
$$;

insert into public.places (id, name, aliases, kind, city, lat, lng, modes, hours_open, hours_close, hours_note, is_verified, description) values
  -- Landmarks
  (pg_temp.sid('sm-north'), 'SM North EDSA', '{"SM North","SM City North EDSA","The Block"}', 'mall', 'Quezon City', 14.6565, 121.0290, '{}', null, null, null, true, 'Jeepneys load at the terminal beside The Block.'),
  (pg_temp.sid('trinoma'), 'TriNoma', '{"Trinoma Mall"}', 'mall', 'Quezon City', 14.6535, 121.0335, '{}', null, null, null, true, null),
  (pg_temp.sid('up-diliman'), 'UP Diliman (Quezon Hall)', '{"UP","University of the Philippines Diliman","Oblation","UP Campus"}', 'school', 'Quezon City', 14.6549, 121.0645, '{}', null, null, null, true, null),
  (pg_temp.sid('philcoa'), 'Philcoa', '{"Philcoa terminal","Commonwealth Philcoa"}', 'terminal', 'Quezon City', 14.6537, 121.0526, '{jeepney,uv_express}', '05:00', '23:00', 'Jeepneys to UP, Fairview and Cubao', true, 'Busy loading area at the corner of Commonwealth Ave and Elliptical Rd.'),
  (pg_temp.sid('qc-circle'), 'Quezon Memorial Circle', '{"QC Circle","Quezon City Circle"}', 'landmark', 'Quezon City', 14.6514, 121.0493, '{}', null, null, null, true, null),
  (pg_temp.sid('ateneo'), 'Ateneo de Manila University (Gate 2)', '{"Ateneo","ADMU","Katipunan Ateneo"}', 'school', 'Quezon City', 14.6397, 121.0781, '{}', null, null, null, true, null),
  (pg_temp.sid('gateway'), 'Araneta City (Gateway Mall)', '{"Cubao","Gateway","Araneta Center","Ali Mall"}', 'mall', 'Quezon City', 14.6211, 121.0532, '{}', null, null, null, true, null),
  (pg_temp.sid('cubao-busport'), 'Araneta City Bus Port', '{"Cubao Bus Port","Cubao bus terminal"}', 'terminal', 'Quezon City', 14.6197, 121.0563, '{bus,uv_express}', '04:00', '23:00', 'City and provincial buses, UV Express', true, null),
  (pg_temp.sid('ust'), 'University of Santo Tomas (España gate)', '{"UST","Santo Tomas","España"}', 'school', 'Manila', 14.6096, 120.9894, '{}', null, null, null, true, null),
  (pg_temp.sid('quiapo'), 'Quiapo Church', '{"Quiapo","Minor Basilica of the Black Nazarene","Plaza Miranda"}', 'church', 'Manila', 14.5986, 120.9839, '{}', null, null, null, true, null),
  (pg_temp.sid('lawton'), 'Lawton (Liwasang Bonifacio)', '{"Lawton","Liwasang Bonifacio","Park N Ride"}', 'terminal', 'Manila', 14.5946, 120.9810, '{bus,jeepney}', '05:00', '22:00', 'Buses to PITX and Cavite; jeepneys to Quiapo/Divisoria', true, null),
  (pg_temp.sid('pup'), 'PUP Sta. Mesa (Main Campus)', '{"PUP","Polytechnic University of the Philippines","Sta. Mesa"}', 'school', 'Manila', 14.5979, 121.0108, '{}', null, null, null, true, null),
  (pg_temp.sid('megamall'), 'SM Megamall', '{"Megamall","Ortigas"}', 'mall', 'Mandaluyong', 14.5848, 121.0565, '{}', null, null, null, true, null),
  (pg_temp.sid('glorietta'), 'Ayala Center (Glorietta)', '{"Ayala","Glorietta","Makati CBD","Greenbelt"}', 'mall', 'Makati', 14.5509, 121.0254, '{}', null, null, null, true, null),
  (pg_temp.sid('one-ayala'), 'One Ayala Terminal', '{"One Ayala","Ayala bus terminal"}', 'terminal', 'Makati', 14.5497, 121.0277, '{bus,jeepney}', '05:00', '23:00', 'P2P and city buses, jeepneys', true, null),
  (pg_temp.sid('mckinley-exchange'), 'BGC Bus EDSA Ayala Terminal (McKinley Exchange)', '{"BGC Bus terminal","McKinley Exchange","EDSA Ayala"}', 'terminal', 'Makati', 14.5487, 121.0293, '{bus}', '06:00', '22:00', 'BGC Bus routes to Bonifacio Global City', true, null),
  (pg_temp.sid('market-market'), 'Market! Market!', '{"Market Market","BGC","Bonifacio Global City"}', 'mall', 'Taguig', 14.5495, 121.0560, '{}', null, null, null, true, null),
  (pg_temp.sid('moa'), 'SM Mall of Asia', '{"MOA","Mall of Asia","SM MOA"}', 'mall', 'Pasay', 14.5352, 120.9822, '{}', null, null, null, true, null),
  (pg_temp.sid('pitx'), 'Parañaque Integrated Terminal Exchange (PITX)', '{"PITX","Paranaque terminal"}', 'terminal', 'Parañaque', 14.5102, 120.9915, '{bus,jeepney,uv_express}', '00:00', '00:00', 'Open 24 hours', true, 'Landport for buses to Cavite, Batangas and the provinces.'),
  (pg_temp.sid('baclaran'), 'Baclaran Church', '{"Baclaran","Redemptorist Church"}', 'church', 'Parañaque', 14.5323, 120.9984, '{}', null, null, null, true, null),
  (pg_temp.sid('dlsu'), 'De La Salle University (Taft)', '{"DLSU","La Salle","Taft"}', 'school', 'Manila', 14.5649, 120.9932, '{}', null, null, null, true, null),
  (pg_temp.sid('sm-fairview'), 'SM City Fairview', '{"SM Fairview","Fairview"}', 'mall', 'Quezon City', 14.7343, 121.0573, '{}', null, null, null, true, null),
  (pg_temp.sid('fairview-terminal'), 'SM Fairview Transport Terminal', '{"Fairview terminal"}', 'terminal', 'Quezon City', 14.7338, 121.0583, '{jeepney,uv_express,bus}', '04:30', '23:00', 'Jeepneys to Philcoa/Quiapo, UV Express to Cubao', true, null),
  (pg_temp.sid('riverbanks'), 'Marikina Riverbanks Center', '{"Riverbanks","Marikina"}', 'mall', 'Marikina', 14.6316, 121.0830, '{}', null, null, null, true, null),
  (pg_temp.sid('alabang'), 'Alabang Town Center', '{"ATC","Alabang"}', 'mall', 'Muntinlupa', 14.4232, 121.0303, '{}', null, null, null, true, null),
  -- MRT-3
  (pg_temp.sid('mrt-north'), 'MRT-3 North Avenue Station', '{"North Ave station","North Avenue"}', 'station', 'Quezon City', 14.6522, 121.0323, '{train}', '04:30', '22:30', null, true, null),
  (pg_temp.sid('mrt-cubao'), 'MRT-3 Araneta Center-Cubao Station', '{"MRT Cubao","Cubao MRT"}', 'station', 'Quezon City', 14.6195, 121.0511, '{train}', '04:30', '22:30', null, true, null),
  (pg_temp.sid('mrt-ortigas'), 'MRT-3 Ortigas Station', '{"MRT Ortigas"}', 'station', 'Mandaluyong', 14.5878, 121.0567, '{train}', '04:30', '22:30', null, true, null),
  (pg_temp.sid('mrt-ayala'), 'MRT-3 Ayala Station', '{"MRT Ayala","Ayala station"}', 'station', 'Makati', 14.5491, 121.0280, '{train}', '04:30', '22:30', null, true, null),
  (pg_temp.sid('mrt-taft'), 'MRT-3 Taft Avenue Station', '{"MRT Taft","EDSA Taft","Taft Avenue"}', 'station', 'Pasay', 14.5376, 121.0014, '{train}', '04:30', '22:30', null, true, null),
  -- LRT-2
  (pg_temp.sid('lrt2-recto'), 'LRT-2 Recto Station', '{"Recto","LRT2 Recto"}', 'station', 'Manila', 14.6035, 120.9837, '{train}', '04:30', '22:00', null, true, null),
  (pg_temp.sid('lrt2-legarda'), 'LRT-2 Legarda Station', '{"Legarda"}', 'station', 'Manila', 14.6010, 120.9925, '{train}', '04:30', '22:00', null, true, null),
  (pg_temp.sid('lrt2-pureza'), 'LRT-2 Pureza Station', '{"Pureza"}', 'station', 'Manila', 14.6017, 121.0052, '{train}', '04:30', '22:00', null, true, null),
  (pg_temp.sid('lrt2-cubao'), 'LRT-2 Araneta Center-Cubao Station', '{"LRT2 Cubao","Cubao LRT"}', 'station', 'Quezon City', 14.6227, 121.0527, '{train}', '04:30', '22:00', null, true, null),
  (pg_temp.sid('lrt2-katipunan'), 'LRT-2 Katipunan Station', '{"Katipunan station","Katipunan"}', 'station', 'Quezon City', 14.6310, 121.0726, '{train}', '04:30', '22:00', null, true, null),
  (pg_temp.sid('lrt2-santolan'), 'LRT-2 Santolan Station', '{"Santolan"}', 'station', 'Pasig', 14.6221, 121.0860, '{train}', '04:30', '22:00', null, true, null),
  -- LRT-1
  (pg_temp.sid('lrt1-monumento'), 'LRT-1 Monumento Station', '{"Monumento","Caloocan"}', 'station', 'Caloocan', 14.6543, 120.9839, '{train}', '04:30', '22:15', null, true, null),
  (pg_temp.sid('lrt1-carriedo'), 'LRT-1 Carriedo Station', '{"Carriedo"}', 'station', 'Manila', 14.5990, 120.9813, '{train}', '04:30', '22:15', null, true, null),
  (pg_temp.sid('lrt1-vitocruz'), 'LRT-1 Vito Cruz Station', '{"Vito Cruz"}', 'station', 'Manila', 14.5633, 120.9947, '{train}', '04:30', '22:15', null, true, null),
  (pg_temp.sid('lrt1-edsa'), 'LRT-1 EDSA Station', '{"LRT EDSA","EDSA Taft LRT"}', 'station', 'Pasay', 14.5387, 121.0006, '{train}', '04:30', '22:15', null, true, null);

-- Routes ---------------------------------------------------------------------
create function pg_temp.add_route(
  p_key text, p_title text, p_summary text, p_hours text,
  p_pwd boolean, p_senior boolean, p_heavy boolean, p_access_notes text, p_legs jsonb
) returns void language plpgsql as $$
declare
  v_id uuid := pg_temp.sid('route:' || p_key);
  v_leg jsonb;
  v_seq integer := 0;
begin
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

select pg_temp.add_route('smnorth-up', 'SM North EDSA to UP Diliman by jeep',
  'Direct jeepney from the SM North terminal straight into the UP campus.', '5:00 AM - 10:00 PM',
  false, false, false, 'Jeepneys have a high step and narrow aisle.',
  '[{"mode":"jeepney","from":"sm-north","to":"up-diliman","sign":"UP CAMPUS / SM NORTH","fare":13,"min":25,"how":"Ride at the jeepney terminal beside The Block. Tell the driver you are getting off at Quezon Hall."}]');

select pg_temp.add_route('philcoa-up', 'Philcoa to UP Diliman (UP-Philcoa jeep)',
  'Short jeepney ride from Philcoa into campus. Loads continuously during school days.', '5:00 AM - 11:00 PM',
  false, false, false, null,
  '[{"mode":"jeepney","from":"philcoa","to":"up-diliman","sign":"UP - PHILCOA","fare":13,"min":10,"how":"Load at the Philcoa side of Commonwealth Ave (in front of the bank strip)."}]');

select pg_temp.add_route('smnorth-cubao-mrt', 'SM North EDSA to Cubao via MRT-3',
  'Walk to North Avenue station, then MRT-3 southbound to Araneta Center-Cubao.', '4:30 AM - 10:30 PM',
  true, true, false, 'Elevators and escalators at most stations, but some may be under maintenance. Avoid rush hour (7-9 AM, 5-8 PM) if carrying heavy bags.',
  '[{"mode":"walk","from":"sm-north","to":"mrt-north","fare":0,"min":6,"how":"Walk through the SM North - TriNoma link bridge to North Avenue station."},
    {"mode":"train","from":"mrt-north","to":"mrt-cubao","sign":"MRT-3 Southbound (to Taft Avenue)","fare":16,"min":12,"how":"Get off at Araneta Center-Cubao (3 stops)."},
    {"mode":"walk","from":"mrt-cubao","to":"gateway","fare":0,"min":5,"how":"Take the Gateway Mall exit."}]');

select pg_temp.add_route('cubao-ayala-mrt', 'Cubao to Ayala (Makati) via MRT-3',
  'MRT-3 southbound from Cubao to Ayala station, then walk to Glorietta.', '4:30 AM - 10:30 PM',
  true, true, false, 'Ayala station connects to the malls through covered walkways.',
  '[{"mode":"walk","from":"gateway","to":"mrt-cubao","fare":0,"min":5},
    {"mode":"train","from":"mrt-cubao","to":"mrt-ayala","sign":"MRT-3 Southbound (to Taft Avenue)","fare":24,"min":22,"how":"Get off at Ayala (8 stops)."},
    {"mode":"walk","from":"mrt-ayala","to":"glorietta","fare":0,"min":6,"how":"Follow the signs to Glorietta / Ayala Center."}]');

select pg_temp.add_route('ayala-bgc', 'Ayala MRT to BGC (Market! Market!) by BGC Bus',
  'Walk from Ayala station to the McKinley Exchange terminal and ride the BGC Bus.', '6:00 AM - 10:00 PM',
  true, true, true, 'Low-floor buses on most trips. The terminal has ramps.',
  '[{"mode":"walk","from":"mrt-ayala","to":"mckinley-exchange","fare":0,"min":5,"how":"Exit toward EDSA northbound; the terminal is under the McKinley Exchange building."},
    {"mode":"bus","from":"mckinley-exchange","to":"market-market","sign":"BGC BUS - EDSA AYALA / MARKET! MARKET!","fare":15,"min":20,"how":"Pay with beep card. Get off at the Market! Market! stop."}]');

select pg_temp.add_route('cubao-ust-lrt2', 'Cubao to UST via LRT-2',
  'LRT-2 westbound from Cubao to Legarda, then a short walk to UST.', '4:30 AM - 10:00 PM',
  true, true, false, 'LRT-2 stations have elevators. The walk from Legarda to UST is about 700 m on a busy sidewalk.',
  '[{"mode":"walk","from":"gateway","to":"lrt2-cubao","fare":0,"min":4},
    {"mode":"train","from":"lrt2-cubao","to":"lrt2-legarda","sign":"LRT-2 Westbound (to Recto)","fare":25,"min":15,"how":"Get off at Legarda (6 stops)."},
    {"mode":"walk","from":"lrt2-legarda","to":"ust","fare":0,"min":10,"how":"Walk along Legarda St toward España Blvd."}]');

select pg_temp.add_route('ateneo-recto', 'Ateneo (Katipunan) to Recto via LRT-2',
  'Jeep down Katipunan to the LRT-2 station, then the train all the way to Recto.', '5:00 AM - 10:00 PM',
  false, true, false, null,
  '[{"mode":"jeepney","from":"ateneo","to":"lrt2-katipunan","sign":"CUBAO via KATIPUNAN","fare":13,"min":7,"how":"Ride southbound along Katipunan Ave; get off at the LRT-2 Katipunan station."},
    {"mode":"train","from":"lrt2-katipunan","to":"lrt2-recto","sign":"LRT-2 Westbound (to Recto)","fare":35,"min":25,"how":"Ride to the last station (Recto)."}]');

select pg_temp.add_route('up-ateneo', 'UP Diliman to Ateneo (UP-Katipunan jeep)',
  'Jeep from inside UP to Katipunan Avenue in front of Ateneo.', '6:00 AM - 9:00 PM',
  false, false, false, null,
  '[{"mode":"jeepney","from":"up-diliman","to":"ateneo","sign":"UP - KATIPUNAN","fare":13,"min":12,"how":"Wait at the waiting shed near Quezon Hall."}]');

select pg_temp.add_route('monumento-quiapo', 'Monumento to Quiapo via LRT-1',
  'LRT-1 southbound from Monumento to Carriedo, then walk to Quiapo Church.', '4:30 AM - 10:15 PM',
  true, true, false, 'Carriedo station exit has stairs; use the elevator on the southbound side.',
  '[{"mode":"train","from":"lrt1-monumento","to":"lrt1-carriedo","sign":"LRT-1 Southbound (to Dr. Santos)","fare":25,"min":15,"how":"Get off at Carriedo."},
    {"mode":"walk","from":"lrt1-carriedo","to":"quiapo","fare":0,"min":5,"how":"Walk along Carriedo St to Plaza Miranda."}]');

select pg_temp.add_route('quiapo-pup', 'Quiapo to PUP Sta. Mesa by jeep',
  'Jeepney from Quiapo along Legarda/Magsaysay Blvd to PUP.', '5:00 AM - 10:00 PM',
  false, false, false, null,
  '[{"mode":"jeepney","from":"quiapo","to":"pup","sign":"STOP & SHOP / STA. MESA","fare":13,"min":20,"how":"Ride along Quezon Blvd underpass side; get off at the PUP main gate on Teresa St."}]');

select pg_temp.add_route('pitx-quiapo', 'PITX to Quiapo (bus + jeep)',
  'City bus from PITX to Lawton, then jeepney to Quiapo.', '24 hours (fewer trips after 10 PM)',
  false, false, true, 'Buses have luggage space; the jeepney leg is cramped during rush hour.',
  '[{"mode":"bus","from":"pitx","to":"lawton","sign":"PITX - LAWTON","fare":20,"min":45,"how":"Board at the PITX city bus gates (Level 1)."},
    {"mode":"jeepney","from":"lawton","to":"quiapo","sign":"QUIAPO","fare":13,"min":10,"how":"Cross to the jeepney stop near the Post Office."}]');

select pg_temp.add_route('taft-moa', 'EDSA Taft to SM Mall of Asia by jeep',
  'Jeepney from the EDSA-Taft rotonda to MOA.', '5:00 AM - 11:00 PM',
  false, false, false, null,
  '[{"mode":"walk","from":"mrt-taft","to":"lrt1-edsa","fare":0,"min":4,"how":"Go down to the EDSA-Taft rotonda (LRT-1 EDSA side)."},
    {"mode":"jeepney","from":"lrt1-edsa","to":"moa","sign":"MOA / EDSA TAFT","fare":13,"min":15,"how":"Get off at the MOA jeepney terminal."}]');

select pg_temp.add_route('fairview-philcoa', 'SM Fairview to Philcoa by jeep',
  'Long jeepney ride down Commonwealth Avenue.', '4:30 AM - 11:00 PM',
  false, false, false, 'Commonwealth Ave gets very slow from 6-9 AM going south.',
  '[{"mode":"walk","from":"sm-fairview","to":"fairview-terminal","fare":0,"min":4},
    {"mode":"jeepney","from":"fairview-terminal","to":"philcoa","sign":"FAIRVIEW - PHILCOA via COMMONWEALTH","fare":25,"min":40}]');

select pg_temp.add_route('fairview-cubao-uv', 'SM Fairview to Cubao by UV Express',
  'Air-conditioned UV Express from the Fairview terminal to Cubao.', '5:00 AM - 10:00 PM',
  false, true, true, 'Seated trips only; space for one bag on your lap or the rear.',
  '[{"mode":"walk","from":"sm-fairview","to":"fairview-terminal","fare":0,"min":4},
    {"mode":"uv_express","from":"fairview-terminal","to":"cubao-busport","sign":"FAIRVIEW - CUBAO","fare":45,"min":50}]');

select pg_temp.add_route('cubao-riverbanks', 'Cubao to Marikina Riverbanks (LRT-2 + tricycle)',
  'LRT-2 eastbound to Santolan, then a tricycle to Riverbanks.', '4:30 AM - 10:00 PM',
  false, true, false, null,
  '[{"mode":"walk","from":"gateway","to":"lrt2-cubao","fare":0,"min":4},
    {"mode":"train","from":"lrt2-cubao","to":"lrt2-santolan","sign":"LRT-2 Eastbound (to Antipolo)","fare":20,"min":10},
    {"mode":"tricycle","from":"lrt2-santolan","to":"riverbanks","sign":"RIVERBANKS (shared)","fare":30,"min":10,"how":"Shared tricycle from the station exit; ask for Riverbanks."}]');

select pg_temp.add_route('megamall-ayala', 'SM Megamall (Ortigas) to Ayala via MRT-3',
  'Walk to Ortigas station and ride MRT-3 southbound to Ayala.', '4:30 AM - 10:30 PM',
  true, true, false, null,
  '[{"mode":"walk","from":"megamall","to":"mrt-ortigas","fare":0,"min":6,"how":"Use the Megamall - MRT walkway."},
    {"mode":"train","from":"mrt-ortigas","to":"mrt-ayala","sign":"MRT-3 Southbound (to Taft Avenue)","fare":20,"min":14},
    {"mode":"walk","from":"mrt-ayala","to":"glorietta","fare":0,"min":6}]');

select pg_temp.add_route('alabang-ayala', 'Alabang to Ayala (Makati) by bus',
  'Point-to-point bus from Alabang Town Center to One Ayala.', '5:30 AM - 9:00 PM',
  false, true, true, 'Reclining seats; luggage under the bus on some units.',
  '[{"mode":"bus","from":"alabang","to":"one-ayala","sign":"AYALA - ALABANG (P2P)","fare":75,"min":50,"how":"Board at the ATC P2P bay near the Corte de las Palmas entrance."},
    {"mode":"walk","from":"one-ayala","to":"glorietta","fare":0,"min":4}]');

select pg_temp.add_route('dlsu-quiapo', 'DLSU (Taft) to Quiapo via LRT-1',
  'LRT-1 northbound from Vito Cruz to Carriedo.', '4:30 AM - 10:15 PM',
  true, true, false, null,
  '[{"mode":"walk","from":"dlsu","to":"lrt1-vitocruz","fare":0,"min":4},
    {"mode":"train","from":"lrt1-vitocruz","to":"lrt1-carriedo","sign":"LRT-1 Northbound (to Fernando Poe Jr.)","fare":20,"min":10},
    {"mode":"walk","from":"lrt1-carriedo","to":"quiapo","fare":0,"min":5}]');

select pg_temp.add_route('baclaran-lawton', 'Baclaran to Lawton by jeep (via Taft)',
  'Jeepney along Taft Avenue from Baclaran to Lawton.', '4:00 AM - 11:00 PM',
  false, false, false, null,
  '[{"mode":"jeepney","from":"baclaran","to":"lawton","sign":"BACLARAN - DIVISORIA via TAFT","fare":15,"min":35}]');

insert into public.advisories (title, body, kind, severity, area, starts_at, ends_at) values
  ('Sakay is new: help verify the sample routes',
   'Routes marked "Sample" were added to get things started. If you ride one, tap "Still accurate" or report what changed so other commuters get correct fares and times.',
   'other', 'info', 'Metro Manila', now(), now() + interval '60 days');
