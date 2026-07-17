import { GoogleGenAI } from "@google/genai";
import * as z from "zod";
import {
  JobExtractionSchema,
  RAW_TEXT_CAP,
  type JobExtraction,
} from "@job-analyzer/shared";

// Precompute the JSON Schema once. Strip "$schema" — the Gemini API rejects the
// meta key. Everything else (enums, nullable anyOf, maxItems) it accepts via
// responseJsonSchema.
const RESPONSE_JSON_SCHEMA = (() => {
  const s = z.toJSONSchema(JobExtractionSchema) as Record<string, unknown>;
  delete s["$schema"];
  return s;
})();

// Model is overridable via the GEMINI_MODEL secret so a retirement (as happened
// with gemini-2.5-flash-lite) never requires a code change. The default is the
// "-latest" alias, which tracks the current cheapest flash-lite tier.
// `||` (not `??`) so an empty GEMINI_MODEL="" in an env file also falls back.
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-flash-lite-latest";

const SYSTEM_INSTRUCTION = `You extract clean, structured fields from raw job-posting text.
Rules:
- Do NOT invent details. If a field is genuinely absent, use null (or [] for skills).
- relevantSkills: lowercase technical/core skills only, max 15, no duplicates.
  Normalize spellings of the SAME skill (e.g. "ReactJS", "React.js", "react" -> "react")
  but keep genuinely distinct skills separate ("react native" is NOT "react").
- yearsOfExperience: the MINIMUM integer years required ("3-5 years" -> 3, "2+ years" -> 2,
  "minimum 2 years" -> 2). null if unspecified.
- mainField: exactly one of Tech, Finance, Healthcare, Industry, Other.
- workArrangement: Remote, Hybrid, or Onsite; null if undetermined.
- country: the full English country name for consistent grouping (e.g. "United States",
  not "USA"/"US"; "United Kingdom", not "UK"). null if not determinable.
- city: the actual city only. Never put "Remote"/"Hybrid" here — that's workArrangement.`;

/**
 * Send raw job text to Gemini with a strict response schema, then re-validate
 * with Zod so the transforms (lowercasing/trimming) and constraints actually run.
 * Throws on missing key, empty response, or schema-invalid output — the caller
 * routes those to a needs_review row.
 */
export async function parseJobText(rawText: string): Promise<JobExtraction> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: rawText.slice(0, RAW_TEXT_CAP),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");

  // Actually validate + run transforms (this was the bug called out in the PRD).
  return JobExtractionSchema.parse(JSON.parse(text));
}
