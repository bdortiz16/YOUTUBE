import { spawn, execFileSync } from "node:child_process";

export const hayFfmpeg = (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } })();

export function ffmpeg(args) {
  return new Promise((ok, mal) => {
    if (!hayFfmpeg) return mal(new Error("ffmpeg no está instalado"));
    const p = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? ok() : mal(new Error("ffmpeg: " + err.slice(-400)))));
  });
}

export async function duracion(archivo) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", archivo]).toString();
    return parseFloat(out) || 0;
  } catch { return 0; }
}

/** Escapa texto para el filtro drawtext. */
export const escDraw = (t) => t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "’").replace(/%/g, "\\%");
