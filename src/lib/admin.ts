import "server-only";
import { requireViewer, type Viewer } from "@/lib/auth";

/** Returns the viewer if they are staff (or admin when `adminOnly`), otherwise null. */
export async function requireStaff(path: string, adminOnly = false): Promise<Viewer | null> {
  const viewer = await requireViewer(path);
  if (adminOnly ? !viewer.isAdmin : !viewer.isStaff) return null;
  return viewer;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    // Quote everything and neutralise spreadsheet formulas.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}
