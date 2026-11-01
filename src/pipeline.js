// La cadena de montaje: Tesorería → Tendencias → Gerente → Guion → Gerente → Voz → Animación → Miniaturas → (tú) → Subida
import path from "node:path";
import { cfg } from "./config.js";
import { db, guardar, emitir, runtime, registrar, agente } from "./estado.js";
import * as tendencias from "./agents/tendencias.js";
import * as guion from "./agents/guion.js";
import * as voz from "./agents/voz.js";
import * as animacion from "./agents/animacion.js";
import * as miniaturas from "./agents/miniaturas.js";
import * as subida from "./agents/subida.js";
import * as datos from "./agents/datos.js";
import * as gerente from "./agents/gerente.js";
import * as tesoreria from "./agents/tesoreria.js";

const publico = (v) => ({ ...v, video: v.archivo && `/media/${path.basename(v.archivo)}`, mini: v.miniatura && `/media/${path.basename(v.miniatura)}`, audio: undefined, archivo: undefined, miniatura: undefined, palabras: undefined });
const actualizar = (v) => { guardar(); emitir("video", publico(v)); };
export const videosPublicos = () => db.videos.slice(-40).map(publico);

export async function producir() {
  if (runtime.produciendo) return registrar("gerente", "Ya hay un video en producción", "aviso");
  if (!tesoreria.autorizar()) return;
  runtime.produciendo = true;
  emitir("runtime", runtime);

  const v = { id: "v" + Date.now().toString(36), creado: Date.now(), estado: "produciendo", paso: "tendencias" };
  db.videos.push(v);
  try {
    const t = await tendencias.run();
    tesoreria.gasto("Claude · tendencias", t.costo);

    const e = await gerente.elegir(t.ideas);
    tesoreria.gasto("Claude · gerente", e.costo);
    v.idea = e.idea; v.paso = "guion"; actualizar(v);

    let notas = "";
    for (let intento = 1; intento <= 3; intento++) {
      const g = await guion.run(v.idea, notas, datos.aprendizajes());
      tesoreria.gasto("Claude · guion", g.costo);
      const r = await gerente.revisar(g.guion);
      tesoreria.gasto("Claude · revisión", r.costo);
      v.guion = g.guion;
      v.revision = r.puntuacion;
      if (r.aprobado) break;
      if (intento === 3) throw new Error("El gerente rechazó el guion tres veces; se descarta");
      notas = r.notas;
    }
    v.paso = "voz"; actualizar(v);

    const a = await voz.run(v);
    tesoreria.gasto("Voz, música y efectos", a.costo);
    Object.assign(v, { audio: a.audio, segundos: a.segundos, palabras: a.palabras, efectosSonido: a.efectos, paso: "animacion" }); actualizar(v);

    const vis = await animacion.prepararEscenas(v);
    tesoreria.gasto("Visuales IA", vis.costo);
    v.escenasIA = vis.escenas;
    const an = await animacion.run(v, vis.escenas);
    v.archivo = an.archivo; v.paso = "miniaturas"; actualizar(v);

    const m = await miniaturas.run(v);
    v.miniatura = m.miniatura;

    if (cfg.requiereAprobacion) {
      v.estado = "pendiente"; v.paso = "aprobacion"; actualizar(v);
      agente("gerente").listo(`“${v.guion.titulo}” espera TU aprobación`);
    } else {
      await publicar(v);
    }
    emitir("nuevoVideo", publico(v));
  } catch (err) {
    v.estado = "error"; v.error = err.message; actualizar(v);
    registrar("gerente", "Producción fallida: " + err.message, "error");
  } finally {
    runtime.produciendo = false;
    emitir("runtime", runtime);
  }
}

async function publicar(v) {
  v.paso = "subida"; actualizar(v);
  const s = await subida.run(v);
  Object.assign(v, s, { estado: "publicado", publicado: Date.now(), paso: "datos" });
  actualizar(v);
}

export async function aprobar(id, decision) {
  const v = db.videos.find((x) => x.id === id && x.estado === "pendiente");
  if (!v) return false;
  if (decision === "rechazar") { v.estado = "rechazado"; actualizar(v); registrar("gerente", `Rechazaste “${v.guion.titulo}”`); return true; }
  try { await publicar(v); } catch (e) { v.estado = "error"; v.error = e.message; actualizar(v); registrar("subida", e.message, "error"); }
  return true;
}

// ── Piloto automático ──
let temporizador = null;
export function autopiloto(encendido) {
  runtime.autopiloto = encendido;
  clearInterval(temporizador);
  if (encendido) {
    const cada = cfg.demo || !cfg.claude ? 45_000 : (24 * 3600_000) / cfg.videosPorDia;
    temporizador = setInterval(producir, cada);
    producir();
    registrar("gerente", `Piloto automático ON · un video cada ${Math.round(cada / 60000) || "<1"} min`);
  } else registrar("gerente", "Piloto automático OFF");
  emitir("runtime", runtime);
}

// El agente de datos revisa métricas periódicamente
setInterval(() => datos.run().catch((e) => registrar("datos", e.message, "error")), cfg.youtube ? 15 * 60_000 : 6000);
