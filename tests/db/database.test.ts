import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { freshDb, migrationFiles, rejects, sampleId, type TestDb } from "./helpers.ts";

type Json = Record<string, unknown>;

// Shared fixture: one database, a few people with different roles.
let t: TestDb;
let alice: string; // member
let bob: string; // member
let mod: string; // moderator
let admin: string; // admin
let early: string; // existed before migrations ran

const S = sampleId;

async function submitSimpleRoute(user: string, title = "SM North to TriNoma walk test"): Promise<string> {
  const rows = await t.as<{ id: string }>(user, `select public.submit_route($1::jsonb) as id`, [
    JSON.stringify({
      title,
      summary: "test",
      legs: [{ mode: "jeepney", from_place_id: S("sm-north"), to_place_id: S("trinoma"), fare: 13, minutes: 5, signboard: "TEST" }],
    }),
  ]);
  return rows[0].id;
}

before(async () => {
  t = await freshDb({
    beforeMigrations: async (db) => {
      const r = await db.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data) values ('early.bird@gmail.com', '{"display_name":"Early Bird"}') returning id`,
      );
      early = r.rows[0].id;
    },
  });
  alice = await t.createUser("alice@gmail.com", { display_name: "Alice" });
  bob = await t.createUser("bob@yahoo.com");
  mod = await t.createUser("mod@sakay.ph");
  admin = await t.createUser("kurt.admin@gmail.com");
  await t.setRole(mod, "moderator");
  await t.setRole(admin, "admin");
});

describe("migrations", () => {
  it("apply in filename order and are all timestamped", () => {
    const files = migrationFiles();
    assert.ok(files.length >= 4);
    for (const f of files) assert.match(f, /^\d{14}_[a-z0-9_]+\.sql$/);
    assert.deepEqual([...files].sort(), files);
  });

  it("backfill profiles for accounts created before the schema existed", async () => {
    const [p] = await t.sql<Json>(`select username, display_name from public.profiles where id = $1`, [early]);
    assert.equal(p.display_name, "Early Bird");
    assert.equal(p.username, "earlybird");
  });

  it("create a profile for every new sign-up with a unique username", async () => {
    const twin = await t.createUser("alice@yahoo.com");
    const rows = await t.sql<Json>(`select username from public.profiles where id in ($1, $2)`, [alice, twin]);
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].username, rows[1].username);
  });

  it("add the live tables to the supabase_realtime publication", async () => {
    const rows = await t.sql<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime'`,
    );
    const names = rows.map((r) => r.tablename);
    for (const n of ["routes", "questions", "answers", "reports", "advisories", "route_comments"]) {
      assert.ok(names.includes(n), `${n} missing from publication`);
    }
  });

  it("pin search_path on every SECURITY DEFINER function", async () => {
    const rows = await t.sql<Json>(`
      select n.nspname || '.' || p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    assert.deepEqual(rows, []);
  });

  it("enable RLS on every public table", async () => {
    const rows = await t.sql<Json>(
      `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    assert.deepEqual(rows, []);
  });

  it("load the sample data with trigger-computed totals", async () => {
    const [r] = await t.sql<Json>(`select total_fare, total_fare_discounted, total_minutes, leg_count from public.routes where id = $1`, [
      S("route:smnorth-cubao-mrt"),
    ]);
    assert.equal(Number(r.total_fare), 16);
    assert.equal(Number(r.total_fare_discounted), 12.8);
    assert.equal(r.total_minutes, 23);
    assert.equal(r.leg_count, 3);
  });
});

