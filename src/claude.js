// Cliente de Claude compartido por Tendencias, Guion y Gerente.
import Anthropic from "@anthropic-ai/sdk";
import { cfg } from "./config.js";

const MODELO = "claude-opus-5-5";
// Precio por millón de tokens (USD) para que la Tesorería lleve la cuenta.
const PRECIO = { entrada: 4, salida: 20 };

const client = cfg.claude ? new Anthropic() : null;

export function costoUsd(usage) {
  if (!usage) return 0;
  const entrada = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1;
  return (entrada * PRECIO.entrada + (usage.output_tokens || 0) * PRECIO.salida) / 1e6;
}

/**
 * Llama a Claude y devuelve { datos, costo }.
 * - schema: JSON Schema → salida estructurada garantizada.
 * - buscarWeb: activa la búsqueda web (para Tendencias); entonces el JSON se extrae del texto.
 */
export async function preguntar({ sistema, prompt, schema, buscarWeb = false, esfuerzo = "medium" }) {
  if (!client) throw new Error("Claude no configurado (falta ANTHROPIC_API_KEY)");

  const peticion = {
    model: MODELO,
    max_tokens: 16000,
    system: sistema,
    thinking: { type: "adaptive" },
    output_config: { effort: esfuerzo, ...(schema && !buscarWeb ? { format: { type: "json_schema", schema } } : {}) },
    // Si el modelo rechaza algo, la API lo reintenta en el modelo de respaldo recomendado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...(buscarWeb ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] } : {}),
    messages: [{ role: "user", content: prompt }],
  };

  let costo = 0;
  let resp;
  // Bucle por si la búsqueda web pausa el turno (pause_turn).
  for (let i = 0; i < 4; i++) {
    resp = await client.beta.messages.create(peticion);
    costo += costoUsd(resp.usage);
    if (resp.stop_reason !== "pause_turn") break;
    peticion.messages = [...peticion.messages, { role: "assistant", content: resp.content }];
  }

  if (resp.stop_reason === "refusal") throw new Error("Claude rechazó la petición: " + (resp.stop_details?.explanation || "sin detalle"));
  const texto = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!schema) return { datos: texto, costo };

  const json = buscarWeb ? (texto.match(/```json\s*([\s\S]*?)```/)?.[1] ?? texto.match(/[\[{][\s\S]*[\]}]/)?.[0]) : texto;
  try {
    return { datos: JSON.parse(json), costo };
  } catch {
    throw new Error("No pude leer el JSON que devolvió Claude");
  }
}
