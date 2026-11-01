// AGENTE 1 · TENDENCIAS — qué temas de terror están funcionando ahora mismo.
import { cfg } from "../config.js";
import { agente, db, espera } from "../estado.js";
import { preguntar } from "../claude.js";

const BANCO_DEMO = [
  { tema: "Reglas de un trabajo nocturno", gancho: "Si escuchas tu nombre por el altavoz, NO contestes.", porque: "Formato 'reglas' tiene retención altísima" },
  { tema: "Mensajes de un número desconocido", gancho: "Me escribió alguien con mi propio número.", porque: "Terror digital, muy compartible" },
  { tema: "Leyenda urbana latinoamericana reinventada", gancho: "Mi abuela cerraba todas las ventanas a las 3:33.", porque: "Nostalgia + folclore, público hispano" },
  { tema: "Grabaciones de cámara de seguridad", gancho: "La cámara del pasillo grabó algo que no estaba ahí.", porque: "Found footage sigue en alza" },
  { tema: "Cosas que no debes hacer al mudarte", gancho: "El dueño anterior dejó una nota en el sótano.", porque: "Hook de lista + misterio" },
  { tema: "Liminal spaces / backrooms", gancho: "El ascensor marcó un piso que no existe.", porque: "Estética viral entre Gen Z" },
];

export async function run() {
  const a = agente("tendencias");
  a.modo(cfg.claude ? "real" : "demo");
  a.trabajando("Escaneando lo que está de moda en terror…", 0.1);
  const usados = db.videos.slice(-20).map((v) => v.idea?.tema).filter(Boolean);

  if (!cfg.claude) {
    for (let p = 0.2; p <= 1; p += 0.2) { await espera(500); a.progreso(p); }
    const ideas = BANCO_DEMO.filter((i) => !usados.includes(i.tema)).sort(() => Math.random() - 0.5).slice(0, 4);
    a.listo(`${ideas.length} ideas encontradas`);
    return { ideas: ideas.length ? ideas : BANCO_DEMO.slice(0, 3), costo: 0 };
  }

  const { datos, costo } = await preguntar({
    buscarWeb: true,
    schema: true,
    sistema: "Eres un analista de tendencias de YouTube Shorts especializado en terror en español.",
    prompt: `Busca en la web qué temas, formatos y leyendas de TERROR están en tendencia ahora mismo (${new Date().toISOString().slice(0, 10)}) en YouTube Shorts, TikTok y Reddit (r/nosleep, creepypasta) para público hispanohablante.
Evita estos temas ya usados: ${usados.join("; ") || "ninguno"}.
Devuelve SOLO un bloque \`\`\`json con un array de 5 objetos {"tema","gancho","porque"} donde "gancho" es una primera frase de 1 línea que atrape en 2 segundos. Las historias serán ficción original, nunca sobre personas reales.`,
  });
  const ideas = Array.isArray(datos) ? datos : datos.ideas;
  a.listo(`${ideas.length} tendencias detectadas`);
  return { ideas, costo };
}
