// HORA MUERTA STUDIO — servidor (sin frameworks): estáticos + API + eventos en vivo (SSE)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { cfg, RAIZ } from "./src/config.js";
import { bus, snapshot, agentes } from "./src/estado.js";
import { producir, aprobar, autopiloto, videosPublicos } from "./src/pipeline.js";
import { hayFfmpeg } from "./src/ffmpeg.js";

const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mp4": "video/mp4", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

function servirArchivo(res, archivo, req) {
  if (!fs.existsSync(archivo)) { res.writeHead(404); return res.end("No encontrado"); }
  const tam = fs.statSync(archivo).size;
  const tipo = TIPOS[path.extname(archivo)] || "application/octet-stream";
  const rango = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  if (rango) { // para que el <video> pueda adelantar
    const ini = +rango[1], fin = rango[2] ? +rango[2] : tam - 1;
    res.writeHead(206, { "Content-Type": tipo, "Content-Range": `bytes ${ini}-${fin}/${tam}`, "Accept-Ranges": "bytes", "Content-Length": fin - ini + 1 });
    return fs.createReadStream(archivo, { start: ini, end: fin }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": tipo, "Content-Length": tam });
  fs.createReadStream(archivo).pipe(res);
}

const json = (res, data, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
const cuerpo = (req) => new Promise((ok) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  if (p === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const enviar = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    enviar({ tipo: "inicio", datos: { ...snapshot(), videos: videosPublicos() } });
    bus.on("evento", enviar);
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    return req.on("close", () => { bus.off("evento", enviar); clearInterval(ping); });
  }
  if (p === "/api/estado") return json(res, { ...snapshot(), videos: videosPublicos() });
  if (p === "/api/producir" && req.method === "POST") { producir(); return json(res, { ok: true }); }
  if (p === "/api/autopiloto" && req.method === "POST") { const b = await cuerpo(req); autopiloto(!!b.encendido); return json(res, { ok: true }); }
  if (p.startsWith("/api/aprobar/") && req.method === "POST") {
    const b = await cuerpo(req);
    const ok = await aprobar(p.split("/").pop(), b.decision);
    return json(res, { ok }, ok ? 200 : 404);
  }
  if (p.startsWith("/media/")) return servirArchivo(res, path.join(cfg.dirSalida, path.basename(p)), req);

  const archivo = path.join(RAIZ, "public", p === "/" ? "index.html" : path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if (!archivo.startsWith(path.join(RAIZ, "public"))) { res.writeHead(403); return res.end(); }
  servirArchivo(res, archivo, req);
});

server.listen(cfg.puerto, () => {
  const m = (ok) => (ok ? "REAL ✅" : "demo 🧪");
  console.log(`\n  🕯️  ${cfg.marca.nombre.toUpperCase()} STUDIO → http://localhost:${cfg.puerto}\n`);
  console.log(`  Claude (tendencias/guion/gerente): ${m(cfg.claude)}`);
  console.log(`  Voz (ElevenLabs):                  ${m(cfg.eleven)}`);
  console.log(`  Animación/Miniaturas (ffmpeg):     ${m(hayFfmpeg)}`);
  console.log(`  YouTube (subida/datos):            ${m(cfg.youtube)}`);
  console.log(`  Aprobación humana antes de subir:  ${cfg.requiereAprobacion ? "SÍ" : "NO"}\n`);
  for (const id of Object.keys(agentes)) agentes[id].modo = { tendencias: cfg.claude, guion: cfg.claude, gerente: cfg.claude, voz: cfg.eleven, animacion: hayFfmpeg, miniaturas: hayFfmpeg, subida: cfg.youtube, datos: cfg.youtube, tesoreria: true }[id] ? "real" : "demo";
});