describe("profiles", () => {
  it("are readable by anyone", async () => {
    const rows = await t.as(null, `select username from public.profiles where id = $1`, [alice]);
    assert.equal(rows.length, 1);
  });

  it("let members edit their own name and bio", async () => {
    await t.as(alice, `update public.profiles set display_name = 'Alice R.', bio = 'Commuter from QC' where id = $1`, [alice]);
    const [p] = await t.sql<Json>(`select display_name, bio from public.profiles where id = $1`, [alice]);
    assert.equal(p.display_name, "Alice R.");
  });

  it("never let members give themselves a role, points or unban themselves", async () => {
    await rejects(t.as(alice, `update public.profiles set role = 'admin' where id = $1`, [alice]), /permission denied/);
    await rejects(t.as(alice, `update public.profiles set points = 9999 where id = $1`, [alice]), /permission denied/);
    await rejects(t.as(alice, `update public.profiles set is_banned = false where id = $1`, [alice]), /permission denied/);
    const [p] = await t.sql<Json>(`select role, points from public.profiles where id = $1`, [alice]);
    assert.equal(p.role, "member");
  });

  it("can't be edited by other people", async () => {
    await t.as(bob, `update public.profiles set display_name = 'hacked' where id = $1`, [alice]);
    const [p] = await t.sql<Json>(`select display_name from public.profiles where id = $1`, [alice]);
    assert.notEqual(p.display_name, "hacked");
  });

  it("reject invalid usernames", async () => {
    await rejects(t.as(alice, `update public.profiles set username = 'Bad Name!' where id = $1`, [alice]), /check constraint/);
  });
});

describe("direct table writes are blocked", () => {
  it("for anon and members on every content table", async () => {
    await rejects(t.as(null, `insert into public.routes (title, origin_place_id, destination_place_id) values ('xxxxx', $1, $2)`, [S("sm-north"), S("ust")]), /permission denied/);
    await rejects(t.as(alice, `insert into public.questions (title, author_id) values ('direct insert attempt', $1)`, [alice]), /permission denied/);
    await rejects(t.as(alice, `update public.routes set status = 'published'`), /permission denied/);
    await rejects(t.as(alice, `update public.answers set score = 100`), /permission denied/);
    await rejects(t.as(alice, `insert into public.audit_log (action) values ('fake')`), /permission denied/);
    await rejects(t.as(mod, `delete from public.reports`), /permission denied/);
  });

  it("and members cannot call staff-only internals directly", async () => {
    await rejects(t.as(alice, `select private.add_points($1, 1000)`, [alice]), /permission denied/);
  });

  it("anon cannot call member RPCs", async () => {
    await rejects(t.as(null, `select public.toggle_save_route($1)`, [S("route:smnorth-up")]), /permission denied/);
  });
});

