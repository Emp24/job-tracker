import { useState, type FormEvent } from "react";
import {
  MAIN_FIELDS,
  WORK_ARRANGEMENTS,
  JOB_STATUSES,
  MAX_SKILLS,
  type JobRow,
  type MainField,
  type WorkArrangement,
  type JobStatus,
} from "@job-analyzer/shared";
import { updateJob, type JobEdit } from "../lib/jobs";

interface Props {
  job: JobRow;
  onClose: () => void;
  onSaved: (job: JobRow) => void;
}

interface FormState {
  company_name: string;
  job_title: string;
  main_field: MainField;
  skills: string;
  years_experience: string;
  country: string;
  city: string;
  work_arrangement: WorkArrangement | "";
  status: JobStatus;
  source_url: string;
}

export default function EditJobModal({ job, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>({
    company_name: job.company_name,
    job_title: job.job_title,
    main_field: job.main_field,
    skills: job.relevant_skills.join(", "),
    years_experience: job.years_experience?.toString() ?? "",
    country: job.country ?? "",
    city: job.city ?? "",
    work_arrangement: job.work_arrangement ?? "",
    status: job.status,
    source_url: job.source_url,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const skills = Array.from(
        new Set(
          form.skills
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        ),
      ).slice(0, MAX_SKILLS);

      const years = form.years_experience.trim();
      const parsedYears = years === "" ? null : Number.parseInt(years, 10);
      if (parsedYears != null && (Number.isNaN(parsedYears) || parsedYears < 0)) {
        throw new Error("Years of experience must be a non-negative whole number.");
      }

      const fields: JobEdit = {
        company_name: form.company_name.trim(),
        job_title: form.job_title.trim(),
        main_field: form.main_field,
        relevant_skills: skills,
        years_experience: parsedYears,
        country: form.country.trim() || null,
        city: form.city.trim() || null,
        work_arrangement: form.work_arrangement === "" ? null : form.work_arrangement,
        status: form.status,
        source_url: form.source_url.trim(),
      };

      if (!fields.company_name || !fields.job_title) {
        throw new Error("Company and job title are required.");
      }

      const saved = await updateJob(job.id, fields);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const label = "text-xs font-medium text-slate-600";
  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500";

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Edit job</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>Company</label>
            <input className={input} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={label}>Job title</label>
            <input className={input} value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
          </div>

          <div>
            <label className={label}>Field</label>
            <select className={input} value={form.main_field} onChange={(e) => set("main_field", e.target.value as typeof form.main_field)}>
              {MAIN_FIELDS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Status</label>
            <select className={input} value={form.status} onChange={(e) => set("status", e.target.value as typeof form.status)}>
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Work arrangement</label>
            <select className={input} value={form.work_arrangement} onChange={(e) => set("work_arrangement", e.target.value as typeof form.work_arrangement)}>
              <option value="">—</option>
              {WORK_ARRANGEMENTS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Years experience</label>
            <input className={input} inputMode="numeric" value={form.years_experience} onChange={(e) => set("years_experience", e.target.value)} placeholder="e.g. 3" />
          </div>

          <div>
            <label className={label}>City</label>
            <input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className={label}>Country</label>
            <input className={input} value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className={label}>Skills (comma-separated, max {MAX_SKILLS})</label>
            <input className={input} value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="python, sql, aws" />
          </div>
          <div className="col-span-2">
            <label className={label}>Source URL</label>
            <input className={input} value={form.source_url} onChange={(e) => set("source_url", e.target.value)} />
          </div>

          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

          <div className="col-span-2 mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
