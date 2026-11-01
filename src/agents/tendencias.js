// AGENTE 1 · TENDENCIAS — radar de virales + análisis de patrones de gancho.
//  1) Busca en YouTube los Shorts de terror que más rápido crecen (vistas por hora)
//  2) Claude estudia POR QUÉ funcionan (gancho, título, formato) y busca tendencias en la web
//  3) Propone ideas ORIGINALES que usan esos patrones (nunca copia historias ajenas)
import { cfg } from "../config.js";
import { agente, db, guardar, emitir, espera } from "../estado.js";
import { preguntar } from "../claude.js";
import { buscarVirales } from "../youtube.js";

const CONSULTAS = [
  "historias de terror", "creepypasta español", "terror shorts", "historia de miedo real",
  "leyendas de terror", "reglas de terror", "historias de terror animadas", "relatos de terror",
];

// Técnicas de gancho que el Gerente y el Guion comparten (también sirven para medir cuál retiene más)
export const TECNICAS = [
  "regla/prohibición", "segunda persona (si tú…)", "dato imposible", "confesión",
  "contradicción", "cuenta regresiva/hora exacta", "objeto cotidiano siniestro", "in medias res",
];

const VIRALES_DEMO = [
  { titulo: "Si tu reflejo parpadea primero, sal de la casa", canal: "Noche Eterna", vistas: 2_400_000, horas: 70, segundos: 48 },
  { titulo: "Trabajé en un hotel con 3 reglas… rompí la última", canal: "Relatos 404", vistas: 1_800_000, horas: 96, segundos: 57 },
  { titulo: "Mi hermana habla dormida… en un idioma que no existe", canal: "Susurros", vistas: 950_000, horas: 40, segundos: 41 },
  { titulo: "Nunca contestes un audio de tu propio número", canal: "Terror Corto", vistas: 1_200_000, horas: 110, segundos: 52 },
  { titulo: "El ascensor marcó el piso 13. El edificio tiene 12", canal: "Liminal ES", vistas: 640_000, horas: 30, segundos: 39 },
  { titulo: "Mi abuela dejaba un plato extra cada 2 de noviembre", canal: "Folclor Oscuro", vistas: 780_000, horas: 55, segundos: 58 },
].map((v, i) => ({ ...v, id: "demo" + i, vistasPorHora: Math.round(v.vistas / v.horas), engagement: 0.04 + i * 0.005, url: null })).sort((a, b) => b.vistasPorHora - a.vistasPorHora);

const IDEAS_DEMO = [
  { tema: "Reglas de un trabajo nocturno", gancho: "Si escuchas tu nombre por el altavoz, NO contestes.", tecnica: "regla/prohibición", porque: "Las reglas generan un bucle abierto: el espectador espera ver cuál se rompe" },
  { tema: "Mensajes de un número desconocido", gancho: "Me escribió alguien… desde mi propio número.", tecnica: "dato imposible", porque: "Imposible + cotidiano = curiosidad instantánea" },
  { tema: "Leyenda urbana latinoamericana reinventada", gancho: "Mi abuela cerraba todas las ventanas a las 3:33.", tecnica: "cuenta regresiva/hora exacta", porque: "Hora exacta + figura familiar; muy compartible en público hispano" },
  { tema: "Grabaciones de cámara de seguridad", gancho: "La cámara del pasillo grabó algo que no estaba ahí.", tecnica: "dato imposible", porque: "Formato found footage en alza" },
  { tema: "Cosas que no debes hacer al mudarte", gancho: "Si tu casa nueva tiene una puerta pintada, no la abras.", tecnica: "segunda persona (si tú…)", porque: "Le habla directo al espectador" },
  { tema: "Liminal spaces / backrooms", gancho: "El ascensor marcó un piso que no existe.", tecnica: "objeto cotidiano siniestro", porque: "Estética viral entre Gen Z" },
];

function publicarVirales(virales, patrones = []) {
  db.virales = { actualizado: Date.now(), lista: virales.slice(0, 12), patrones };
  guardar();
  emitir("virales", db.virales);
}

