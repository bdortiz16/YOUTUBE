// AGENTE 7 · DATOS — mide vistas, likes y suscriptores, y registra ingresos.
import { cfg } from "../config.js";
import { agente, db, guardar, emitir } from "../estado.js";
import { estadisticasVideos, estadisticasCanal, reporteAnalytics, retencionPorVideo } from "../youtube.js";
import * as tesoreria from "./tesoreria.js";

export async function run() {
  const a = agente("datos");
  a.modo(cfg.youtube ? "real" : "demo");
  const publicados = db.videos.filter((v) => v.estado === "publicado");
  if (!publicados.length) return;
  a.progreso(0.3, `Revisando métricas de ${publicados.length} videos…`);

  if (cfg.youtube) {
    const stats = await estadisticasVideos(publicados.map((v) => v.youtubeId).reverse());
    for (const s of stats) {
      const v = publicados.find((x) => x.youtubeId === s.id);
      if (v) v.metricas = { vistas: +s.statistics.viewCount || 0, likes: +s.statistics.likeCount || 0, comentarios: +s.statistics.commentCount || 0 };
    }
    const canal = await estadisticasCanal();
    db.canal.suscriptores = +canal?.subscriberCount || 0;
    db.canal.vistasTotales = +canal?.viewCount || 0;
    try {
      const ret = await retencionPorVideo(90);
      for (const v of publicados) if (ret[v.youtubeId]) v.metricas.retencion = ret[v.youtubeId].retencion;
    } catch (e) {
      a.log("Retención por video aún no disponible: " + e.message.slice(0, 100), "aviso");
    }
    try {
      const r = await reporteAnalytics(90);
      db.canal.vistas90d = r.views;
      db.canal.retencion = r.retencion;
      tesoreria.fijarIngresoReal(r.revenue); // ingresos reales de YouTube (si el canal ya está monetizado)
    } catch (e) {
      a.log("Analytics no disponible todavía: " + e.message.slice(0, 120), "aviso");
    }
  } else {
    // Simulación: cada Short crece con una curva de decaimiento + algo de suerte.
    for (const v of publicados) {
      const m = (v.metricas ||= { vistas: 0, likes: 0, comentarios: 0 });
      const edad = (Date.now() - v.publicado) / 60000 + 1;
      // En la simulación, un gancho mejor puntuado retiene más y la retención alta empuja el alcance
      const g = v.revision?.gancho ?? 7;
      m.retencion ??= Math.min(98, 45 + g * 5 + Math.random() * 15);
      const viral = v.suerte ?? (v.suerte = (Math.random() < 0.12 ? 8 : 1) * (m.retencion / 70));
      const nuevas = Math.round((Math.random() * 400 * viral) / Math.sqrt(edad));
      m.vistas += nuevas; m.likes += Math.round(nuevas * 0.04); m.comentarios += Math.round(nuevas * 0.004);
    }
    const total = publicados.reduce((s, v) => s + v.metricas.vistas, 0);
    db.canal.vistasTotales = total;
    db.canal.vistas90d = total;
    db.canal.suscriptores = Math.round(total * 0.003);
    db.canal.retencion = 70 + Math.random() * 25;
    tesoreria.fijarIngresoEstimado((total / 1000) * cfg.rpm);
  }

  db.canal.actualizado = Date.now();
  guardar();
  emitir("canal", db.canal);
  emitir("videos", db.videos.slice(-40));
  a.listo(`${db.canal.vistasTotales.toLocaleString("es")} vistas · ${db.canal.suscriptores} subs`, true);
}

/** Rendimiento por tema y por técnica de gancho, para que Gerente y Guion aprendan qué funciona. */
export function rendimientoPorTema() {
  const agrupar = (clave) => {
    const g = {};
    for (const v of db.videos.filter((v) => v.metricas && clave(v))) {
      const k = clave(v);
      (g[k] ||= { videos: 0, vistas: 0, ret: 0, nRet: 0 });
      g[k].videos++; g[k].vistas += v.metricas.vistas;
      if (v.metricas.retencion) { g[k].ret += v.metricas.retencion; g[k].nRet++; }
    }
    return Object.entries(g)
      .map(([nombre, d]) => ({ nombre, videos: d.videos, vistasProm: Math.round(d.vistas / d.videos), retencionProm: d.nRet ? Math.round(d.ret / d.nRet) : null }))
      .sort((a, b) => (b.retencionProm ?? 0) - (a.retencionProm ?? 0) || b.vistasProm - a.vistasProm);
  };
  const temas = agrupar((v) => v.idea?.tema).map((t) => ({ ...t, tema: t.nombre }));
  return { temas, tecnicas: agrupar((v) => v.guion?.tecnica) };
}

/** Frase corta con lo aprendido, para inyectar en el prompt del Guion. */
export function aprendizajes() {
  const { tecnicas } = rendimientoPorTema();
  const conDatos = tecnicas.filter((t) => t.videos >= 2 && t.retencionProm);
  if (conDatos.length < 2) return "";
  const mejor = conDatos[0], peor = conDatos.at(-1);
  return `ganchos de tipo "${mejor.nombre}" retienen ${mejor.retencionProm}% de media; "${peor.nombre}" solo ${peor.retencionProm}%. Prioriza lo que funciona.`;
}
