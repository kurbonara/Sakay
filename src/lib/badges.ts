import type { Profile } from "@/lib/types";

export type Badge = { id: string; label: string; description: string; tone: "amber" | "blue" | "emerald" | "rose" | "violet" | "slate" };

// Badges are derived from trigger-maintained counters, so they can't be faked.
export function badgesFor(p: Pick<Profile, "points" | "routes_published_count" | "answers_count" | "best_answers_count" | "upvotes_received" | "confirmations_count" | "role">): Badge[] {
  const out: Badge[] = [{ id: "rider", label: "Bagong Sakay", description: "Joined the community", tone: "slate" }];
  if (p.role === "admin") out.push({ id: "admin", label: "Admin", description: "Runs Sakay", tone: "rose" });
  else if (p.role === "moderator") out.push({ id: "mod", label: "Moderator", description: "Keeps the data clean", tone: "rose" });
  if (p.routes_published_count >= 1) out.push({ id: "scout", label: "Route Scout", description: "Published a route", tone: "emerald" });
  if (p.routes_published_count >= 10) out.push({ id: "master", label: "Route Master", description: "10+ published routes", tone: "emerald" });
  if (p.answers_count >= 5) out.push({ id: "helper", label: "Matulungin", description: "Answered 5+ questions", tone: "blue" });
  if (p.best_answers_count >= 1) out.push({ id: "best", label: "Best Answer", description: "Had an answer picked as best", tone: "amber" });
  if (p.upvotes_received >= 25) out.push({ id: "trusted", label: "Trusted Guide", description: "25+ upvotes received", tone: "amber" });
  if (p.confirmations_count >= 10) out.push({ id: "verifier", label: "Verifier", description: "Confirmed 10+ routes", tone: "violet" });
  if (p.points >= 200) out.push({ id: "suki", label: "Suki", description: "200+ points", tone: "blue" });
  if (p.points >= 1000) out.push({ id: "warrior", label: "Road Warrior", description: "1,000+ points", tone: "rose" });
  return out;
}