export async function run() {
  const a = agente("tendencias");
  a.modo(cfg.youtubeBusqueda || cfg.claude ? "real" : "demo");
  const usados = db.videos.slice(-20).map((v) => v.idea?.tema).filter(Boolean);

  // 1) Radar de virales
  a.trabajando("🔥 Buscando los Shorts de terror que más rápido crecen…", 0.1);
  let virales = VIRALES_DEMO;
  if (cfg.youtubeBusqueda) {
    try {
      const consultas = [...CONSULTAS].sort(() => Math.random() - 0.5).slice(0, 3);
      virales = await buscarVirales({ consultas, dias: 7, idioma: "es" });
      a.log(`Radar: ${virales.length} Shorts recientes; el más rápido va a ${virales[0]?.vistasPorHora?.toLocaleString("es")} vistas/hora`);
    } catch (e) {
      a.log("Radar de YouTube falló, sigo con búsqueda web: " + e.message.slice(0, 120), "aviso");
      virales = [];
    }
  } else {
    await espera(600);
  }
  publicarVirales(virales);
  a.progreso(0.45, "Analizando por qué funcionan…");

  // 2) Análisis de patrones + 3) ideas originales
  if (!cfg.claude) {
    await espera(800);
    const ideas = IDEAS_DEMO.filter((i) => !usados.includes(i.tema)).sort(() => Math.random() - 0.5).slice(0, 4);
    const patrones = [
      { patron: "Regla + consecuencia", ejemplo: VIRALES_DEMO[1].titulo, porque: "Bucle abierto: ¿qué pasa al romperla?" },
      { patron: "Imposible cotidiano", ejemplo: VIRALES_DEMO[4].titulo, porque: "Algo normal con UN detalle que no cuadra" },
      { patron: "Instrucción en 2ª persona", ejemplo: VIRALES_DEMO[0].titulo, porque: "El espectador se siente señalado" },
    ];
    publicarVirales(virales, patrones);
    a.listo(`${ideas.length} ideas con patrones virales`);
    return { ideas: ideas.length ? ideas : IDEAS_DEMO.slice(0, 3), costo: 0 };
  }

  const tabla = virales.slice(0, 15).map((v, i) =>
    `${i + 1}. "${v.titulo}" — ${v.vistas.toLocaleString("es")} vistas en ${v.horas} h (${v.vistasPorHora.toLocaleString("es")}/h), ${v.segundos}s, engagement ${(v.engagement * 100).toFixed(1)}%`).join("\n");

  const { datos, costo } = await preguntar({
    buscarWeb: true,
    schema: true,
    esfuerzo: "high",
    sistema: "Eres el analista de viralidad de un canal de YouTube Shorts de terror en español. Tu trabajo es entender por qué ciertos videos explotan y convertir esos patrones en ideas originales.",
    prompt: `Fecha: ${new Date().toISOString().slice(0, 10)}

SHORTS DE TERROR QUE MÁS RÁPIDO CRECEN ESTA SEMANA (radar de YouTube):
${tabla || "(sin datos del radar; usa solo la búsqueda web)"}

Tareas:
1. Analiza los títulos de arriba: qué técnicas de gancho, estructuras de título, temas y formatos se repiten en los que más vistas/hora tienen. Complementa con una búsqueda web rápida de tendencias de terror actuales (TikTok, Reddit r/nosleep, fechas cercanas como festividades).
2. Propón 5 ideas ORIGINALES que apliquen esos patrones. Prohibido copiar o parafrasear la historia de otro creador: usa el patrón, no el contenido.
3. Evita estos temas ya usados: ${usados.join("; ") || "ninguno"}.

Técnicas de gancho posibles: ${TECNICAS.join(", ")}.

Devuelve SOLO un bloque \`\`\`json con esta forma:
{"patrones":[{"patron":"…","ejemplo":"título del radar que lo usa","porque":"…"}],
 "ideas":[{"tema":"…","gancho":"primera frase de máx. 12 palabras que atrape en 2 segundos","tecnica":"una de la lista","porque":"qué patrón viral aplica"}]}`,
  });
  publicarVirales(virales, datos.patrones || []);
  const ideas = datos.ideas || datos;
  a.listo(`${ideas.length} ideas basadas en ${virales.length} virales`);
  return { ideas, costo };
}
