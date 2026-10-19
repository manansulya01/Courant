export type BoundedBodyResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 413; error: string };

export type BoundedJsonResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413; error: string };

/**
 * Read a request body under a strict byte limit. Content-Length is only an
 * early hint; the streaming byte count is authoritative.
 */
export async function readBoundedBytes(request: Request, maxBytes: number): Promise<BoundedBodyResult> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: "Request is too large." };
  }
  if (!request.body) return { ok: false, status: 400, error: "Request body is required." };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "Request is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "Could not read request body." };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  const bounded = await readBoundedBytes(request, maxBytes);
  if (!bounded.ok) {
    return {
      ok: false,
      status: bounded.status,
      error: bounded.status === 413 ? bounded.error : "Invalid JSON request body.",
    };
  }

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bounded.bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, status: 400, error: "Invalid JSON request body." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON request body." };
  }
}
