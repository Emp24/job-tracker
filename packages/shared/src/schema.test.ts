import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JobExtractionSchema,
  ParseRequestSchema,
  extractionToDbInsert,
  needsReviewInsert,
  RAW_TEXT_CAP,
} from "./schema.ts";

test("JobExtractionSchema lowercases + trims skills and enforces the max", () => {
  const parsed = JobExtractionSchema.parse({
    companyName: "  Google  ",
    jobTitle: " Senior Engineer ",
    relevantSkills: [" ReactJS ", "PYTHON", "sql"],
    yearsOfExperience: 3,
    mainField: "Tech",
    workArrangement: "Remote",
    country: "United States",
    city: "New York",
  });

  assert.equal(parsed.companyName, "Google");
  assert.equal(parsed.jobTitle, "Senior Engineer");
  assert.deepEqual(parsed.relevantSkills, ["reactjs", "python", "sql"]);
});

test("JobExtractionSchema rejects negative experience and >15 skills", () => {
  assert.throws(() =>
    JobExtractionSchema.parse({
      companyName: "X",
      jobTitle: "Y",
      relevantSkills: [],
      yearsOfExperience: -1,
      mainField: "Tech",
      workArrangement: null,
      country: "US",
      city: null,
    }),
  );

  assert.throws(() =>
    JobExtractionSchema.parse({
      companyName: "X",
      jobTitle: "Y",
      relevantSkills: Array.from({ length: 16 }, (_, i) => `skill${i}`),
      yearsOfExperience: null,
      mainField: "Tech",
      workArrangement: null,
      country: "US",
      city: null,
    }),
  );
});

test("extractionToDbInsert maps camelCase → snake_case and caps raw_text", () => {
  const extraction = JobExtractionSchema.parse({
    companyName: "Acme",
    jobTitle: "Engineer",
    relevantSkills: ["go"],
    yearsOfExperience: null,
    mainField: "Tech",
    workArrangement: null,
    country: "",
    city: null,
  });

  const row = extractionToDbInsert(extraction, {
    userId: "user-1",
    sourceUrl: "https://example.com/job/1",
    rawText: "x".repeat(RAW_TEXT_CAP + 500),
  });

  assert.equal(row.user_id, "user-1");
  assert.equal(row.company_name, "Acme");
  assert.equal(row.years_experience, null);
  assert.equal(row.country, null, "empty country coerced to null");
  assert.equal(row.parse_status, "ok");
  assert.equal(row.raw_text.length, RAW_TEXT_CAP, "raw_text capped");
});

test("needsReviewInsert yields a NOT-NULL-safe row that retains capped raw_text", () => {
  const row = needsReviewInsert({
    userId: "user-9",
    sourceUrl: "https://example.com/job/x",
    rawText: "y".repeat(RAW_TEXT_CAP + 100),
  });

  assert.equal(row.parse_status, "needs_review");
  assert.ok(row.company_name.length > 0, "company_name satisfies non-empty CHECK");
  assert.ok(row.job_title.length > 0, "job_title satisfies non-empty CHECK");
  assert.equal(row.main_field, "Other");
  assert.deepEqual(row.relevant_skills, []);
  assert.equal(row.raw_text.length, RAW_TEXT_CAP, "raw_text capped for re-run");
});

test("ParseRequestSchema requires a valid URL and non-empty text", () => {
  assert.throws(() => ParseRequestSchema.parse({ rawText: "", sourceUrl: "https://x.com" }));
  assert.throws(() => ParseRequestSchema.parse({ rawText: "hi", sourceUrl: "not-a-url" }));
  assert.doesNotThrow(() =>
    ParseRequestSchema.parse({ rawText: "hi", sourceUrl: "https://x.com/j/1" }),
  );
});
