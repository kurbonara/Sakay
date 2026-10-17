import "server-only";
import { connection } from "next/server";

/**
 * Current time for a Server Component render. `connection()` tells Next.js this
 * value is per-request, so it is never baked into a prerendered/prefetched shell.
 */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
