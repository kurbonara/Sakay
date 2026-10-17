-- =============================================================================
-- Sakay: Realtime
-- Pages subscribe to these tables and refresh within ~1 second of a change.
-- Supabase Realtime applies each subscriber's RLS policies, so people only get
-- events for rows they are allowed to read.
-- =============================================================================

alter publication supabase_realtime add table
  public.routes,
  public.route_legs,
  public.route_comments,
  public.questions,
  public.answers,
  public.reports,
  public.advisories,
  public.places,
  public.profiles,
  public.route_saves,
  public.route_confirmations,
  public.answer_votes;
