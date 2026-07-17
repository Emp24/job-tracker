import type { JobRow } from "@job-analyzer/shared";

export interface Count {
  name: string;
  count: number;
}

/** Sort a name→count map descending (ties broken alphabetically) and take top N. */
function topCounts(map: Map<string, number>, limit: number): Count[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** How often each skill appears across the user's saved jobs. */
export function skillFrequency(jobs: JobRow[], limit = 15): Count[] {
  const map = new Map<string, number>();
  for (const job of jobs) {
    for (const skill of job.relevant_skills) {
      const key = skill.trim();
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return topCounts(map, limit);
}

/** Which companies hold the largest share of roles in the funnel. */
export function companyCounts(jobs: JobRow[], limit = 10): Count[] {
  const map = new Map<string, number>();
  for (const job of jobs) {
    const key = job.company_name.trim();
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return topCounts(map, limit);
}

/** Remote / Hybrid / Onsite split, with unset arrangements bucketed as Unknown. */
export function workArrangementCounts(jobs: JobRow[]): Count[] {
  const order = ["Remote", "Hybrid", "Onsite", "Unknown"];
  const map = new Map<string, number>();
  for (const job of jobs) {
    const key = job.work_arrangement ?? "Unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return order.filter((k) => map.has(k)).map((k) => ({ name: k, count: map.get(k)! }));
}

/** Top country clusters across the funnel. */
export function countryCounts(jobs: JobRow[], limit = 8): Count[] {
  const map = new Map<string, number>();
  for (const job of jobs) {
    const key = (job.country ?? "").trim();
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return topCounts(map, limit);
}

export interface Summary {
  total: number;
  companies: number;
  uniqueSkills: number;
  remotePct: number | null;
}

export function summarize(jobs: JobRow[]): Summary {
  const companies = new Set<string>();
  const skills = new Set<string>();
  let remote = 0;
  let withArrangement = 0;
  for (const job of jobs) {
    if (job.company_name.trim()) companies.add(job.company_name.trim());
    for (const s of job.relevant_skills) if (s.trim()) skills.add(s.trim());
    if (job.work_arrangement) {
      withArrangement++;
      if (job.work_arrangement === "Remote") remote++;
    }
  }
  return {
    total: jobs.length,
    companies: companies.size,
    uniqueSkills: skills.size,
    remotePct: withArrangement === 0 ? null : Math.round((remote / withArrangement) * 100),
  };
}
