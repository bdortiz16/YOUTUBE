// AGENTE 2 · GUION — escribe una historia original de 45-55 segundos.
import { cfg } from "../config.js";
import { agente, espera } from "../estado.js";
import { preguntar } from "../claude.js";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "narracion", "escenas", "descripcion", "tags", "textoMiniatura"],
  properties: {
    titulo: { type: "string", description: "Título < 60 caracteres, intrigante, sin clickbait engañoso" },
    narracion: { type: "string", description: "Texto completo a narrar, 120-150 palabras" },
    escenas: { type: "array", items: { type: "string" }, description: "5-7 descripciones visuales, una por momento" },
    descripcion: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    textoMiniatura: { type: "string", description: "2-4 palabras en mayúsculas para la portada" },
  },
};

const DEMO = {
  "Reglas de un trabajo nocturno": `Conseguí trabajo de guardia nocturno en un centro comercial cerrado. Me dieron una hoja con tres reglas. Uno: haz la ronda cada hora. Dos: si las escaleras eléctricas se encienden solas, no las mires. Tres: si escuchas tu nombre por el altavoz, no contestes. La primera noche todo fue normal. La segunda, las escaleras se encendieron a las tres y treinta y tres. No las miré. Pero escuché pasos subiendo… y bajando… y subiendo otra vez. La tercera noche el altavoz dijo mi nombre. Con la voz de mi madre. Me pedía ayuda. Lloraba. No contesté. Esta mañana la llamé para contarle. Contestó tranquila… y me dijo: ¿por qué no me respondiste anoche?`,
  default: `Mi abuela cerraba todas las ventanas a las tres y treinta y tres. Todas. Aunque hiciera calor. Decía que a esa hora la noche busca casas abiertas. Yo me reía. Cuando murió, me quedé con su casa. La primera noche dejé una ventana abierta, solo por llevarle la contraria. A las tres y treinta y tres escuché algo arrastrarse por el techo. Despacio. Buscando. Cerré la ventana de golpe. El ruido paró. Respiré. Entonces vi la nota pegada por dentro del vidrio, con la letra de mi abuela: gracias por cerrarla, mijo, llevo años esperando que alguien me deje entrar. La nota estaba del lado de adentro.`,
};

export async function run(idea, notasGerente = "") {
  const a = agente("guion");
  a.modo(cfg.claude ? "real" : "demo");
  a.trabajando(`Escribiendo: “${idea.tema}”`, 0.1);

  if (!cfg.claude) {
    for (let p = 0.2; p <= 1; p += 0.1) { await espera(350); a.progreso(p); }
    const narracion = DEMO[idea.tema] || DEMO.default;
    const g = {
      titulo: idea.gancho.length < 60 ? idea.gancho : idea.tema,
      narracion,
      escenas: ["Pasillo oscuro", "Luz parpadeante", "Silueta al fondo", "Primer plano de una nota", "Pantalla negra"],
      descripcion: `${idea.gancho}\nHistoria de ficción original. Sígueme para una nueva cada noche. #terror #historiasdeterror #shorts`,
      tags: ["terror", "historias de terror", "creepypasta", "shorts", "miedo"],
      textoMiniatura: { "Reglas de un trabajo nocturno": "NO CONTESTES", "Mensajes de un número desconocido": "ERA MI NÚMERO", "Grabaciones de cámara de seguridad": "¿QUÉ HAY AHÍ?" }[idea.tema] || "CIERRA LA VENTANA",
    };
    a.listo(`Guion listo: “${g.titulo}”`);
    return { guion: g, costo: 0 };
  }

  const { datos, costo } = await preguntar({
    schema: SCHEMA,
    esfuerzo: "high",
    sistema: `Eres el guionista de "${cfg.marca.nombre}", un canal de Shorts de terror en español neutro. Escribes ficción ORIGINAL, narrada en primera persona, con frases cortas para voz en off.
Reglas: el primer segundo es el gancho; tensión creciente; giro final que obligue a reverlo; 120-150 palabras; nada de gore explícito, nada sobre personas, lugares o crímenes reales, nada dirigido a niños. Cada historia debe sentirse distinta a las anteriores (evita contenido repetitivo).`,
    prompt: `Tema: ${idea.tema}\nGancho sugerido: ${idea.gancho}\nPor qué funciona: ${idea.porque}${notasGerente ? `\nCorrecciones del gerente: ${notasGerente}` : ""}`,
  });
  a.listo(`Guion listo: “${datos.titulo}”`);
  return { guion: datos, costo };
}
