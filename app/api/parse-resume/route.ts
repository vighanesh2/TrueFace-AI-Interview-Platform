import { PDFParse } from "pdf-parse";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_TEXT_CHARS = 120_000;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF must be 6MB or smaller" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    let text = (result.text || "").replace(/\s+/g, " ").trim();
    if (!text.length) {
      return NextResponse.json(
        { error: "No text could be read from this PDF. Try another file or a text-based PDF." },
        { status: 422 }
      );
    }
    if (text.length > MAX_TEXT_CHARS) {
      text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n[Truncated for length]`;
    }
    return NextResponse.json({ text });
  } catch (e) {
    console.error("parse-resume:", e);
    return NextResponse.json({ error: "Could not parse this PDF" }, { status: 422 });
  } finally {
    await parser.destroy().catch(() => {});
  }
}
