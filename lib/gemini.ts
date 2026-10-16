const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

type Schema = Record<string, unknown>;

/**
 * Panggil Gemini dengan keluaran JSON terstruktur. Mencoba ulang pada
 * galat sementara (429 / 5xx) dengan jeda bertahap.
 */
export async function generateJson<T>(prompt: string, schema: Schema, opts: { retries?: number } = {}): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY belum diisi di .env.local");
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const retries = opts.retries ?? 3;

  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(75_000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING || "low" },
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        }),
      });
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`Gemini ${res.status}`), { retry: true });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("");
      if (!text) throw Object.assign(new Error("Gemini mengembalikan jawaban kosong"), { retry: true });
      return JSON.parse(text) as T;
    } catch (e) {
      lastErr = e;
      const retry = (e as { retry?: boolean }).retry || e instanceof SyntaxError || ["TypeError", "TimeoutError", "AbortError"].includes((e as Error).name);
      if (!retry || i === retries) break;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
