// Carga .env sin dependencias y expone la configuración.
import fs from "node:fs";
import path from "node:path";

export const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const envFile = path.join(RAIZ, ".env");
if (fs.existsSync(envFile)) {
  for (const linea of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const e = process.env;
const num = (v, d) => (v === undefined || v === "" ? d : Number(v));
const demo = e.MODO_DEMO === "1";

export const cfg = {
  demo,
  puerto: num(e.PUERTO, 3333),
  marca: { nombre: "Hora Muerta", lema: "Historias que no deberías escuchar a las 3:33" },
  claude: !demo && !!e.ANTHROPIC_API_KEY,
  eleven: !demo && !!e.ELEVENLABS_API_KEY && !!e.ELEVENLABS_VOICE_ID,
  youtube: !demo && !!e.YT_CLIENT_ID && !!e.YT_CLIENT_SECRET && !!e.YT_REFRESH_TOKEN,
  // Para buscar virales basta una API key simple (o el OAuth de arriba)
  youtubeBusqueda: !demo && (!!e.YT_API_KEY || (!!e.YT_CLIENT_ID && !!e.YT_CLIENT_SECRET && !!e.YT_REFRESH_TOKEN)),
  elevenVoz: e.ELEVENLABS_VOICE_ID,
  elevenUsdPor1k: num(e.ELEVENLABS_USD_POR_1K, 0.3),
  ytPrivacidad: e.YT_PRIVACIDAD || "private",
  requiereAprobacion: e.REQUIERE_APROBACION !== "0",
  videosPorDia: num(e.VIDEOS_POR_DIA, 3),
  gastoMaxDiario: num(e.GASTO_MAX_DIARIO_USD, 5),
  rpm: num(e.RPM_SHORTS_USD, 0.06),
  fuente: e.FUENTE || "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  dirSalida: path.join(RAIZ, "output"),
  dirFondos: path.join(RAIZ, "assets", "fondos"),
  dirDatos: path.join(RAIZ, "data"),
};

fs.mkdirSync(cfg.dirSalida, { recursive: true });
fs.mkdirSync(cfg.dirDatos, { recursive: true });
