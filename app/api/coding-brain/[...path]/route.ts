import { NextRequest, NextResponse } from "next/server";

const BASE = (process.env.INTERVIEW_BRAIN_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, segments: string[], method: string) {
  if (segments.length === 0) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const targetPath = segments.join("/");
  const url = `${BASE}/${targetPath}${req.nextUrl.search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    console.error("coding-brain proxy:", url, e);
    return NextResponse.json(
      {
        error:
          "Could not reach the Python interview API. Run: python3 -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000",
      },
      { status: 502 }
    );
  }

  const outHeaders = new Headers();
  const outCt = res.headers.get("content-type");
  if (outCt) outHeaders.set("content-type", outCt);

  const body = await res.arrayBuffer();
  return new NextResponse(body, { status: res.status, headers: outHeaders });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? [], "GET");
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? [], "POST");
}
