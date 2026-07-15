import {
  SubmissionValidationError,
  submitSponsoredTransaction,
} from "../../../../lib/sponsor";

const MAX_BODY_BYTES = 64_000;

function json(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

type Submit = typeof submitSponsoredTransaction;

export async function handleSubmit(
  request: Request,
  submit: Submit = submitSponsoredTransaction,
): Promise<Response> {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== expectedOrigin || (fetchSite && fetchSite !== "same-origin")) {
    return json({ error: "Forbidden." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Expected JSON." }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);

  let text: string;
  try {
    text = await request.text();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return json({ error: "Request too large." }, 413);
  }

  let transaction: unknown;
  try {
    const body = JSON.parse(text) as { transaction?: unknown };
    transaction = body?.transaction;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  if (typeof transaction !== "string") {
    return json({ error: "Transaction is required." }, 400);
  }

  let result: Awaited<ReturnType<Submit>>;
  try {
    result = await submit(transaction);
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return json({ error: "Transaction is not eligible for sponsorship." }, 400);
    }
    return json({ error: "Sponsored submission is unavailable." }, 500);
  }
  return json(result, 200);
}
