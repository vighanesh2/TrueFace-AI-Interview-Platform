import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Google AI (Gemini) key for `@google/generative-ai`.
 *
 * 1. `GEMINI_API_KEY` — plain key (recommended for `.env.local`).
 * 2. `GEMINI_CREDENTIALS_PATH` — path to a JSON file (project root-relative or absolute).
 *    Reads `api_key`, `apiKey`, `key`, or `GEMINI_API_KEY` from the root object.
 *
 * GCP **service account** JSON (`"type": "service_account"`) is not usable with this
 * SDK; use an API key from https://aistudio.google.com/apikey
 */
export function resolveGeminiApiKey(): string | undefined {
  const fromEnv = process.env.GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  const filePath = process.env.GEMINI_CREDENTIALS_PATH?.trim();
  if (!filePath) return undefined;

  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!existsSync(absolute)) {
    console.error(
      `[gemini] GEMINI_CREDENTIALS_PATH file not found: ${absolute}`
    );
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(absolute, "utf8")) as Record<
      string,
      unknown
    >;

    if (parsed.type === "service_account") {
      console.error(
        "[gemini] This file is a GCP service account key. Use a Google AI Studio API key in GEMINI_API_KEY, or switch to Vertex AI. https://aistudio.google.com/apikey"
      );
      return undefined;
    }

    const candidates = [
      parsed.api_key,
      parsed.apiKey,
      parsed.key,
      parsed.GEMINI_API_KEY,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  } catch (e) {
    console.error("[gemini] Failed to parse credentials JSON:", e);
  }

  return undefined;
}
