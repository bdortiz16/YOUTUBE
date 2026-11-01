// AGENTE 4 · ANIMACIÓN — monta el Short vertical 1080x1920 con subtítulos dinámicos.
import fs from "node:fs";
import path from "node:path";
import { cfg } from "../config.js";
import { agente } from "../estado.js";
import { ffmpeg, hayFfmpeg } from "../ffmpeg.js";

const t = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = (s % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${x}`;
};

/** Subtítulos estilo Shorts: bloques de 3-4 palabras, centrados, grandes. */
function subtitulosASS(texto, segundos) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const bloques = [];
  for (let i = 0; i < palabras.length; i += 3) bloques.push(palabras.slice(i, i + 3).join(" "));
  const totalChars = bloques.reduce((s, b) => s + b.length + 4, 0);
  let cursor = 0.15;
  const eventos = bloques.map((b) => {
    const dur = ((b.length + 4) / totalChars) * (segundos - 0.3);
    const linea = `Dialogue: 0,${t(cursor)},${t(cursor + dur)},Story,,0,0,0,,{\\fad(60,60)}${b.toUpperCase().replace(/[{}]/g, "")}`;
    cursor += dur;
    return linea;
  });
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Story,DejaVu Sans,92,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,7,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${eventos.join("\n")}
`;
}

/** Renderiza cada escena (imagen con zoom lento o clip IA) como tramo 1080x1920 y las une con fundidos a negro. */
async function montarEscenas(video, escenas, D) {
  const n = escenas.length, d = D / n;
  const frames = Math.ceil(d * 30);
  const tramos = [];
  for (let i = 0; i < n; i++) {
    const esc = escenas[i];
    const out = path.join(cfg.dirSalida, `${video.id}-tramo${i}.mp4`);
    const fundido = `fade=t=in:st=0:d=0.35,fade=t=out:st=${(d - 0.35).toFixed(2)}:d=0.35`;
    const zoom = i % 2 === 0 ? "min(zoom+0.0009,1.22)" : "if(eq(on,0),1.22,max(zoom-0.0009,1.0))";
    const entrada = esc.tipo === "video" ? ["-stream_loop", "-1", "-i", esc.archivo] : ["-i", esc.archivo];
    const vf = esc.tipo === "video"
      ? `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,${fundido}`
      : `scale=1350:2400:force_original_aspect_ratio=increase,crop=1350:2400,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,${fundido}`;
    await ffmpeg([...entrada, "-vf", vf, "-t", d.toFixed(2), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", out]);
    tramos.push(out);
  }
  const lista = path.join(cfg.dirSalida, `${video.id}-tramos.txt`);
  fs.writeFileSync(lista, tramos.map((t) => `file '${t}'`).join("\n"));
  const base = path.join(cfg.dirSalida, `${video.id}-base.mp4`);
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", base]);
  return base;
}

export async function run(video, escenas = []) {
  const a = agente("animacion");
  a.modo(hayFfmpeg ? "real" : "demo");
  if (!hayFfmpeg) throw new Error("Instala ffmpeg para renderizar videos");

  const D = Math.min(59, video.segundos + 0.8);
  const ass = path.join(cfg.dirSalida, `${video.id}.ass`);
  fs.writeFileSync(ass, subtitulosASS(video.guion.narracion, video.segundos));
  const salida = path.join(cfg.dirSalida, `${video.id}.mp4`);
  const frames = Math.ceil(D * 30);

  let entradaVideo, base;
  if (escenas.length) {
    a.trabajando(`Montando ${escenas.length} escenas IA…`, 0.6);
    entradaVideo = ["-i", await montarEscenas(video, escenas, D)];
    base = `[0:v]eq=brightness=-0.04:saturation=0.85`;
  } else {
    a.trabajando("Montando fondo y subtítulos…", 0.3);
    const fondos = fs.existsSync(cfg.dirFondos) ? fs.readdirSync(cfg.dirFondos).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)) : [];
    const fondo = fondos.length ? path.join(cfg.dirFondos, fondos[Math.floor(Math.random() * fondos.length)]) : null;
    entradaVideo = fondo ? ["-i", fondo] : ["-f", "lavfi", "-i", `gradients=s=1080x1920:r=30:c0=0x05040a:c1=0x3d0a1c:c2=0x05040a:n=3:speed=0.004:d=${D}`];
    base = fondo
      ? `[0:v]scale=1350:2400:force_original_aspect_ratio=increase,crop=1350:2400,zoompan=z='min(zoom+0.0006,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,eq=brightness=-0.12:saturation=0.6`
      : `[0:v]format=yuv420p`;
  }
  const filtro = `${base},noise=alls=12:allf=t+u,vignette=angle=PI/3.3,eq=brightness='0.025*sin(t*9)*lt(mod(t\\,7)\\,0.6)':eval=frame,subtitles=${ass}[v];[1:a][2:a]amix=inputs=2:duration=longest:weights='1 0.5'[a]`;

  await ffmpeg([
    ...entradaVideo,
    "-i", video.audio,
    "-f", "lavfi", "-i", `anoisesrc=color=brown:amplitude=0.035:d=${D}`,
    "-filter_complex", filtro,
    "-map", "[v]", "-map", "[a]",
    "-t", String(D), "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
    salida,
  ]);
  a.listo(`Video renderizado (${D.toFixed(0)} s, ${escenas.length ? escenas.length + " escenas IA" : "fondo simple"})`);
  return { archivo: salida };
}

/** Paso previo: pide los visuales a Higgsfield / fal.ai. */
export async function prepararEscenas(video) {
  const a = agente("animacion");
  const { visual, generarEscenas } = await import("../visuales.js");
  if (!visual.proveedor) return { escenas: [], costo: 0 };
  a.modo("real");
  const que = visual.modo === "video" ? "clips animados" : "imágenes";
  a.trabajando(`Pidiendo ${que} a ${visual.proveedor === "higgsfield" ? "Higgsfield" : "fal.ai"}…`, 0.05);
  const r = await generarEscenas(video, (p) => a.progreso(p * 0.55, `${que} de escenas: ${Math.round(p * 100)}%`));
  a.log(`${r.escenas.length} escenas generadas ($${r.costo.toFixed(2)})`);
  return r;
}