describe("route submission and moderation", () => {
  let routeId: string;

  it("creates a pending route that only the submitter and staff can see", async () => {
    routeId = await submitSimpleRoute(alice);
    assert.equal((await t.as(alice, `select id from public.routes where id = $1`, [routeId])).length, 1);
    assert.equal((await t.as(bob, `select id from public.routes where id = $1`, [routeId])).length, 0);
    assert.equal((await t.as(null, `select id from public.route_legs where route_id = $1`, [routeId])).length, 0);
    assert.equal((await t.as(mod, `select id from public.routes where id = $1`, [routeId])).length, 1);
  });

  it("validates that legs connect", async () => {
    await rejects(
      t.as(alice, `select public.submit_route($1::jsonb)`, [
        JSON.stringify({
          title: "Broken chain route",
          legs: [
            { mode: "jeepney", from_place_id: S("sm-north"), to_place_id: S("trinoma"), fare: 13, minutes: 5 },
            { mode: "jeepney", from_place_id: S("philcoa"), to_place_id: S("up-diliman"), fare: 13, minutes: 5 },
          ],
        }),
      ]),
      /Leg 2 must start where leg 1 ends/,
    );
  });

  it("refuses moderation from members and logs the rejected attempt", async () => {
    const [r] = await t.as<{ r: Json }>(bob, `select public.moderate_route($1, 'publish') as r`, [routeId]);
    assert.equal(r.r.ok, false);
    const [s] = await t.sql<Json>(`select status from public.routes where id = $1`, [routeId]);
    assert.equal(s.status, "pending");
    const logs = await t.sql<Json>(`select success, actor_id from public.audit_log where action = 'route.moderate' and target_id = $1`, [routeId]);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].success, false);
    assert.equal(logs[0].actor_id, bob);
  });

  it("requires a note when rejecting", async () => {
    const [r] = await t.as<{ r: Json }>(mod, `select public.moderate_route($1, 'reject', '') as r`, [routeId]);
    assert.equal(r.r.ok, false);
  });

  it("publishes, rewards the contributor and records who approved it", async () => {
    const before = (await t.sql<Json>(`select points, routes_published_count from public.profiles where id = $1`, [alice]))[0];
    const [r] = await t.as<{ r: Json }>(mod, `select public.moderate_route($1, 'publish', 'Looks good') as r`, [routeId]);
    assert.equal(r.r.ok, true);
    const [route] = await t.sql<Json>(`select status, reviewed_by, published_at from public.routes where id = $1`, [routeId]);
    assert.equal(route.status, "published");
    assert.equal(route.reviewed_by, mod);
    assert.ok(route.published_at);
    const after = (await t.sql<Json>(`select points, routes_published_count from public.profiles where id = $1`, [alice]))[0];
    assert.equal(Number(after.points) - Number(before.points), 20);
    assert.equal(Number(after.routes_published_count) - Number(before.routes_published_count), 1);
    assert.equal((await t.as(null, `select id from public.routes where id = $1`, [routeId])).length, 1);
  });

  it("takes the points back when a published route is archived", async () => {
    const before = (await t.sql<Json>(`select points from public.profiles where id = $1`, [alice]))[0];
    await t.as(mod, `select public.moderate_route($1, 'archive', 'Jeep line discontinued')`, [routeId]);
    const after = (await t.sql<Json>(`select points from public.profiles where id = $1`, [alice]))[0];
    assert.equal(Number(before.points) - Number(after.points), 20);
    await t.as(mod, `select public.moderate_route($1, 'publish')`, [routeId]);
  });

  it("lets staff edit route data and recomputes totals", async () => {
    const [r] = await t.as<{ r: Json }>(mod, `select public.admin_update_route($1, $2::jsonb) as r`, [
      routeId,
      JSON.stringify({
        title: "SM North to TriNoma (edited)",
        legs: [
          { mode: "walk", from_place_id: S("sm-north"), to_place_id: S("trinoma"), fare: 0, minutes: 8 },
          { mode: "jeepney", from_place_id: S("trinoma"), to_place_id: S("philcoa"), fare: 13, minutes: 12 },
        ],
      }),
    ]);
    assert.equal(r.r.ok, true);
    const [route] = await t.sql<Json>(`select title, total_minutes, leg_count, destination_place_id from public.routes where id = $1`, [routeId]);
    assert.equal(route.total_minutes, 20);
    assert.equal(route.leg_count, 2);
    assert.equal(route.destination_place_id, S("philcoa"));
  });

  it("rate-limits route submissions per day", async () => {
    for (let i = 0; i < 9; i++) await submitSimpleRoute(bob, `Rate limit route number ${i}`);
    await submitSimpleRoute(bob, "Rate limit route number 9");
    await rejects(submitSimpleRoute(bob, "Rate limit route number 10"), /too often/);
  });

  it("publishes staff submissions immediately (and logs it)", async () => {
    const id = await submitSimpleRoute(mod, "Moderator submitted route");
    const [r] = await t.sql<Json>(`select status from public.routes where id = $1`, [id]);
    assert.equal(r.status, "published");
  });
});

describe("member-suggested places", () => {
  it("stay private until a route using them is published", async () => {
    const [{ id }] = await t.as<{ id: string }>(alice, `select public.suggest_place('Kanto ni Aling Nena', 'landmark', 14.65, 121.03) as id`);
    assert.equal((await t.as(bob, `select id from public.places where id = $1`, [id])).length, 0);
    assert.equal((await t.as(alice, `select id from public.places where id = $1`, [id])).length, 1);
    const [{ rid }] = await t.as<{ rid: string }>(alice, `select public.submit_route($1::jsonb) as rid`, [
      JSON.stringify({ title: "Aling Nena to SM North", legs: [{ mode: "tricycle", from_place_id: id, to_place_id: S("sm-north"), fare: 20, minutes: 5 }] }),
    ]);
    await t.as(mod, `select public.moderate_route($1, 'publish')`, [rid]);
    assert.equal((await t.as(bob, `select id from public.places where id = $1`, [id])).length, 1);
  });

  it("reject pins outside the Philippines", async () => {
    await rejects(t.as(alice, `select public.suggest_place('Somewhere', 'landmark', 40.0, -74.0)`), /check constraint/);
  });
});

