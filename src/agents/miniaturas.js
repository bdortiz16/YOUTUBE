// AGENTE 5 · MINIATURAS — portada 1280x720 con texto de impacto.
import fs from "node:fs";
import path from "node:path";
import { cfg } from "../config.js";
import { agente } from "../estado.js";
import { ffmpeg, escDraw, hayFfmpeg } from "../ffmpeg.js";

export async function run(video) {
  const a = agente("miniaturas");
  a.modo(hayFfmpeg ? "real" : "demo");
  const texto = (video.guion.textoMiniatura || "¿QUÉ HAY AHÍ?").toUpperCase();
  a.trabajando(`Diseñando portada “${texto}”`, 0.2);
  const salida = path.join(cfg.dirSalida, `${video.id}-mini.png`);

  const fondos = fs.existsSync(cfg.dirFondos) ? fs.readdirSync(cfg.dirFondos).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)) : [];
  const escenaIA = video.escenasIA?.[0];
  const entrada = escenaIA
    ? [...(escenaIA.tipo === "video" ? ["-ss", "1"] : []), "-i", escenaIA.archivo]
    : fondos.length
    ? ["-i", path.join(cfg.dirFondos, fondos[Math.floor(Math.random() * fondos.length)])]
    : ["-f", "lavfi", "-i", "gradients=s=1280x720:c0=0x8a0d1e:c1=0x12020a:x0=0:y0=0:x1=1280:y1=720:d=1"];
  const f = cfg.fuente;
  await ffmpeg([
    ...entrada,
    "-vf",
    [
      "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
      ...(escenaIA || fondos.length ? ["eq=brightness=-0.15:saturation=0.7"] : []),
      "vignette=angle=PI/3",
      `drawtext=fontfile=${f}:text='${escDraw(texto)}':fontsize=128:fontcolor=0xFFE14D:borderw=10:bordercolor=black:x=60:y=(h-th)/2`,
      `drawtext=fontfile=${f}:text='${escDraw(cfg.marca.nombre.toUpperCase())}':fontsize=34:fontcolor=0xff3355:x=62:y=h-80`,
    ].join(","),
    "-frames:v", "1", salida,
  ]);
  a.listo("Miniatura lista");
  return { miniatura: salida };
}
