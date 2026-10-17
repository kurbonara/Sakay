// PostgREST select strings shared by pages. Foreign keys with more than one
// relation to the same table need an explicit hint (table!constraint_name).

export const PLACE_REF = "id, name, lat, lng, kind, city";

export const ROUTE_SUMMARY = `id, title, summary, status, is_sample, total_fare, total_fare_discounted, total_minutes, leg_count, modes,
  still_accurate_count, outdated_count, last_confirmed_at, save_count, comment_count, open_report_count,
  pwd_friendly, senior_friendly, heavy_load_friendly, created_at,
  origin:places!routes_origin_place_id_fkey(${PLACE_REF}),
  destination:places!routes_destination_place_id_fkey(${PLACE_REF})`;

export const ROUTE_DETAIL = `${ROUTE_SUMMARY}, operating_hours, accessibility_notes, review_note, reviewed_at, published_at, submitted_by,
  submitter:profiles!routes_submitted_by_fkey(id, username, display_name),
  legs:route_legs(id, seq, mode, signboard, instructions, fare, fare_discounted, minutes, path,
    from:places!route_legs_from_place_id_fkey(${PLACE_REF}),
    to:places!route_legs_to_place_id_fkey(${PLACE_REF}))`;

export const AUTHOR = "id, username, display_name, role";

export const QUESTION = `id, title, body, status, answer_count, best_answer_id, merged_into_id, origin_text, destination_text,
  origin_place_id, destination_place_id, is_removed, created_at, last_activity_at, author_id,
  author:profiles!questions_author_id_fkey(${AUTHOR})`;

export const ANSWER = `id, question_id, body, score, is_best, is_removed, created_at, author_id, route_id,
  author:profiles!answers_author_id_fkey(${AUTHOR}),
  route:routes(id, title)`;

export const COMMENT = `id, kind, body, is_removed, created_at, author_id, author:profiles!route_comments_author_id_fkey(${AUTHOR})`;

export const PLACE_FULL = "id, name, aliases, kind, city, address, description, lat, lng, modes, hours_open, hours_close, hours_note, is_verified";

export const ADVISORY = "id, title, body, kind, severity, area, starts_at, ends_at, created_at";

/** Escape characters that have meaning inside PostgREST filter strings. */
export function pgrstSafe(value: string): string {
  return value.replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
