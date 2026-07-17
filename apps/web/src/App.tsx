import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Board from "./components/Board";

// Lazy so recharts (a large dep) only loads when the Analytics tab is opened.
const Analytics = lazy(() => import("./components/Analytics"));

type View = "board" | "analytics";

export default function App() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>("board");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (booting) return <div className="p-8 text-sm text-slate-500">Loading…</div>;
  if (!session) return <Auth />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-5">
          <h1 className="text-base font-semibold text-slate-900">Job Tracker</h1>
          <nav className="flex gap-1">
            <Tab active={view === "board"} onClick={() => setView("board")}>
              Board
            </Tab>
            <Tab active={view === "analytics"} onClick={() => setView("analytics")}>
              Analytics
            </Tab>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 sm:inline">{session.user.email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-slate-500 underline hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>

      {view === "board" ? (
        <Board />
      ) : (
        <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading analytics…</div>}>
          <Analytics />
        </Suspense>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-sm ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
