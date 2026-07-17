import { test } from "node:test";
import assert from "node:assert/strict";
import {
  skillFrequency,
  companyCounts,
  workArrangementCounts,
  countryCounts,
  summarize,
} from "./analytics.ts";
import type { JobRow } from "@job-analyzer/shared";

// Minimal JobRow factory — only the fields the aggregations read matter.
function job(partial: Partial<JobRow>): JobRow {
  return {
    id: "id",
    user_id: "u",
    company_name: "Acme",
    job_title: "Engineer",
    main_field: "Tech",
    relevant_skills: [],
    years_experience: null,
    country: null,
    city: null,
    work_arrangement: null,
    status: "Saved",
    source_url: "https://x.com",
    raw_text: "",
    parse_status: "ok",
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

const JOBS: JobRow[] = [
  job({ company_name: "Stripe", relevant_skills: ["python", "go", "aws"], work_arrangement: "Remote", country: "United States" }),
  job({ company_name: "Stripe", relevant_skills: ["python", "sql"], work_arrangement: "Hybrid", country: "United States" }),
  job({ company_name: "Google", relevant_skills: ["python", "go"], work_arrangement: "Onsite", country: "Canada" }),
  job({ company_name: "Google", relevant_skills: ["java"], work_arrangement: null, country: null }),
];

test("skillFrequency counts and ranks skills", () => {
  const freq = skillFrequency(JOBS);
  assert.deepEqual(freq[0], { name: "python", count: 3 });
  assert.equal(freq.find((c) => c.name === "go")?.count, 2);
  assert.equal(freq.find((c) => c.name === "java")?.count, 1);
});

test("skillFrequency respects the limit", () => {
  assert.equal(skillFrequency(JOBS, 2).length, 2);
});

test("companyCounts ranks by number of roles", () => {
  const companies = companyCounts(JOBS);
  assert.deepEqual(companies[0], { name: "Google", count: 2 });
  assert.deepEqual(companies[1], { name: "Stripe", count: 2 });
});

test("workArrangementCounts buckets null as Unknown, keeps canonical order", () => {
  const arr = workArrangementCounts(JOBS);
  assert.deepEqual(arr, [
    { name: "Remote", count: 1 },
    { name: "Hybrid", count: 1 },
    { name: "Onsite", count: 1 },
    { name: "Unknown", count: 1 },
  ]);
});

test("countryCounts ignores null countries", () => {
  const c = countryCounts(JOBS);
  assert.deepEqual(c[0], { name: "United States", count: 2 });
  assert.equal(c.find((x) => x.name === "Canada")?.count, 1);
  assert.equal(c.reduce((n, x) => n + x.count, 0), 3); // the null-country job is excluded
});

test("summarize computes totals and remote share of jobs with a known arrangement", () => {
  const s = summarize(JOBS);
  assert.equal(s.total, 4);
  assert.equal(s.companies, 2);
  assert.equal(s.uniqueSkills, 5); // python, go, aws, sql, java
  assert.equal(s.remotePct, 33); // 1 remote of 3 with a known arrangement
});
