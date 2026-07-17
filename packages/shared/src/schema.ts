import * as z from "zod"; // v4+ — resolves to npm "zod" (web/ext) or "npm:zod" (Deno via import map)

/**
 * Canonical enum value lists. These are the single source of truth for both the
 * Zod schemas below and the Postgres CHECK constraints in supabase/migrations.
 * If you change a value here, update the matching migration (and vice versa).
 */
export const MAIN_FIELDS = ["Tech", "Finance", "Healthcare", "Industry", "Other"] as const;
export const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "Onsite"] as const;
export const JOB_STATUSES = ["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Archived"] as const;
export const PARSE_STATUSES = ["ok", "needs_review"] as const;

export type MainField = (typeof MAIN_FIELDS)[number];
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export const MAX_SKILLS = 15;
/** Payload cap before transmission / before sending to the model (chars). */
export const RAW_TEXT_CAP = 20_000;

/**
 * AI extraction schema (camelCase) — the exact structured object we ask Gemini
 * to produce and then re-validate. Kept camelCase to match the model-facing
 * contract in the PRD; mapped to snake_case DB columns by `extractionToDbInsert`.
 *
 * NOTE on nullability + Gemini: nullable fields serialize to JSON Schema that the
 * @google/genai SDK accepts via `responseJsonSchema`. If a given model build
 * rejects `["string","null"]` unions, drop `.nullable()` here and post-process,
 * rather than silently dropping validation.
 */
export const JobExtractionSchema = z.object({
  companyName: z.string().trim().min(1),
  jobTitle: z.string().trim().min(1),
  relevantSkills: z.array(z.string().trim().toLowerCase()).max(MAX_SKILLS),
  yearsOfExperience: z.number().int().min(0).nullable(),
  mainField: z.enum(MAIN_FIELDS),
  workArrangement: z.enum(WORK_ARRANGEMENTS).nullable(),
  country: z.string().trim(),
  // Real city only — "Remote" is no longer stuffed here; use workArrangement.
  city: z.string().trim().nullable(),
});

export type JobExtraction = z.infer<typeof JobExtractionSchema>;

/**
 * Shape of a row in the `jobs` table (snake_case), as returned by Supabase.
 * Kept as a hand-written type (not Zod-inferred) because several columns are
 * DB-managed (id, timestamps) and never produced by the client.
 */
export interface JobRow {
  id: string;
  user_id: string;
  company_name: string;
  job_title: string;
  main_field: MainField;
  relevant_skills: string[];
  years_experience: number | null;
  country: string | null;
  city: string | null;
  work_arrangement: WorkArrangement | null;
  status: JobStatus;
  source_url: string;
  raw_text: string;
  parse_status: ParseStatus;
  created_at: string;
  updated_at: string;
}

/** Columns the backend writes on insert/upsert. DB fills id/timestamps/defaults. */
export type JobInsert = Pick<
  JobRow,
  | "user_id"
  | "company_name"
  | "job_title"
  | "main_field"
  | "relevant_skills"
  | "years_experience"
  | "country"
  | "city"
  | "work_arrangement"
  | "source_url"
  | "raw_text"
  | "parse_status"
> & { status?: JobStatus };

export interface ExtractionToDbArgs {
  userId: string;
  sourceUrl: string;
  rawText: string;
  parseStatus?: ParseStatus;
}

/** Map a validated AI extraction + request context into a DB insert row. */
export function extractionToDbInsert(
  extraction: JobExtraction,
  { userId, sourceUrl, rawText, parseStatus = "ok" }: ExtractionToDbArgs,
): JobInsert {
  return {
    user_id: userId,
    company_name: extraction.companyName,
    job_title: extraction.jobTitle,
    main_field: extraction.mainField,
    relevant_skills: extraction.relevantSkills,
    years_experience: extraction.yearsOfExperience,
    country: extraction.country || null,
    city: extraction.city,
    work_arrangement: extraction.workArrangement,
    source_url: sourceUrl,
    raw_text: rawText.slice(0, RAW_TEXT_CAP),
    parse_status: parseStatus,
  };
}

/** Request body the extension/web client POSTs to the parse Edge Function. */
export const ParseRequestSchema = z.object({
  rawText: z.string().min(1).max(RAW_TEXT_CAP),
  sourceUrl: z.string().url(),
});

export type ParseRequest = z.infer<typeof ParseRequestSchema>;