describe("confirmations and saves", () => {
  const route = S("route:smnorth-up");

  it("count 'still accurate' once per person and switch cleanly", async () => {
    await t.as(alice, `select public.confirm_route($1, true)`, [route]);
    await t.as(alice, `select public.confirm_route($1, true)`, [route]);
    await t.as(bob, `select public.confirm_route($1, true)`, [route]);
    let [r] = await t.sql<Json>(`select still_accurate_count, outdated_count from public.routes where id = $1`, [route]);
    assert.equal(r.still_accurate_count, 2);
    await t.as(bob, `select public.confirm_route($1, false)`, [route]);
    [r] = await t.sql<Json>(`select still_accurate_count, outdated_count from public.routes where id = $1`, [route]);
    assert.equal(r.still_accurate_count, 1);
    assert.equal(r.outdated_count, 1);
  });

  it("keep each person's confirmation private but the counts public", async () => {
    assert.equal((await t.as(bob, `select * from public.route_confirmations where user_id = $1`, [alice])).length, 0);
    const [r] = await t.as<Json>(null, `select still_accurate_count from public.routes where id = $1`, [route]);
    assert.equal(r.still_accurate_count, 1);
  });

  it("toggle saves and keep save_count in sync", async () => {
    const [a] = await t.as<{ s: boolean }>(alice, `select public.toggle_save_route($1) as s`, [route]);
    assert.equal(a.s, true);
    await t.as(bob, `select public.toggle_save_route($1)`, [route]);
    let [r] = await t.sql<Json>(`select save_count from public.routes where id = $1`, [route]);
    assert.equal(r.save_count, 2);
    const [b] = await t.as<{ s: boolean }>(bob, `select public.toggle_save_route($1) as s`, [route]);
    assert.equal(b.s, false);
    [r] = await t.sql<Json>(`select save_count from public.routes where id = $1`, [route]);
    assert.equal(r.save_count, 1);
    assert.equal((await t.as(bob, `select * from public.route_saves`)).length, 0);
  });
});

