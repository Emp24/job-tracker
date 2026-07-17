import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { RAW_TEXT_CAP, ParseRequestSchema } from "@job-analyzer/shared";
import { getSupabase } from "../lib/supabase";
import { captureActiveTab } from "../lib/capture";
import { saveJob, type ParseResponse } from "../lib/api";

const shell = "w-[340px] p-4 bg-white text-slate-800";

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
    return <div className={`${shell} text-sm text-slate-500`}>Loading…</div>;
  }
  return session ? <SaveView session={session} /> : <AuthForm />;
}

function AuthForm() {
  const supabase = getSupabase();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (mode === "signup") {
        setNotice("Account created. If email confirmation is on, confirm then sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={shell}>
      <h1 className="text-base font-semibold">Job Tracker</h1>
      <p className="mt-0.5 text-xs text-slate-500">
        {mode === "signin" ? "Sign in to save jobs." : "Create an account."}
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {notice && <p className="mt-2 text-xs text-emerald-700">{notice}</p>}

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setNotice(null);
        }}
        className="mt-3 text-xs text-slate-500 underline"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </div>
  );
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; res: ParseResponse }
  | { kind: "error"; message: string };

function SaveView({ session }: { session: Session }) {
  const supabase = getSupabase();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSave() {
    setStatus({ kind: "saving" });
    try {
      const { capture, url } = await captureActiveTab(RAW_TEXT_CAP);
      const body = ParseRequestSchema.parse({ rawText: capture.text, sourceUrl: url });

      // Refresh the token at save time — the popup may have been open a while.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired — please sign in again.");

      const res = await saveJob(token, body);
      setStatus({ kind: "saved", res });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Save failed." });
    }
  }

  return (
    <div className={shell}>
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Job Tracker</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-500 underline">
          Sign out
        </button>
      </div>
      <p className="mt-0.5 truncate text-xs text-slate-500">{session.user.email}</p>

      <button
        onClick={onSave}
        disabled={status.kind === "saving"}
        className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status.kind === "saving" ? "Saving…" : "Save this page"}
      </button>
      <p className="mt-2 text-xs text-slate-400">
        Tip: select the job description first for the cleanest capture, or right-click a selection →
        “Save selection to Job Tracker”.
      </p>

      {status.kind === "saved" && <SavedResult res={status.res} />}
      {status.kind === "error" && (
        <p className="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">{status.message}</p>
      )}
    </div>
  );
}

function SavedResult({ res }: { res: ParseResponse }) {
  const { job, parseStatus } = res;
  if (parseStatus === "needs_review") {
    return (
      <div className="mt-3 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
        Saved, but AI parsing needs review. You can fix the details in the dashboard.
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
      <div className="font-medium">Saved: {job.company_name}</div>
      <div>{job.job_title}</div>
      {job.relevant_skills.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {job.relevant_skills.slice(0, 8).map((s) => (
            <span key={s} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-emerald-700">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
