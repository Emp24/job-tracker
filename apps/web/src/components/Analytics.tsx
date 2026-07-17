import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from "recharts";
import type { JobRow } from "@job-analyzer/shared";
import { listJobs } from "../lib/jobs";
import {
  skillFrequency,
  companyCounts,
  workArrangementCounts,
  countryCounts,
  summarize,
  type Count,
} from "../lib/analytics";

const BAR_COLOR = "#6366f1";
const PIE_COLORS: Record<string, string> = {
  Remote: "#10b981",
  Hybrid: "#6366f1",
  Onsite: "#f59e0b",
  Unknown: "#cbd5e1",
};

export default function Analytics() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listJobs()
      .then((data) => active && setJobs(data))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => summarize(jobs), [jobs]);
  const skills = useMemo(() => skillFrequency(jobs), [jobs]);
  const companies = useMemo(() => companyCounts(jobs), [jobs]);
  const arrangements = useMemo(() => workArrangementCounts(jobs), [jobs]);
  const countries = useMemo(() => countryCounts(jobs), [jobs]);

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading analytics…</div>;
  if (error) return <div className="m-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (jobs.length === 0) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4 text-center">
        <h2 className="text-lg font-semibold text-slate-800">Nothing to analyze yet</h2>
        <p className="mt-2 text-sm text-slate-500">
          Save a few jobs with the extension, then come back to see your funnel patterns.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <p className="mb-4 text-xs text-slate-400">
        These reflect only your own saved jobs — patterns in what you’re applying to, not the market.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Jobs tracked" value={stats.total} />
        <Stat label="Companies" value={stats.companies} />
        <Stat label="Unique skills" value={stats.uniqueSkills} />
        <Stat label="Remote share" value={stats.remotePct == null ? "—" : `${stats.remotePct}%`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Most in-demand skills" subtitle="How often each skill appears across your saved jobs">
          <HorizontalBars data={skills} yWidth={110} />
        </Card>

        <Card title="Top hiring companies" subtitle="Share of roles in your tracking loop">
          <HorizontalBars data={companies} yWidth={110} />
        </Card>

        <Card title="Work arrangement" subtitle="Remote / Hybrid / Onsite split">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={arrangements}
                dataKey="count"
                nameKey="name"
                outerRadius={90}
                label={(entry: { name?: string; value?: number }) => `${entry.name}: ${entry.value}`}
              >
                {arrangements.map((a) => (
                  <Cell key={a.name} fill={PIE_COLORS[a.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Locations" subtitle="Top country clusters">
          <HorizontalBars data={countries} yWidth={120} />
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mb-3 text-xs text-slate-400">{subtitle}</p>
      {children}
    </div>
  );
}

function HorizontalBars({ data, yWidth }: { data: Count[]; yWidth: number }) {
  if (data.length === 0) {
    return <div className="py-10 text-center text-xs text-slate-400">No data</div>;
  }
  const height = Math.max(160, data.length * 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 28, bottom: 0, left: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={yWidth} tick={{ fontSize: 12 }} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#64748b" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
