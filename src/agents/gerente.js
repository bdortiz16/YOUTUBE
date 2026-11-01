// AGENTE 8 · GERENTE — elige la idea, revisa calidad/políticas y aprueba.
import { cfg } from "../config.js";
import { agente, db, espera } from "../estado.js";
import { preguntar } from "../claude.js";
import { rendimientoPorTema } from "./datos.js";

export async function elegir(ideas) {
  const a = agente("gerente");
  a.modo(cfg.claude ? "real" : "demo");
  a.trabajando("Eligiendo la mejor idea según los datos…", 0.3);
  const historial = rendimientoPorTema();

  if (!cfg.claude) {
    await espera(700);
    const top = historial.temas[0]?.tema;
    const idea = (Math.random() < 0.4 && ideas.find((i) => i.tema === top)) || ideas[Math.floor(Math.random() * ideas.length)];
    a.listo(`Aprobada idea: ${idea.tema}`);
    return { idea, costo: 0 };
  }

  const { datos, costo } = await preguntar({
    esfuerzo: "low",
    schema: { type: "object", additionalProperties: false, required: ["indice", "razon"], properties: { indice: { type: "integer" }, razon: { type: "string" } } },
    sistema: "Eres el gerente de un canal de Shorts de terror. Equilibras explotar lo que funciona con explorar temas nuevos (≈70/30) y evitas repetir formatos.",
    prompt: `Ideas candidatas:\n${ideas.map((i, n) => `${n}. ${i.tema} — "${i.gancho}" [${i.tecnica || "?"}] (${i.porque})`).join("\n")}

Rendimiento de NUESTRO canal por tema y por técnica de gancho (vistas y retención promedio):
${JSON.stringify(historial) || "sin datos aún"}

Patrones virales de la semana: ${JSON.stringify(db.virales?.patrones || [])}

Elige el índice de la idea con más probabilidad de viralizar.`,
  });
  const idea = ideas[datos.indice] || ideas[0];
  a.listo(`Elegida: ${idea.tema} — ${datos.razon}`);
  return { idea, costo };
}

// Rúbrica de viralidad (0-10 cada una). El guion pasa solo si el gancho ≥ 8 y el promedio ≥ 7.
const CRITERIOS = {
  gancho: "¿La primera frase crea un bucle abierto y entra al conflicto sin preámbulo? ¿Haría parar el dedo en 2 s?",
  escalada: "¿Cada 5-8 s aparece un detalle nuevo y más inquietante? ¿Hay algún tramo que aburra?",
  giro: "¿El final sorprende y recontextualiza la historia?",
  bucle: "¿La última frase conecta con la primera para que el reinicio se sienta continuo?",
  titulo: "¿Título + texto en pantalla añaden curiosidad sin repetir el gancho ni engañar?",
  originalidad: "¿Es distinto a los títulos recientes del canal y no copia historias conocidas?",
};

export async function revisar(guion) {
  const a = agente("gerente");
  a.trabajando(`Revisando guion “${guion.titulo}” con la rúbrica viral`, 0.4);
  const palabras = guion.narracion.split(/\s+/).length;
  const recientes = db.videos.slice(-15).map((v) => v.guion?.titulo).filter(Boolean);

  if (!cfg.claude) {
    await espera(600);
    const ok = palabras >= 80 && palabras <= 190;
    const notas = { gancho: 8, escalada: 7, giro: 8, bucle: 6, titulo: 7, originalidad: 8 };
    ok ? a.listo("Guion aprobado ✅ · gancho 8/10") : a.error(`Longitud fuera de rango (${palabras} palabras)`);
    return { aprobado: ok, notas: ok ? "" : "Ajusta a 120-150 palabras", puntuacion: notas, costo: 0 };
  }

  const props = Object.fromEntries(Object.keys(CRITERIOS).map((k) => [k, { type: "integer" }]));
  const { datos, costo } = await preguntar({
    esfuerzo: "medium",
    schema: {
      type: "object", additionalProperties: false,
      required: ["puntuacion", "cumplePoliticas", "notas"],
      properties: {
        puntuacion: { type: "object", additionalProperties: false, required: Object.keys(CRITERIOS), properties: props },
        cumplePoliticas: { type: "boolean" },
        notas: { type: "string", description: "Correcciones concretas, empezando por los criterios con nota más baja" },
      },
    },
    sistema: `Eres el gerente de un canal de Shorts de terror y eres exigente: solo publicas lo que puede retener. Puntúa de 0 a 10 cada criterio, sin regalar notas:
${Object.entries(CRITERIOS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
Políticas (cumplePoliticas=false si falla alguna): sin gore gráfico, sin personas/crímenes reales, nada dirigido a niños, sin clickbait engañoso, contenido original con valor creativo (no plantilla repetitiva).`,
    prompt: `Títulos recientes del canal: ${recientes.join(" | ") || "ninguno"}

GUION (${palabras} palabras)
Ganchos alternativos: ${(guion.ganchos || []).map((g, i) => `${i}. ${g.texto} [${g.tecnica}]`).join(" / ")}
Texto en pantalla (0-2 s): ${guion.textoGancho}
Título: ${guion.titulo}
Narración:
${guion.narracion}`,
  });
  const p = datos.puntuacion;
  const media = Object.values(p).reduce((s, x) => s + x, 0) / Object.values(p).length;
  const aprobado = datos.cumplePoliticas && p.gancho >= 8 && media >= 7 && palabras >= 100 && palabras <= 175;
  const resumen = `gancho ${p.gancho}/10 · media ${media.toFixed(1)}`;
  aprobado ? a.listo(`Guion aprobado ✅ · ${resumen}`) : a.error(`Reescritura (${resumen}): ${datos.notas.slice(0, 110)}`);
  return { aprobado, notas: datos.notas, puntuacion: p, costo };
}
