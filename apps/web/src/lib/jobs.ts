import type { JobRow, JobStatus } from "@job-analyzer/shared";
import { getSupabase } from "./supabase";

// All queries are RLS-scoped to the signed-in user by the database, so no
// explicit user_id filter is needed here — the policies enforce it.

export async function listJobs(): Promise<JobRow[]> {
  const { data, error } = await getSupabase()
    .from("jobs")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobRow[];
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<JobRow> {
  const { data, error } = await getSupabase()
    .from("jobs")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as JobRow;
}

/** Fields a user may correct in the manual-edit modal. */
export type JobEdit = Partial<
  Pick<
    JobRow,
    | "company_name"
    | "job_title"
    | "main_field"
    | "relevant_skills"
    | "years_experience"
    | "country"
    | "city"
    | "work_arrangement"
    | "status"
    | "source_url"
  >
>;

export async function updateJob(id: string, fields: JobEdit): Promise<JobRow> {
  // A manual edit is a review, so clear the needs_review flag.
  const { data, error } = await getSupabase()
    .from("jobs")
    .update({ ...fields, parse_status: "ok" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as JobRow;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await getSupabase().from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