describe("Q&A", () => {
  let q: string;
  let answerBob: string;
  let answerMod: string;

  it("asks a question and finds it as a duplicate for the same trip", async () => {
    const [r] = await t.as<{ id: string }>(alice, `select public.ask_question($1, $2, $3, $4, $5, $6) as id`, [
      "Paano pumunta from SM North to UP Diliman?",
      "First time going to UP",
      S("sm-north"),
      S("up-diliman"),
      "SM North EDSA",
      "UP Diliman",
    ]);
    q = r.id;
    const similar = await t.as<Json>(null, `select id from public.similar_questions($1, $2, $3)`, ["How to go to UP from SM North?", S("sm-north"), S("up-diliman")]);
    assert.ok(similar.some((s) => s.id === q));
    const byTitle = await t.as<Json>(null, `select id from public.similar_questions($1)`, ["Paano pumunta from SM North to UP"]);
    assert.ok(byTitle.some((s) => s.id === q));
  });

  it("is searchable with full-text search", async () => {
    const rows = await t.as<Json>(null, `select id from public.questions where search @@ websearch_to_tsquery('simple', 'diliman')`);
    assert.ok(rows.some((r) => r.id === q));
  });

  it("maintains answer_count and status", async () => {
    [{ id: answerBob }] = await t.as<{ id: string }>(bob, `select public.post_answer($1, 'Ride the UP CAMPUS jeep at The Block.') as id`, [q]);
    [{ id: answerMod }] = await t.as<{ id: string }>(mod, `select public.post_answer($1, 'Or MRT to Quezon Ave then jeep.') as id`, [q]);
    const [row] = await t.sql<Json>(`select answer_count, status from public.questions where id = $1`, [q]);
    assert.equal(row.answer_count, 2);
    assert.equal(row.status, "answered");
  });

  it("doesn't let people vote on their own answers", async () => {
    await rejects(t.as(bob, `select public.vote_answer($1, 1)`, [answerBob]), /own answer/);
  });

  it("keeps score and points consistent through vote changes", async () => {
    const p0 = Number((await t.sql<Json>(`select points from public.profiles where id = $1`, [bob]))[0].points);
    await t.as(alice, `select public.vote_answer($1, 1)`, [answerBob]);
    await t.as(alice, `select public.vote_answer($1, 1)`, [answerBob]); // idempotent
    await t.as(mod, `select public.vote_answer($1, 1)`, [answerBob]);
    let [a] = await t.sql<Json>(`select score from public.answers where id = $1`, [answerBob]);
    assert.equal(a.score, 2);
    await t.as(mod, `select public.vote_answer($1, -1)`, [answerBob]);
    [a] = await t.sql<Json>(`select score from public.answers where id = $1`, [answerBob]);
    assert.equal(a.score, 0);
    await t.as(mod, `select public.vote_answer($1, 0)`, [answerBob]);
    const p1 = Number((await t.sql<Json>(`select points from public.profiles where id = $1`, [bob]))[0].points);
    assert.equal(p1 - p0, 5); // one upvote remains
    const [u] = await t.sql<Json>(`select upvotes_received from public.profiles where id = $1`, [bob]);
    assert.equal(u.upvotes_received, 1);
  });

  it("only lets the asker or staff pick the best answer, logging refusals", async () => {
    const [r1] = await t.as<{ r: Json }>(bob, `select public.mark_best_answer($1) as r`, [answerBob]);
    assert.equal(r1.r.ok, false);
    const logs = await t.sql<Json>(`select success from public.audit_log where action = 'answer.mark_best' and actor_id = $1`, [bob]);
    assert.equal(logs[0].success, false);
    const [r2] = await t.as<{ r: Json }>(alice, `select public.mark_best_answer($1) as r`, [answerBob]);
    assert.equal(r2.r.ok, true);
    const [row] = await t.sql<Json>(`select best_answer_id from public.questions where id = $1`, [q]);
    assert.equal(row.best_answer_id, answerBob);
    const [p] = await t.sql<Json>(`select best_answers_count from public.profiles where id = $1`, [bob]);
    assert.equal(p.best_answers_count, 1);
  });

  it("switching the best answer moves the reward", async () => {
    await t.as(alice, `select public.mark_best_answer($1)`, [answerMod]);
    const rows = await t.sql<Json>(`select id, is_best from public.answers where question_id = $1 order by created_at`, [q]);
    assert.deepEqual(rows.map((r) => r.is_best), [false, true]);
    const [p] = await t.sql<Json>(`select best_answers_count from public.profiles where id = $1`, [bob]);
    assert.equal(p.best_answers_count, 0);
  });

  it("enforces the 30-minute edit window in the database", async () => {
    await t.sql(`update public.answers set created_at = now() - interval '29 minutes 50 seconds' where id = $1`, [answerBob]);
    await t.as(bob, `select public.edit_own_content('answer', $1, 'Edited just in time')`, [answerBob]);
    // Form opened before the deadline but submitted after it: rejected.
    await t.sql(`update public.answers set created_at = now() - interval '30 minutes 1 second' where id = $1`, [answerBob]);
    await rejects(t.as(bob, `select public.edit_own_content('answer', $1, 'Too late')`, [answerBob]), /edit window has closed/);
    const [a] = await t.sql<Json>(`select body from public.answers where id = $1`, [answerBob]);
    assert.equal(a.body, "Edited just in time");
  });

  it("won't let people edit someone else's post", async () => {
    await rejects(t.as(alice, `select public.edit_own_content('answer', $1, 'mine now')`, [answerMod]), /only edit your own/);
  });

  it("rate-limits questions (5 per hour)", async () => {
    for (let i = 0; i < 4; i++) {
      await t.as(alice, `select public.ask_question($1, null, null, null, null, null)`, [`Rate limited question number ${i}`]);
    }
    await rejects(t.as(alice, `select public.ask_question('One question too many today', null, null, null, null, null)`), /too often/);
  });

  it("merges duplicates and moves the answers", async () => {
    const [{ id: dup }] = await t.as<{ id: string }>(bob, `select public.ask_question('SM North papuntang UP Diliman paano?', null, $1, $2, null, null) as id`, [S("sm-north"), S("up-diliman")]);
    await t.as(alice, `select public.post_answer($1, 'Same as the other thread')`, [dup]);
    const [denied] = await t.as<{ r: Json }>(alice, `select public.merge_question($1, $2) as r`, [dup, q]);
    assert.equal(denied.r.ok, false);
    const [r] = await t.as<{ r: Json }>(mod, `select public.merge_question($1, $2) as r`, [dup, q]);
    assert.equal(r.r.ok, true);
    const [src] = await t.sql<Json>(`select status, merged_into_id, answer_count from public.questions where id = $1`, [dup]);
    assert.equal(src.status, "merged");
    assert.equal(src.merged_into_id, q);
    const [dst] = await t.sql<Json>(`select answer_count from public.questions where id = $1`, [q]);
    assert.equal(dst.answer_count, 3);
    await rejects(t.as(alice, `select public.post_answer($1, 'late answer')`, [dup]), /merged/);
  });

  it("hides removed content from the public but not from staff", async () => {
    await t.as(mod, `select public.set_content_removed('answer', $1, true, 'spam')`, [answerMod]);
    assert.equal((await t.as(null, `select id from public.answers where id = $1`, [answerMod])).length, 0);
    assert.equal((await t.as(mod, `select id from public.answers where id = $1`, [answerMod])).length, 1);
    const [qrow] = await t.sql<Json>(`select best_answer_id, answer_count from public.questions where id = $1`, [q]);
    assert.equal(qrow.best_answer_id, null);
    assert.equal(qrow.answer_count, 2);
  });
});

