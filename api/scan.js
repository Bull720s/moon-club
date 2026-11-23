// Estima calorías y macros de una foto de comida con Gemini. Requiere GEMINI_API_KEY en el proyecto moon-club de Vercel.
const ORIGENES = process.env.NODE_ENV === 'production' ? /^https:\/\/moon-club\.vercel\.app$/ : /^https:\/\/moon-club(-[a-z0-9-]+)?\.vercel\.app$|^http:\/\/localhost(:\d+)?$/;
const INSTRUCCIONES = `Eres nutriólogo en México. Mira la foto del plato y estima TODO lo que se ve.
Responde SOLO JSON: {"nombre":"nombre corto","porcion":"qué se ve, ej. 3 tacos con cebolla","kcal":n,"p":n,"c":n,"f":n,"confianza":"alta"|"media"|"baja"}
p, c y f son gramos de proteína, carbohidratos y grasa del plato completo, con valores típicos de México.
Si no hay comida en la foto responde {"error":"no_comida"}.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'método' });
  if (!ORIGENES.test(req.headers.origin || '')) return res.status(403).json({ error: 'origen' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'sin_llave' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const data = String(body.image || '').replace(/^data:image\/jpeg;base64,/, '');
  if (data.length < 500 || data.length > 1500000) return res.status(400).json({ error: 'imagen' });
  const pedir = (model, tc) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCCIONES }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data } }, { text: 'Estima las calorías y macros.' }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2, ...(tc && { thinkingConfig: tc }) }
    })
  });
  try {
    let r;
    for (const model of ['gemini-flash-latest', 'gemini-flash-lite-latest']) {
      for (const tc of [{ thinkingLevel: 'minimal' }, { thinkingBudget: 0 }]) {
        r = await pedir(model, tc).catch(() => ({ status: 504 }));
        if (r.status !== 400) break;
      }
      if (![429, 500, 503, 504].includes(r.status)) break;
    }
    if (!r.ok) return res.status(502).json({ error: 'ia' });
    const j = await r.json();
    const out = JSON.parse(j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '{}');
    if (out.error) return res.status(200).json({ error: 'no_comida' });
    const n = v => Math.max(0, Math.min(5000, Math.round(+v) || 0));
    return res.status(200).json({
      nombre: String(out.nombre || 'Plato').slice(0, 80), porcion: String(out.porcion || '').slice(0, 120),
      kcal: n(out.kcal), p: n(out.p), c: n(out.c), f: n(out.f),
      confianza: ['alta', 'media', 'baja'].includes(out.confianza) ? out.confianza : 'media'
    });
  } catch (e) {
    return res.status(500).json({ error: 'ia' });
  }
};
