type ErrorLike = { message?: string; code?: string; details?: string | null } | null | undefined;

/** Turn a Supabase/PostgREST error into a sentence a commuter understands. */
export function friendlyError(error: ErrorLike, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (code === "P0001" && msg) return msg; // our own messages from the database
  if (code === "42501") return msg.startsWith("Only") ? msg : "You don't have permission to do that.";
  if (code === "PGRST301" || /JWT expired/i.test(msg)) return "Your session expired. Please sign in again.";
  if (code === "23505") return "That already exists.";
  if (code === "23514") return "Some values are outside the allowed range. Please check the form.";
  if (code === "22P02") return "One of the values isn't valid. Please check the form.";
  if (/fetch failed|network|ECONNREFUSED|Failed to fetch/i.test(msg)) {
    return "We couldn't reach the server. Check your internet connection and try again.";
  }
  return fallback;
}
