import { Award } from "lucide-react";
import { Chip } from "@/components/ui/primitives";
import { badgesFor } from "@/lib/badges";
import type { Profile } from "@/lib/types";

export function BadgeList({ profile }: { profile: Profile }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {badgesFor(profile).map((b) => (
        <li key={b.id}>
          <Chip tone={b.tone} title={b.description}>
            <Award className="size-3" aria-hidden /> {b.label}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white ${size === "lg" ? "size-16 text-xl" : "size-10 text-sm"}`} aria-hidden>
      {letters || "?"}
    </span>
  );
}
