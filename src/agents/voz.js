// AGENTE 3 · VOZ Y SONIDO — narrador con voz propia, música original, efectos sincronizados y mezcla final.
import path from "node:path";
import { cfg } from "../config.js";
import { agente, espera } from "../estado.js";
import { ffmpeg, duracion } from "../ffmpeg.js";
import { audioCfg, narrar, palabrasEstimadas, musica, efecto, selloSonoro, momentoDeFrase, mezclar } from "../audio.js";

export async function run(video) {
  const a = agente("voz");
  a.modo(audioCfg.real ? "real" : "demo");
  const g = video.guion;
  let costo = 0;

  // 1) Narrador
  a.trabajando("🎙️ Grabando al narrador…", 0.05);
  let voz;
  if (audioCfg.real) {
    voz = await narrar({ id: video.id, texto: g.narracion, actuado: g.narracionActuada }, (t) => a.log(t));
    costo += ((g.narracionActuada || g.narracion).length / 1000) * cfg.elevenUsdPor1k;
  } else {
    // Demo: pista guía de la duración estimada (≈2,6 palabras/seg)
    const seg = Math.min(58, Math.max(20, g.narracion.split(/\s+/).length / 2.6));
    const archivo = path.join(cfg.dirSalida, `${video.id}-voz.mp3`);
    for (let p = 0.1; p < 0.3; p += 0.1) { await espera(250); a.progreso(p); }
    await ffmpeg(["-f", "lavfi", "-i", `sine=frequency=180:duration=${seg}`, "-af", "volume=0.08,tremolo=f=4:d=0.7", "-q:a", "6", archivo]);
    voz = { archivo, segundos: await duracion(archivo), palabras: palabrasEstimadas(g.narracion, seg) };
  }
  a.progreso(0.35, `Narración de ${voz.segundos.toFixed(1)} s`);

  // 2) Música, efectos y sello sonoro (en paralelo)
  const pedidos = [];
  if (audioCfg.musica) {
    a.progreso(0.45, "🎵 Componiendo la música…");
    pedidos.push(musica(video.id, g.sonido?.musica || "dark ambient drone, distant piano notes, slow heartbeat pulse", voz.segundos + 1).then((r) => ({ tipo: "musica", ...r })));
  }
  const lista = audioCfg.efectos ? (g.sonido?.efectos || []).slice(0, 6) : [];
  lista.forEach((fx, i) => {
    const respaldo = ((i + 1) / (lista.length + 1)) * voz.segundos;
    const t = Math.max(0, momentoDeFrase(fx.frase || "", voz.palabras, respaldo) - 0.15);
    pedidos.push(efecto(video.id, i + 1, fx.descripcion, fx.duracion || 2.5).then((r) => ({ tipo: "efecto", t, volumen: fx.volumen, ...r })));
  });
  pedidos.push(selloSonoro().then((r) => ({ tipo: "sello", ...r })));

  const resultados = await Promise.allSettled(pedidos);
  const ok = resultados.filter((r) => r.status === "fulfilled").map((r) => r.value);
  resultados.filter((r) => r.status === "rejected").forEach((r) => a.log("Sonido omitido: " + r.reason.message.slice(0, 120), "aviso"));
  costo += ok.reduce((s, r) => s + (r.costo || 0), 0);
  const efectos = ok.filter((r) => r.tipo === "efecto");
  a.progreso(0.8, `🎚️ Mezclando voz + música + ${efectos.length} efectos…`);

  // 3) Mezcla final a -14 LUFS
  const mezcla = await mezclar({
    id: video.id,
    voz: voz.archivo,
    musica: ok.find((r) => r.tipo === "musica")?.archivo,
    sello: ok.find((r) => r.tipo === "sello")?.archivo,
    efectos,
    segundos: voz.segundos + 0.8,
  });

  a.listo(`Audio listo: ${voz.segundos.toFixed(1)} s · ${audioCfg.musica ? "música + " : ""}${efectos.length} efectos`);
  return { audio: mezcla, segundos: voz.segundos, palabras: voz.palabras, efectos: efectos.map((e) => ({ t: +e.t.toFixed(2) })), costo };
}
