import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Board from "./components/Board";

export default function App() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (booting) {
    return <div className="p-8 text-sm text-slate-500">Loading…</div>;
  }
  if (!session) return <Auth />;
  return <Board session={session} />;
}
