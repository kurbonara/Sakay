"use client";

import { Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ActionButton } from "@/components/ui/client";
import { Chip, cx, inputClasses } from "@/components/ui/primitives";
import { searchUsers, setUserBanned, setUserRole, type UserSearchRow } from "@/lib/actions/admin";
import type { UserRole } from "@/lib/types";

/** Admin-only member lookup: 2+ characters, max 8 results, emails masked. */
export function UserSearch({ selfId }: { selfId: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserSearchRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0);

  const run = (query: string) => {
    const id = ++latest.current;
    startTransition(async () => {
      const res = await searchUsers(query);
      if (id !== latest.current) return;
      setRows(res.rows);
      setMessage(res.ok ? null : (res.message ?? null));
    });
  };

  useEffect(() => {
    if (q.trim().length < 2) return;
    const h = setTimeout(() => run(q), 300);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username, name or email (2+ characters)" className={cx(inputClasses, "pl-9")} aria-label="Search members" />
        {pending ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden /> : null}
      </div>
      {message ? <p className="text-sm text-rose-700">{message}</p> : null}
      {q.trim().length < 2 ? (
        <p className="text-sm text-slate-500">Type at least 2 characters. Results are limited to 8 and emails are partly hidden.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
          {rows.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/u/${u.username}`} className="font-medium text-slate-900 hover:text-brand-700">
                  {u.display_name}
                </Link>{" "}
                <span className="text-sm text-slate-500">@{u.username}</span>
                <p className="text-xs text-slate-500">
                  {u.email_masked} · {u.points} pts {u.is_banned ? <Chip tone="rose">suspended</Chip> : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Role for ${u.username}`}
                  defaultValue={u.role}
                  disabled={u.id === selfId}
                  onChange={async (e) => {
                    const role = e.target.value as UserRole;
                    const res = await setUserRole(u.id, role);
                    setMessage(res?.ok ? `${u.username}: ${res.message}` : (res?.message ?? null));
                    run(q);
                  }}
                  className={cx(inputClasses, "w-auto py-1.5")}
                >
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
                {u.id !== selfId ? (
                  <ActionButton
                    variant={u.is_banned ? "secondary" : "danger"}
                    confirm={u.is_banned ? undefined : `Suspend @${u.username}? They won't be able to post, vote or submit routes.`}
                    confirmLabel="Suspend"
                    action={async () => {
                      const res = await setUserBanned(u.id, !u.is_banned);
                      run(q);
                      return res;
                    }}
                  >
                    {u.is_banned ? "Lift suspension" : "Suspend"}
                  </ActionButton>
                ) : (
                  <Chip>you</Chip>
                )}
              </div>
            </li>
          ))}
          {!rows.length && !pending ? <li className="px-4 py-6 text-center text-sm text-slate-500">No members match.</li> : null}
        </ul>
      )}
    </div>
  );
}
