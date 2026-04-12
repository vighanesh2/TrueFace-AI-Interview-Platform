/** Build the knowledge blob sent to the interview brain and technical chat context. */

export type JobProfileFields = {
  jobTitle: string;
  company: string;
  jobDescription: string;
  resumeText: string;
  /** Optional session hints (e.g. LiveAvatar, mode). */
  sessionNote?: string;
};

const FALLBACK_KNOWLEDGE = "Mock interview session. No candidate profile was provided.";

/**
 * Builds context from whatever the user filled in. Omitted empty fields.
 * Always includes session note when provided; otherwise uses fallback if nothing else exists.
 */
export function buildInterviewKnowledge(fields: JobProfileFields): string {
  const parts: string[] = [];
  const title = fields.jobTitle.trim();
  const company = fields.company.trim();
  const jd = fields.jobDescription.trim();
  const resume = fields.resumeText.trim();
  const note = fields.sessionNote?.trim();

  if (title) parts.push(`[Target job title]\n${title}`);
  if (company) parts.push(`[Company]\n${company}`);
  if (jd) parts.push(`[Job description]\n${jd}`);
  if (resume) parts.push(`[Resume text]\n${resume}`);
  if (note) parts.push(`[Session]\n${note}`);

  if (parts.length === 0) {
    return FALLBACK_KNOWLEDGE;
  }
  return parts.join("\n\n");
}