describe("reports", () => {
  const route = S("route:taft-moa");
  let reportId: string;

  it("lets members report outdated info once per item", async () => {
    [{ id: reportId }] = await t.as<{ id: string }>(alice, `select public.create_report('route', $1, 'fare_changed', 'Fare is now 15') as id`, [route]);
    await rejects(t.as(alice, `select public.create_report('route', $1, 'rerouted')`, [route]), /already reported/);
    const [r] = await t.as<Json>(null, `select open_report_count from public.routes where id = $1`, [route]);
    assert.equal(r.open_report_count, 1);
  });

  it("keeps reports private to the reporter and staff", async () => {
    assert.equal((await t.as(bob, `select id from public.reports where id = $1`, [reportId])).length, 0);
    assert.equal((await t.as(alice, `select id from public.reports where id = $1`, [reportId])).length, 1);
    assert.equal((await t.as(mod, `select id from public.reports where id = $1`, [reportId])).length, 1);
  });

  it("can only be resolved by staff, once, and rewards accepted reports", async () => {
    const [denied] = await t.as<{ r: Json }>(bob, `select public.resolve_report($1, 'resolved') as r`, [reportId]);
    assert.equal(denied.r.ok, false);
    const p0 = Number((await t.sql<Json>(`select points from public.profiles where id = $1`, [alice]))[0].points);
    const [ok] = await t.as<{ r: Json }>(mod, `select public.resolve_report($1, 'resolved', 'Fare updated') as r`, [reportId]);
    assert.equal(ok.r.ok, true);
    const [again] = await t.as<{ r: Json }>(admin, `select public.resolve_report($1, 'dismissed') as r`, [reportId]);
    assert.equal(again.r.ok, false);
    const p1 = Number((await t.sql<Json>(`select points from public.profiles where id = $1`, [alice]))[0].points);
    assert.equal(p1 - p0, 3);
    const [r] = await t.sql<Json>(`select open_report_count from public.routes where id = $1`, [route]);
    assert.equal(r.open_report_count, 0);
  });
});

