"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useOnline } from "@/components/pwa";
import { buttonClasses, Container } from "@/components/ui/primitives";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const envProblem = /\.env\.local/.test(error.message);
  const offline = !useOnline();
  return (
    <Container className="max-w-xl py-10 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{envProblem ? "Sakay isn't configured yet" : offline ? "You're offline" : "Something went wrong"}</h1>
      <p className="mt-2 text-slate-600">
        {envProblem
          ? error.message
          : offline
            ? "Check your connection. Your saved routes are still available offline."
            : "This page hit a problem loading. It's usually temporary: try again, and if it keeps happening, let the moderators know."}
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-slate-400">Error ID: {error.digest}</p> : null}
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" onClick={reset} className={buttonClasses("primary", "md")}>
          Try again
        </button>
        <Link href={offline ? "/offline" : "/"} className={buttonClasses("secondary", "md")}>
          {offline ? "Offline routes" : "Go home"}
        </Link>
      </div>
    </Container>
  );
}
