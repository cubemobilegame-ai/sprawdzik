// EduSkan – serwer pośredniczący do Claude API.
// Trzyma klucz API po stronie serwera. Niczego nie zapisuje i nie loguje treści zdjęć.

const MODELS = {
  fast: process.env.MODEL_FAST || "claude-haiku-5-5",
  precise: process.env.MODEL_PRECISE || "claude-sonnet-5-5",
};
// USD za 1 mln tokenów [wejście, wyjście]
const PRICES = {
  "claude-haiku-5-5": [0.10, 0.50],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};
const USD_PLN = parseFloat(process.env.USD_PLN || "3.7");
const VAT = 1.23;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Aplikacja na Androida (Capacitor) działa pod adresem https://localhost – tylko ją wpuszczamy z innego adresu.
  const origin = req.headers.origin || "";
  if (["https://localhost", "http://localhost", "capacitor://localhost"].includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-app-code");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const appCode = process.env.APP_CODE;
  if (appCode && req.headers["x-app-code"] !== appCode) {
    return res.status(401).json({ error: "code" });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "no_key" });

  const { prompt, images = [], tier } = req.body || {};
  if (typeof prompt !== "string" || !prompt || prompt.length > 60000) {
    return res.status(400).json({ error: "prompt" });
  }
  if (!Array.isArray(images) || images.length > 5 || images.some((i) => typeof i !== "string")) {
    return res.status(400).json({ error: "images" });
  }
  if (images.reduce((a, i) => a + i.length, 0) > 6_000_000) {
    return res.status(413).json({ error: "too_large" });
  }

  // Kontrola kosztów (ustawiana w Vercel → Environment Variables, aplikacja nie może jej obejść):
  // COST_MODE=eco      – zawsze tani model (Haiku)
  // COST_MODE=balanced – (domyślnie) Haiku czyta prace; Sonnet tylko do wzorów i wycinków wątpliwych zadań
  // COST_MODE=precise  – pozwala aplikacji używać Sonnetu także do pierwszego odczytu
  const mode = (process.env.COST_MODE || "balanced").toLowerCase();
  const { purpose = "read" } = req.body || {};
  let wantPrecise = tier === "complex";
  if (mode === "eco") wantPrecise = false;
  else if (mode !== "precise" && purpose === "read") wantPrecise = false;
  const model = wantPrecise ? MODELS.precise : MODELS.fast;
  const content = [
    ...images.map((data) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data },
    })),
    { type: "text", text: prompt },
  ];

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: "user", content }],
      }),
    });
    if (!r.ok) {
      let msg = "";
      try { msg = JSON.stringify(await r.json()).toLowerCase(); } catch (e) {}
      if (msg.includes("credit balance")) return res.status(502).json({ error: "no_credits" });
      if (r.status === 401 || r.status === 403) return res.status(502).json({ error: "bad_key" });
      if (r.status === 404 || msg.includes("not_found_error")) return res.status(502).json({ error: "bad_model" });
      const status = r.status === 429 || r.status === 529 ? 429 : 502;
      return res.status(status).json({ error: "upstream", upstream: r.status });
    }
    const d = await r.json();
    const text = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const u = d.usage || {};
    const [pi, po] = PRICES[model] || [0, 0];
    const usd = ((u.input_tokens || 0) * pi + (u.output_tokens || 0) * po) / 1e6;
    return res.status(200).json({
      text,
      model,
      truncated: d.stop_reason === "max_tokens",
      usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 },
      costPLN: usd * USD_PLN * VAT,
    });
  } catch (e) {
    return res.status(502).json({ error: "network" });
  }
}
