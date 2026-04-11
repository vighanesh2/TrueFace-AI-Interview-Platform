import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { VertexAI } from "@google-cloud/vertexai";
import type { Content, GenerateContentResult } from "@google-cloud/vertexai";

/** Matches the key file you downloaded from GCP for project newface-493021. */
const DEFAULT_SERVICE_ACCOUNT_FILE = "newface-493021-1ef8bc846b2c.json";

export function resolveGcpServiceAccountKeyPath(): string | null {
  const raw =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    process.env.GCP_SERVICE_ACCOUNT_PATH?.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  }
  const fallback = path.join(process.cwd(), DEFAULT_SERVICE_ACCOUNT_FILE);
  if (existsSync(fallback)) return fallback;
  return null;
}

export function readServiceAccountProjectId(keyPath: string): string {
  const parsed = JSON.parse(readFileSync(keyPath, "utf8")) as {
    type?: string;
    project_id?: string;
  };
  if (parsed.type !== "service_account" || !parsed.project_id) {
    throw new Error("Expected a GCP service account JSON (type service_account).");
  }
  return parsed.project_id;
}

function textFromVertexResult(result: GenerateContentResult): string {
  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
    .join("");
}

export async function generateWithVertexGemini(
  keyPath: string,
  message: string,
  history: Content[] | undefined,
  systemInstruction: string
): Promise<string> {
  const project = readServiceAccountProjectId(keyPath);
  const location =
    process.env.GEMINI_VERTEX_LOCATION?.trim() || "us-central1";
  const model =
    process.env.GEMINI_VERTEX_MODEL?.trim() || "gemini-2.0-flash-001";

  const vertexAI = new VertexAI({
    project,
    location,
    googleAuthOptions: { keyFilename: keyPath },
  });

  const generativeModel = vertexAI.getGenerativeModel({
    model,
    systemInstruction,
  });

  const chat = generativeModel.startChat({
    history: history ?? [],
  });

  const result = await chat.sendMessage(message);
  return textFromVertexResult(result);
}
