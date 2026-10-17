// Hand-written row types for the parts of the schema the UI reads.
// (You can replace these with `supabase gen types typescript` later.)

export type TransportMode = "jeepney" | "bus" | "uv_express" | "tricycle" | "train" | "ferry" | "walk";
export type PlaceKind = "landmark" | "mall" | "school" | "church" | "terminal" | "station" | "hospital" | "government" | "market" | "other";
export type RouteStatus = "pending" | "published" | "rejected" | "archived";
export type QuestionStatus = "open" | "answered" | "merged" | "closed";
export type UserRole = "member" | "moderator" | "admin";
export type ContentType = "route" | "question" | "answer" | "comment" | "place";
export type ReportReason = "fare_changed" | "rerouted" | "terminal_closed" | "schedule_changed" | "wrong_info" | "spam" | "offensive" | "duplicate" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type AdvisoryKind = "road_closure" | "fare_change" | "strike" | "reroute" | "weather" | "event" | "other";
export type AdvisorySeverity = "info" | "warning" | "critical";

export type PlaceRef = { id: string; name: string; lat: number; lng: number; kind?: PlaceKind; city?: string | null };

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  home_area: string | null;
  role: UserRole;
  is_banned: boolean;
  points: number;
  routes_published_count: number;
  questions_count: number;
  answers_count: number;
  best_answers_count: number;
  upvotes_received: number;
  confirmations_count: number;
  created_at: string;
};

export type Place = PlaceRef & {
  aliases: string[];
  kind: PlaceKind;
  city: string | null;
  address: string | null;
  description: string | null;
  modes: TransportMode[];
  hours_open: string | null;
  hours_close: string | null;
  hours_note: string | null;
  is_verified: boolean;
};

export type RouteLeg = {
  id: string;
  seq: number;
  mode: TransportMode;
  signboard: string | null;
  instructions: string | null;
  fare: number;
  fare_discounted: number | null;
  minutes: number;
  path: [number, number][] | null;
  from: PlaceRef;
  to: PlaceRef;
};

export type RouteSummary = {
  id: string;
  title: string;
  summary: string | null;
  status: RouteStatus;
  is_sample: boolean;
  total_fare: number;
  total_fare_discounted: number;
  total_minutes: number;
  leg_count: number;
  modes: TransportMode[];
  still_accurate_count: number;
  outdated_count: number;
  last_confirmed_at: string | null;
  save_count: number;
  comment_count: number;
  open_report_count: number;
  pwd_friendly: boolean;
  senior_friendly: boolean;
  heavy_load_friendly: boolean;
  created_at: string;
  origin: PlaceRef;
  destination: PlaceRef;
};

export type RouteDetail = RouteSummary & {
  operating_hours: string | null;
  accessibility_notes: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  submitted_by: string | null;
  submitter: Pick<Profile, "id" | "username" | "display_name"> | null;
  legs: RouteLeg[];
};

/** One leg of a trip returned by the find_trips RPC. */
export type TripLeg = {
  leg_id: string;
  route_id: string;
  route_title: string;
  is_sample: boolean;
  still_accurate_count: number;
  outdated_count: number;
  mode: TransportMode;
  signboard: string | null;
  instructions: string | null;
  fare: number;
  fare_discounted: number;
  minutes: number;
  path: [number, number][] | null;
  from: PlaceRef;
  to: PlaceRef;
};

export type Trip = {
  fare: number;
  fare_discounted: number;
  minutes: number;
  walk_m: number;
  transfers: number;
  single_route_id: string | null;
  legs: TripLeg[];
};

export type AuthorRef = Pick<Profile, "id" | "username" | "display_name" | "role"> | null;

export type Question = {
  id: string;
  title: string;
  body: string | null;
  status: QuestionStatus;
  answer_count: number;
  best_answer_id: string | null;
  merged_into_id: string | null;
  origin_text: string | null;
  destination_text: string | null;
  origin_place_id: string | null;
  destination_place_id: string | null;
  is_removed: boolean;
  created_at: string;
  last_activity_at: string;
  author_id: string | null;
  author: AuthorRef;
};

export type Answer = {
  id: string;
  question_id: string;
  body: string;
  score: number;
  is_best: boolean;
  is_removed: boolean;
  created_at: string;
  author_id: string | null;
  route_id: string | null;
  author: AuthorRef;
  route: { id: string; title: string } | null;
};

export type RouteComment = {
  id: string;
  kind: "tip" | "comment";
  body: string;
  is_removed: boolean;
  created_at: string;
  author_id: string | null;
  author: AuthorRef;
};

export type Advisory = {
  id: string;
  title: string;
  body: string | null;
  kind: AdvisoryKind;
  severity: AdvisorySeverity;
  area: string | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  target_type: ContentType;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  reporter: AuthorRef;
  resolver: AuthorRef;
};

/** Result shape of staff RPCs that return {ok, error}. */
export type RpcResult = { ok: boolean; error?: string; id?: string; status?: string };

/** Standard state for forms driven by useActionState. */
export type ActionState = { ok: boolean; message: string; at?: number; redirectTo?: string; fieldErrors?: Record<string, string> } | null;
