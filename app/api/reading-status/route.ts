import { env } from "cloudflare:workers";

const keyPattern = /^[a-f0-9]{64}$/;

function readerKey(request: Request): string | null {
  const key = request.headers.get("x-reader-key")?.toLowerCase() ?? "";
  return keyPattern.test(key) ? key : null;
}

function response(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers: { "Cache-Control": "no-store", ...init.headers } });
}

export async function GET(request: Request) {
  const key = readerKey(request);
  const ids = new URL(request.url).searchParams.get("noteIds")?.split(",").filter(Boolean) ?? [];
  if (!key || ids.length > 300 || ids.some((id) => id.length > 240)) return response({ error: "请求无效" }, { status: 400 });
  if (!ids.length) return response({ readIds: [] });
  const placeholders = ids.map(() => "?").join(",");
  const result = await env.DB.prepare(`SELECT note_id FROM reading_statuses WHERE reader_key = ? AND note_id IN (${placeholders})`).bind(key, ...ids).all<{ note_id: string }>();
  return response({ readIds: result.results.map((row) => row.note_id) });
}

export async function POST(request: Request) {
  const key = readerKey(request);
  const body = await request.json().catch(() => null) as { noteId?: unknown } | null;
  const noteId = typeof body?.noteId === "string" ? body.noteId : "";
  if (!key || !noteId || noteId.length > 240) return response({ error: "请求无效" }, { status: 400 });
  await env.DB.prepare(`INSERT INTO reading_statuses (reader_key, note_id, read_at) VALUES (?, ?, ?) ON CONFLICT(reader_key, note_id) DO UPDATE SET read_at = excluded.read_at`).bind(key, noteId, new Date().toISOString()).run();
  return response({ ok: true });
}