describe("advisories (time windows enforced by RLS)", () => {
  it("show current and upcoming advisories, hide ended ones from the public", async () => {
    const [{ r: a }] = await t.as<{ r: Json }>(mod, `select public.upsert_advisory($1::jsonb) as r`, [
      JSON.stringify({ title: "Transport strike Monday", kind: "strike", severity: "critical", starts_at: new Date(Date.now() + 86400000).toISOString() }),
    ]);
    assert.equal(a.ok, true);
    const [{ r: ended }] = await t.as<{ r: Json }>(mod, `select public.upsert_advisory($1::jsonb) as r`, [
      JSON.stringify({ title: "Road closure ended", starts_at: new Date(Date.now() - 7200000).toISOString(), ends_at: new Date(Date.now() + 60000).toISOString() }),
    ]);
    // Visible a minute before it ends...
    assert.equal((await t.as(null, `select id from public.advisories where id = $1`, [ended.id])).length, 1);
    // ...and gone the instant the end time passes (simulated by moving it back).
    await t.sql(`update public.advisories set ends_at = now() - interval '1 second' where id = $1`, [ended.id]);
    assert.equal((await t.as(null, `select id from public.advisories where id = $1`, [ended.id])).length, 0);
    assert.equal((await t.as(mod, `select id from public.advisories where id = $1`, [ended.id])).length, 1);
    assert.equal((await t.as(null, `select id from public.advisories where id = $1`, [a.id])).length, 1);
  });

  it("reject an end time before the start time", async () => {
    const [{ r }] = await t.as<{ r: Json }>(mod, `select public.upsert_advisory($1::jsonb) as r`, [
      JSON.stringify({ title: "Backwards window", starts_at: "2026-10-20T10:00:00+08:00", ends_at: "2026-10-20T09:00:00+08:00" }),
    ]);
    assert.equal(r.ok, false);
  });

  it("can't be created by members", async () => {
    const [{ r }] = await t.as<{ r: Json }>(alice, `select public.upsert_advisory($1::jsonb) as r`, [JSON.stringify({ title: "Fake fare hike" })]);
    assert.equal(r.ok, false);
  });
});

describe("member search (admin only)", () => {
  it("refuses non-admins", async () => {
    await rejects(t.as(mod, `select * from public.search_users('ali')`), /Only admins/);
    await rejects(t.as(alice, `select * from public.search_users('ali')`), /Only admins/);
  });

  it("requires at least 2 characters", async () => {
    await rejects(t.as(admin, `select * from public.search_users('a')`), /at least 2/);
  });

  it("escapes LIKE wildcards", async () => {
    const all = await t.as(admin, `select * from public.search_users('%%')`);
    assert.equal(all.length, 0);
    const underscore = await t.as(admin, `select * from public.search_users('__')`);
    assert.equal(underscore.length, 0);
  });

  it("masks emails and caps results at 8", async () => {
    for (let i = 0; i < 10; i++) await t.createUser(`commuter${i}@gmail.com`);
    const rows = await t.as<Json>(admin, `select * from public.search_users('commuter')`);
    assert.equal(rows.length, 8);
    assert.match(String(rows[0].email_masked), /^co•••@gmail\.com$/);
    assert.ok(!rows.some((r) => String(r.email_masked).includes("commuter")));
  });
});

describe("roles and suspensions", () => {
  it("only admins change roles; changes are logged", async () => {
    const [denied] = await t.as<{ r: Json }>(mod, `select public.set_user_role($1, 'moderator') as r`, [bob]);
    assert.equal(denied.r.ok, false);
    const [ok] = await t.as<{ r: Json }>(admin, `select public.set_user_role($1, 'moderator') as r`, [bob]);
    assert.equal(ok.r.ok, true);
    const logs = await t.sql<Json>(`select details from public.audit_log where action = 'profile.role_changed' and target_id = $1`, [bob]);
    assert.equal(logs.length, 1);
    await t.as(admin, `select public.set_user_role($1, 'member')`, [bob]);
  });

  it("admins can't demote themselves by accident", async () => {
    const [r] = await t.as<{ r: Json }>(admin, `select public.set_user_role($1, 'member') as r`, [admin]);
    assert.equal(r.r.ok, false);
  });

  it("suspended members can't post, and moderators can't suspend admins", async () => {
    const [denied] = await t.as<{ r: Json }>(mod, `select public.set_user_banned($1, true) as r`, [admin]);
    assert.equal(denied.r.ok, false);
    const victim = await t.createUser("spammer@mail.com");
    await t.as(mod, `select public.set_user_banned($1, true)`, [victim]);
    await rejects(t.as(victim, `select public.ask_question('Buy cheap followers now!!!', null, null, null, null, null)`), /suspended/);
  });
});

