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
    const top = historial[0]?.tema;
    const idea = (Math.random() < 0.4 && ideas.find((i) => i.tema === top)) || ideas[Math.floor(Math.random() * ideas.length)];
    a.listo(`Aprobada idea: ${idea.tema}`);
    return { idea, costo: 0 };
  }

  const { datos, costo } = await preguntar({
    esfuerzo: "low",
    schema: { type: "object", additionalProperties: false, required: ["indice", "razon"], properties: { indice: { type: "integer" }, razon: { type: "string" } } },
    sistema: "Eres el gerente de un canal de Shorts de terror. Equilibras explotar lo que funciona con explorar temas nuevos (≈70/30) y evitas repetir formatos.",
    prompt: `Ideas candidatas:\n${ideas.map((i, n) => `${n}. ${i.tema} — ${i.gancho} (${i.porque})`).join("\n")}\n\nRendimiento histórico por tema (vistas promedio):\n${JSON.stringify(historial.slice(0, 10)) || "sin datos"}\n\nElige el índice de la mejor idea para el próximo video.`,
  });
  const idea = ideas[datos.indice] || ideas[0];
  a.listo(`Elegida: ${idea.tema} — ${datos.razon}`);
  return { idea, costo };
}

export async function revisar(guion) {
  const a = agente("gerente");
  a.trabajando(`Revisando guion “${guion.titulo}”`, 0.4);
  const palabras = guion.narracion.split(/\s+/).length;
  const recientes = db.videos.slice(-15).map((v) => v.guion?.titulo).filter(Boolean);

  if (!cfg.claude) {
    await espera(600);
    const ok = palabras >= 80 && palabras <= 190;
    ok ? a.listo("Guion aprobado ✅") : a.error(`Longitud fuera de rango (${palabras} palabras)`);
    return { aprobado: ok, notas: ok ? "" : "Ajusta a 120-150 palabras", costo: 0 };
  }

  const { datos, costo } = await preguntar({
    esfuerzo: "medium",
    schema: { type: "object", additionalProperties: false, required: ["aprobado", "notas"], properties: { aprobado: { type: "boolean" }, notas: { type: "string" } } },
    sistema: `Eres el gerente de calidad de un canal de YouTube de terror. Apruebas solo si el guion: (1) tiene gancho en la primera frase, (2) dura 120-150 palabras, (3) es original y distinto a los títulos recientes, (4) cumple las políticas de YouTube: sin gore gráfico, sin personas/crímenes reales, sin contenido para niños, sin clickbait engañoso, y aporta valor creativo (no es contenido repetitivo/plantilla).`,
    prompt: `Títulos recientes: ${recientes.join(" | ") || "ninguno"}\n\nGUION (${palabras} palabras):\nTítulo: ${guion.titulo}\n${guion.narracion}\n\nSi no lo apruebas, da notas concretas para reescribirlo.`,
  });
  datos.aprobado ? a.listo("Guion aprobado ✅") : a.error("Pide reescritura: " + datos.notas.slice(0, 120));
  return { ...datos, costo };
}
