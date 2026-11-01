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

// ───────── Radar de virales ─────────
// Lectura pública: con YT_API_KEY basta; si no, usa el OAuth del canal.
async function publica(url) {
  if (process.env.YT_API_KEY) {
    const r = await fetch(url + (url.includes("?") ? "&" : "?") + "key=" + process.env.YT_API_KEY);
    if (!r.ok) throw new Error(`YouTube ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.json();
  }
  return api(url);
}

const iso = (d) => { // PT1M5S → segundos
  const m = d?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
};

/**
 * Busca Shorts de terror recientes y los ordena por velocidad (vistas por hora).
 * Cuota: cada búsqueda cuesta 100 unidades de las 10.000 diarias gratis.
 */
export async function buscarVirales({ consultas, dias = 7, idioma = "es", region = "" }) {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const ids = new Set();
  for (const q of consultas) {
    const p = new URLSearchParams({ part: "snippet", type: "video", videoDuration: "short", order: "viewCount", publishedAfter: desde, relevanceLanguage: idioma, maxResults: "25", q, ...(region ? { regionCode: region } : {}) });
    const j = await publica(`https://www.googleapis.com/youtube/v3/search?${p}`);
    j.items?.forEach((it) => ids.add(it.id.videoId));
  }
  const lista = [...ids];
  const videos = [];
  for (let i = 0; i < lista.length; i += 50) {
    const j = await publica(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${lista.slice(i, i + 50).join(",")}`);
    videos.push(...(j.items || []));
  }
  return videos
    .map((v) => {
      const horas = Math.max(1, (Date.now() - new Date(v.snippet.publishedAt)) / 36e5);
      const vistas = +v.statistics.viewCount || 0;
      return {
        id: v.id,
        titulo: v.snippet.title,
        canal: v.snippet.channelTitle,
        descripcion: (v.snippet.description || "").slice(0, 200),
        vistas,
        likes: +v.statistics.likeCount || 0,
        comentarios: +v.statistics.commentCount || 0,
        segundos: iso(v.contentDetails.duration),
        horas: Math.round(horas),
        vistasPorHora: Math.round(vistas / horas),
        engagement: vistas ? ((+v.statistics.likeCount || 0) + (+v.statistics.commentCount || 0) * 3) / vistas : 0,
        url: `https://youtube.com/shorts/${v.id}`,
      };
    })
    .filter((v) => v.segundos > 0 && v.segundos <= 180)
    .sort((a, b) => b.vistasPorHora - a.vistasPorHora)
    .slice(0, 20);
}

/** Retención (% visto) y vistas por video de MI canal. */
export async function retencionPorVideo(dias = 90) {
  const fin = new Date().toISOString().slice(0, 10);
  const ini = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
  const q = new URLSearchParams({ ids: "channel==MINE", startDate: ini, endDate: fin, dimensions: "video", metrics: "views,averageViewPercentage", sort: "-views", maxResults: "200" });
  const j = await api(`https://youtubeanalytics.googleapis.com/v2/reports?${q}`);
  return Object.fromEntries((j.rows || []).map(([id, views, pct]) => [id, { views, retencion: pct }]));
}
