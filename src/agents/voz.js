// AGENTE 3 · VOZ — narra el guion (ElevenLabs) o genera una pista guía en demo.
import fs from "node:fs";
import path from "node:path";
import { cfg } from "../config.js";
import { agente, espera } from "../estado.js";
import { ffmpeg, duracion } from "../ffmpeg.js";

export async function run(video) {
  const a = agente("voz");
  a.modo(cfg.eleven ? "real" : "demo");
  const texto = video.guion.narracion;
  const salida = path.join(cfg.dirSalida, `${video.id}-voz.mp3`);
  a.trabajando("Grabando la narración…", 0.1);

  if (cfg.eleven) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.elevenVoz}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: texto,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 },
      }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
    fs.writeFileSync(salida, Buffer.from(await r.arrayBuffer()));
  } else {
    // Demo: sin voz real, generamos un zumbido grave de la duración estimada (≈2,6 palabras/seg)
    const seg = Math.min(58, Math.max(20, texto.split(/\s+/).length / 2.6));
    for (let p = 0.2; p < 0.8; p += 0.2) { await espera(300); a.progreso(p); }
    await ffmpeg(["-f", "lavfi", "-i", `sine=frequency=55:duration=${seg}`, "-af", "volume=0.25,afade=t=in:d=2", "-q:a", "6", salida]);
  }

  const seg = await duracion(salida);
  const costo = cfg.eleven ? (texto.length / 1000) * cfg.elevenUsdPor1k : 0;
  a.listo(`Narración de ${seg.toFixed(1)} s`);
  return { audio: salida, segundos: seg, costo };
}