describe("trip finder", () => {
  it("returns a direct community route", async () => {
    const [{ t: trips }] = await t.as<{ t: Json[] }>(null, `select public.find_trips($1, $2) as t`, [S("sm-north"), S("up-diliman")]);
    assert.ok(trips.length >= 1);
    const direct = trips[0];
    assert.equal(direct.transfers, 0);
    assert.equal(direct.single_route_id, S("route:smnorth-up"));
  });

  it("chains rides across routes with a walking transfer (MRT-3 -> LRT-2 at Cubao)", async () => {
    const [{ t: trips }] = await t.as<{ t: Json[] }>(null, `select public.find_trips($1, $2) as t`, [S("sm-north"), S("ust")]);
    assert.ok(trips.length >= 1);
    const legs = trips[0].legs as Json[];
    const names = legs.map((l) => (l.to as Json).name);
    assert.ok(names.includes("LRT-2 Legarda Station"), JSON.stringify(names));
    assert.ok(Number(trips[0].fare) > 0);
    assert.ok(Number(trips[0].fare_discounted) < Number(trips[0].fare));
  });

  it("ignores pending and archived routes", async () => {
    await t.as(mod, `select public.moderate_route($1, 'archive', 'test')`, [S("route:philcoa-up")]);
    const [{ t: trips }] = await t.as<{ t: Json[] }>(null, `select public.find_trips($1, $2) as t`, [S("philcoa"), S("up-diliman")]);
    assert.ok(!trips.some((x) => x.single_route_id === S("route:philcoa-up")));
    await t.as(mod, `select public.moderate_route($1, 'publish')`, [S("route:philcoa-up")]);
  });

  it("returns an empty list when nothing connects", async () => {
    const [{ t: trips }] = await t.as<{ t: Json[] }>(null, `select public.find_trips($1, $2) as t`, [S("alabang"), S("riverbanks")]);
    assert.deepEqual(trips, []);
  });
});

describe("places search", () => {
  it("matches landmarks by alias and needs 2+ characters", async () => {
    const rows = await t.as<Json>(null, `select name from public.search_places('MOA')`);
    assert.equal(rows[0].name, "SM Mall of Asia");
    assert.equal((await t.as(null, `select * from public.search_places('m')`)).length, 0);
  });

  it("treats % and _ literally", async () => {
    assert.equal((await t.as(null, `select * from public.search_places('%%')`)).length, 0);
  });
});

describe("search logs and analytics", () => {
  it("let anyone log a search; members only see their own history", async () => {
    await t.as(null, `select public.log_search('Alabang', 'Marikina', $1, $2, 0)`, [S("alabang"), S("riverbanks")]);
    await t.as(alice, `select public.log_search('SM North', 'UST', $1, $2, 3)`, [S("sm-north"), S("ust")]);
    await t.as(bob, `select public.log_search('PITX', 'Quiapo', $1, $2, 1)`, [S("pitx"), S("quiapo")]);
    const mine = await t.as<Json>(alice, `select origin_text from public.search_logs`);
    assert.deepEqual(mine.map((r) => r.origin_text), ["SM North"]);
    assert.equal((await t.as(null, `select * from public.search_logs`)).length, 0);
  });

  it("surface missing routes (zero-result searches) to staff only", async () => {
    const [{ a }] = await t.as<{ a: Json }>(mod, `select public.admin_analytics(30) as a`);
    const missing = a.missing_routes as Json[];
    assert.ok(missing.some((m) => m.origin === "alabang" && m.destination === "marikina"));
    await rejects(t.as(alice, `select public.admin_analytics(30)`), /Only moderators/);
  });

  it("keep the audit log admin-only", async () => {
    assert.equal((await t.as(mod, `select * from public.audit_log`)).length, 0);
    assert.ok((await t.as(admin, `select * from public.audit_log`)).length > 0);
  });
});

describe("comments and tips", () => {
  it("are public, counted, and removable by their author", async () => {
    const route = S("route:pitx-quiapo");
    const [{ id }] = await t.as<{ id: string }>(alice, `select public.add_route_comment($1, 'tip', 'Last bus leaves PITX around 11 PM') as id`, [route]);
    let [r] = await t.sql<Json>(`select comment_count from public.routes where id = $1`, [route]);
    assert.equal(r.comment_count, 1);
    assert.equal((await t.as(null, `select id from public.route_comments where id = $1`, [id])).length, 1);
    await rejects(t.as(bob, `select public.delete_own_content('comment', $1)`, [id]), /only delete your own/);
    await t.as(alice, `select public.delete_own_content('comment', $1)`, [id]);
    [r] = await t.sql<Json>(`select comment_count from public.routes where id = $1`, [route]);
    assert.equal(r.comment_count, 0);
  });
});
