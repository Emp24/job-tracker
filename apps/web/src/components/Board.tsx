import { useCallback, useEffect, useState, type DragEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { JOB_STATUSES, type JobRow, type JobStatus } from "@job-analyzer/shared";
import { getSupabase } from "../lib/supabase";
import { listJobs, updateJobStatus, deleteJob } from "../lib/jobs";
import JobCard, { JOB_ID_MIME } from "./JobCard";
import EditJobModal from "./EditJobModal";

const STATUS_ACCENT: Record<JobStatus, string> = {
  Saved: "border-t-slate-400",
  Applied: "border-t-blue-400",
  Interviewing: "border-t-violet-400",
  Offer: "border-t-emerald-400",
  Rejected: "border-t-red-400",
  Archived: "border-t-slate-300",
};

export default function Board({ session }: { session: Session }) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<JobRow | null>(null);
  const [dragOver, setDragOver] = useState<JobStatus | null>(null);
  const [dragging, setDragging] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await listJobs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function moveJob(id: string, status: JobStatus) {
    const target = jobs.find((j) => j.id === id);
    if (!target || target.status === status) return;

    const previous = jobs;
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, status } : j))); // optimistic
    try {
      const updated = await updateJobStatus(id, status);
      setJobs((js) => js.map((j) => (j.id === id ? updated : j)));
    } catch (err) {
      setJobs(previous); // revert
      setError(err instanceof Error ? err.message : "Failed to move job.");
    }
  }

  async function onDelete(job: JobRow) {
    if (!confirm(`Delete "${job.company_name} — ${job.job_title}"?`)) return;
    const previous = jobs;
    setJobs((js) => js.filter((j) => j.id !== job.id)); // optimistic
    try {
      await deleteJob(job.id);
    } catch (err) {
      setJobs(previous);
      setError(err instanceof Error ? err.message : "Failed to delete job.");
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>, status: JobStatus) {
    e.preventDefault();
    setDragOver(null);
    setDragging(false);
    const id = e.dataTransfer.getData(JOB_ID_MIME);
    if (id) void moveJob(id, status);
  }

  const needsReview = jobs.filter((j) => j.parse_status === "needs_review").length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold text-slate-900">Job Tracker</h1>
          <span className="text-xs text-slate-500">
            {jobs.length} job{jobs.length === 1 ? "" : "s"}
            {needsReview > 0 && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                {needsReview} need review
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void refresh()} className="text-xs text-slate-500 hover:text-slate-900">
            Refresh
          </button>
          <span className="hidden text-xs text-slate-400 sm:inline">{session.user.email}</span>
          <button
            onClick={() => getSupabase().auth.signOut()}
            className="text-xs text-slate-500 underline hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-5 mt-3 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-sm text-slate-500">Loading…</div>
      ) : jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex gap-3 overflow-x-auto p-5">
          {JOB_STATUSES.map((status) => {
            const laneJobs = jobs.filter((j) => j.status === status);
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
                onDrop={(e) => onDrop(e, status)}
                className={`flex w-72 shrink-0 flex-col rounded-xl border-t-4 bg-slate-100/70 ${STATUS_ACCENT[status]} ${
                  dragOver === status ? "ring-2 ring-slate-400" : ""
                }`}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{status}</span>
                  <span className="text-xs text-slate-400">{laneJobs.length}</span>
                </div>
                <div className="flex min-h-16 flex-col gap-2 px-2 pb-3">
                  {laneJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onEdit={setEditing}
                      onDelete={onDelete}
                      onDragStateChange={setDragging}
                    />
                  ))}
                  {laneJobs.length === 0 && dragging && (
                    <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditJobModal
          job={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setJobs((js) => js.map((j) => (j.id === saved.id ? saved : j)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-24 max-w-md px-4 text-center">
      <h2 className="text-lg font-semibold text-slate-800">No jobs yet</h2>
      <p className="mt-2 text-sm text-slate-500">
        Use the browser extension to save a job posting — it’ll appear here. Hit{" "}
        <span className="font-medium">Refresh</span> after saving your first one.
      </p>
    </div>
  );
}
