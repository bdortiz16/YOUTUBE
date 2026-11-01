// Cliente mínimo de YouTube Data API v3 + YouTube Analytics (OAuth con refresh token).
import fs from "node:fs";

let token = null, expira = 0;
async function accessToken() {
  if (token && Date.now() < expira - 60_000) return token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YT_CLIENT_ID,
      client_secret: process.env.YT_CLIENT_SECRET,
      refresh_token: process.env.YT_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("OAuth YouTube: " + JSON.stringify(j));
  token = j.access_token;
  expira = Date.now() + j.expires_in * 1000;
  return token;
}

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${await accessToken()}`, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`YouTube ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.status === 204 ? null : r.json();
}

/** Subida resumible de un video. Devuelve el videoId. */
export async function subirVideo(archivo, metadatos) {
  const tam = fs.statSync(archivo).size;
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(tam),
    },
    body: JSON.stringify(metadatos),
  });
  if (!init.ok) throw new Error(`YouTube init ${init.status}: ${await init.text()}`);
  const destino = init.headers.get("location");
  const r = await fetch(destino, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(tam) }, body: fs.readFileSync(archivo) });
  if (!r.ok) throw new Error(`YouTube upload ${r.status}: ${await r.text()}`);
  return (await r.json()).id;
}

export async function ponerMiniatura(videoId, png) {
  return api(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
    method: "POST", headers: { "Content-Type": "image/png" }, body: fs.readFileSync(png),
  });
}

export async function estadisticasVideos(ids) {
  if (!ids.length) return [];
  const j = await api(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.slice(0, 50).join(",")}`);
  return j.items;
}

export async function estadisticasCanal() {
  const j = await api("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true");
  return j.items?.[0]?.statistics;
}

/** Ingresos y vistas reales de los últimos N días (requiere canal monetizado + scope monetario). */
export async function reporteAnalytics(dias = 90) {
  const fin = new Date().toISOString().slice(0, 10);
  const ini = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
  const q = new URLSearchParams({ ids: "channel==MINE", startDate: ini, endDate: fin, metrics: "views,estimatedRevenue,averageViewPercentage" });
  const j = await api(`https://youtubeanalytics.googleapis.com/v2/reports?${q}`);
  const [views, revenue, retencion] = j.rows?.[0] || [0, 0, 0];
  return { views, revenue, retencion };
}
