import type { DragEvent } from "react";
import type { JobRow } from "@job-analyzer/shared";

export const JOB_ID_MIME = "application/x-job-id";

interface Props {
  job: JobRow;
  onEdit: (job: JobRow) => void;
  onDelete: (job: JobRow) => void;
  onDragStateChange: (dragging: boolean) => void;
}

export default function JobCard({ job, onEdit, onDelete, onDragStateChange }: Props) {
  function onDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData(JOB_ID_MIME, job.id);
    e.dataTransfer.effectAllowed = "move";
    onDragStateChange(true);
  }

  const location =
    [job.city, job.country].filter(Boolean).join(", ") || (job.work_arrangement ? "" : "—");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={() => onDragStateChange(false)}
      className="group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{job.company_name}</div>
          <div className="truncate text-xs text-slate-600">{job.job_title}</div>
        </div>
        {job.parse_status === "needs_review" && (
          <span
            title="AI parsing needs review"
            className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
          >
            review
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        {job.work_arrangement && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5">{job.work_arrangement}</span>
        )}
        {location && <span>{location}</span>}
        {job.years_experience != null && <span>· {job.years_experience}+ yrs</span>}
      </div>

      {job.relevant_skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.relevant_skills.slice(0, 6).map((s) => (
            <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
              {s}
            </span>
          ))}
          {job.relevant_skills.length > 6 && (
            <span className="text-[10px] text-slate-400">+{job.relevant_skills.length - 6}</span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={job.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-slate-400 underline hover:text-slate-600"
        >
          source
        </a>
        <div className="flex gap-2">
          <button onClick={() => onEdit(job)} className="text-[11px] text-slate-500 hover:text-slate-900">
            edit
          </button>
          <button onClick={() => onDelete(job)} className="text-[11px] text-red-400 hover:text-red-600">
            delete
          </button>
        </div>
      </div>
    </div>
  );
}
