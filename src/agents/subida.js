// AGENTE 6 · SUBIDA — publica el Short en YouTube.
import { cfg } from "../config.js";
import { agente, espera } from "../estado.js";
import { subirVideo, ponerMiniatura } from "../youtube.js";

export async function run(video) {
  const a = agente("subida");
  a.modo(cfg.youtube ? "real" : "demo");
  const g = video.guion;
  a.trabajando(`Subiendo “${g.titulo}”…`, 0.1);

  if (!cfg.youtube) {
    for (let p = 0.2; p <= 1; p += 0.2) { await espera(400); a.progreso(p); }
    a.listo("Publicado (simulado)");
    return { youtubeId: "demo-" + video.id, url: null };
  }

  const titulo = g.titulo.includes("#") ? g.titulo : `${g.titulo} #shorts`;
  const id = await subirVideo(video.archivo, {
    snippet: {
      title: titulo.slice(0, 100),
      description: g.descripcion,
      tags: g.tags,
      categoryId: "24", // Entretenimiento
      defaultLanguage: "es",
      defaultAudioLanguage: "es",
    },
    status: {
      privacyStatus: cfg.ytPrivacidad,
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true, // Declaración de contenido generado/alterado con IA
    },
  });
  a.progreso(0.85, "Poniendo miniatura…");
  try { await ponerMiniatura(id, video.miniatura); }
  catch (e) { a.log("Miniatura no aplicada (¿canal sin verificar?): " + e.message, "aviso"); }
  a.listo(`Publicado (${cfg.ytPrivacidad}): youtu.be/${id}`);
  return { youtubeId: id, url: `https://youtube.com/shorts/${id}` };
}
