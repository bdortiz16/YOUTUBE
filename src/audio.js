// Audio profesional: narrador con voz propia, música original, efectos sincronizados y mezcla a -14 LUFS.
// Proveedor: ElevenLabs (SDK oficial). Sin clave, todo se sintetiza localmente con ffmpeg (modo demo).
import fs from "node:fs";
import path from "node:path";
import { cfg } from "./config.js";
import { db, guardar } from "./estado.js";
import { spawn } from "node:child_process";
import { ffmpeg, duracion } from "./ffmpeg.js";

/** Primera pasada de loudnorm: mide el audio y devuelve los valores para la segunda pasada. */
function medirLoudness(archivo) {
  return new Promise((ok, mal) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-nostats", "-i", archivo, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", () => {
      const j = err.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
      j ? ok(JSON.parse(j[0])) : mal(new Error("No pude medir el volumen"));
    });
  });
}

const e = process.env;
export const audioCfg = {
  real: cfg.eleven || (!cfg.demo && !!e.ELEVENLABS_API_KEY),
  modeloVoz: e.ELEVEN_MODELO_VOZ || "eleven_v3", // v3 entiende etiquetas de actuación: [whispers], [sighs]…
  modeloMusica: e.ELEVEN_MODELO_MUSICA || undefined, // vacío = el modelo por defecto de la API
  modeloSfx: e.ELEVEN_MODELO_SFX || undefined,
  musica: e.AUDIO_MUSICA !== "0",
  efectos: e.AUDIO_EFECTOS !== "0",
  usdMusicaPorMin: Number(e.ELEVEN_USD_MUSICA_MIN ?? 0.8),
  usdEfecto: Number(e.ELEVEN_USD_EFECTO ?? 0.04),
};

export const VOZ_NARRADOR =
  "Male narrator, deep low voice with a slight rasp, calm and intimate, speaks slowly like telling a secret at 3 a.m., neutral Latin American Spanish accent, close-mic, subtle breathiness, unsettling but warm, perfect audio quality.";

let _cliente;
async function eleven() {
  if (_cliente) return _cliente;
  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  return (_cliente = new ElevenLabsClient({ apiKey: e.ELEVENLABS_API_KEY }));
}

async function guardarStream(stream, destino) {
  const trozos = [];
  for await (const t of stream) trozos.push(Buffer.from(t));
  fs.writeFileSync(destino, Buffer.concat(trozos));
  return destino;
}

// ───────── Narrador ─────────

/**
 * Voz exclusiva del canal. Prioridad: ELEVENLABS_VOICE_ID → voz ya diseñada (db) → diseñar una nueva con Voice Design.
 * Las 3 muestras se guardan en output/ para que puedas escucharlas y cambiar de voz si quieres.
 */
export async function vozDelCanal(log = () => {}) {
  if (e.ELEVENLABS_VOICE_ID) return e.ELEVENLABS_VOICE_ID;
  if (db.marca?.vozId) return db.marca.vozId;
  const c = await eleven();
  log("Diseñando la voz exclusiva del narrador…");
  const r = await c.textToVoice.design({
    voiceDescription: e.VOZ_DESCRIPCION || VOZ_NARRADOR,
    modelId: "eleven_ttv_v3",
    text: "Mi abuela cerraba todas las ventanas a las tres y treinta y tres. Decía que a esa hora la noche busca casas abiertas. Yo me reía de ella. Hasta la primera noche que dormí sola en su casa, y escuché algo arrastrándose por el techo.",
  });
  r.previews.forEach((p, i) => fs.writeFileSync(path.join(cfg.dirSalida, `voz-muestra-${i + 1}.mp3`), Buffer.from(p.audioBase64, "base64")));
  const voz = await c.textToVoice.create({
    voiceName: `${cfg.marca.nombre} — Narrador`,
    voiceDescription: e.VOZ_DESCRIPCION || VOZ_NARRADOR,
    generatedVoiceId: r.previews[0].generatedVoiceId,
  });
  db.marca = { ...(db.marca || {}), vozId: voz.voiceId };
  guardar();
  log(`Voz del canal creada (${voz.voiceId}). Muestras en output/voz-muestra-*.mp3`);
  return voz.voiceId;
}

/** Tiempos por palabra a partir del alineamiento por carácter (ignora las etiquetas [whispers] etc.). */
function palabrasDesdeAlineamiento(al) {
  const palabras = [];
  let actual = null, dentroEtiqueta = false;
  al.characters.forEach((ch, i) => {
    if (ch === "[") dentroEtiqueta = true;
    if (dentroEtiqueta) { if (ch === "]") dentroEtiqueta = false; return; }
    if (/\s/.test(ch)) { if (actual) palabras.push(actual); actual = null; return; }
    if (!actual) actual = { texto: "", ini: al.characterStartTimesSeconds[i] };
    actual.texto += ch;
    actual.fin = al.characterEndTimesSeconds[i];
  });
  if (actual) palabras.push(actual);
  return palabras.filter((p) => /[\p{L}\p{N}]/u.test(p.texto));
}

/** Estimación de tiempos cuando no hay alineamiento real (demo). */
export function palabrasEstimadas(texto, segundos) {
  const ws = texto.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean);
  const total = ws.reduce((s, w) => s + w.length + 2 + (/[.,…!?]$/.test(w) ? 4 : 0), 0);
  let t = 0.1;
  return ws.map((w) => {
    const d = ((w.length + 2 + (/[.,…!?]$/.test(w) ? 4 : 0)) / total) * (segundos - 0.2);
    const p = { texto: w, ini: t, fin: t + d * 0.85 };
    t += d;
    return p;
  });
}

export async function narrar({ id, texto, actuado }, log) {
  const destino = path.join(cfg.dirSalida, `${id}-voz.mp3`);
  const c = await eleven();
  const voiceId = await vozDelCanal(log);
  const v3 = audioCfg.modeloVoz.startsWith("eleven_v3");
  const r = await c.textToSpeech.convertWithTimestamps(voiceId, {
    text: v3 && actuado ? actuado : texto,
    modelId: audioCfg.modeloVoz,
    outputFormat: "mp3_44100_128",
    languageCode: "es",
    voiceSettings: v3 ? { stability: 0.5 } : { stability: 0.4, similarityBoost: 0.8, style: 0.35, speed: 0.95 },
  });
  fs.writeFileSync(destino, Buffer.from(r.audioBase64, "base64"));
  const palabras = r.alignment ? palabrasDesdeAlineamiento(r.alignment) : [];
  const segundos = await duracion(destino);
  return { archivo: destino, segundos, palabras: palabras.length ? palabras : palabrasEstimadas(texto, segundos) };
}

// ───────── Música y efectos ─────────

export async function musica(id, prompt, segundos) {
  const destino = path.join(cfg.dirSalida, `${id}-musica.mp3`);
  if (!audioCfg.real) return { archivo: await musicaDemo(destino, segundos), costo: 0 };
  const c = await eleven();
  const stream = await c.music.compose({
    prompt: `${prompt}. Instrumental horror underscore for a short video narration: sparse, low, leaves room for the voice, no drums at start, slow build, ends on an unresolved dissonant note.`,
    musicLengthMs: Math.round(Math.min(120, Math.max(10, segundos)) * 1000),
    forceInstrumental: true,
    ...(audioCfg.modeloMusica ? { modelId: audioCfg.modeloMusica } : {}),
  });
  await guardarStream(stream, destino);
  return { archivo: destino, costo: (segundos / 60) * audioCfg.usdMusicaPorMin };
}

export async function efecto(id, n, descripcion, segundos = 2.5) {
  const destino = path.join(cfg.dirSalida, `${id}-sfx${n}.mp3`);
  if (!audioCfg.real) return { archivo: await efectoDemo(destino, descripcion), costo: 0 };
  const c = await eleven();
  const stream = await c.textToSoundEffects.convert({
    text: descripcion,
    durationSeconds: segundos,
    promptInfluence: 0.6,
    ...(audioCfg.modeloSfx ? { modelId: audioCfg.modeloSfx } : {}),
  });
  await guardarStream(stream, destino);
  return { archivo: destino, costo: audioCfg.usdEfecto };
}

/** Sello sonoro de la marca (se genera una vez y se reutiliza en todos los videos). */
export async function selloSonoro() {
  const destino = path.join(cfg.dirDatos, "sello-sonoro.mp3");
  if (fs.existsSync(destino)) return { archivo: destino, costo: 0 };
  if (!audioCfg.real) return { archivo: await efectoDemo(destino, "sello"), costo: 0 };
  const r = await efecto("marca", 0, "Short eerie horror logo sting: a single distant clock chime, reversed whisper swell and a deep sub-bass hit, cinematic, clean ending", 2);
  fs.renameSync(r.archivo, destino);
  return { archivo: destino, costo: r.costo };
}

/** Busca en qué segundo se dice una frase, usando los tiempos por palabra. */
export function momentoDeFrase(frase, palabras, respaldo) {
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N} ]/gu, "").trim();
  const objetivo = norm(frase).split(/\s+/).slice(0, 3);
  if (!objetivo[0]) return respaldo;
  for (let i = 0; i < palabras.length; i++) {
    if (objetivo.every((w, k) => norm(palabras[i + k]?.texto || "") === w)) return palabras[i].ini;
  }
  return respaldo;
}

// ───────── Mezcla final ─────────

/**
 * Voz al frente, música con "ducking" (baja sola cuando habla el narrador), efectos en su segundo exacto,
 * sello sonoro al inicio y normalización a -14 LUFS (el nivel de referencia de YouTube).
 */
export async function mezclar({ id, voz, musica: mus, efectos = [], sello, segundos }) {
  const destino = path.join(cfg.dirSalida, `${id}-mezcla.m4a`);
  const previa = path.join(cfg.dirSalida, `${id}-mezcla-previa.wav`);
  const entradas = ["-i", voz];
  const st = "aformat=channel_layouts=stereo";
  const filtros = [`[0:a]aresample=48000,${st},highpass=f=70,acompressor=threshold=0.12:ratio=3:attack=10:release=200,asplit=2[voz][llave]`];
  const mezcla = ["[voz]"];
  let n = 1;
  if (mus) {
    entradas.push("-i", mus);
    filtros.push(`[${n}:a]aresample=48000,${st},volume=0.55,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, segundos - 2)}:d=2[mus]`);
    filtros.push(`[mus][llave]sidechaincompress=threshold=0.04:ratio=6:attack=30:release=450[musd]`);
    mezcla.push("[musd]");
    n++;
  } else {
    filtros.push(`[llave]anullsink`);
  }
  if (sello) {
    entradas.push("-i", sello);
    filtros.push(`[${n}:a]aresample=48000,${st},volume=0.7[sello]`);
    mezcla.push("[sello]");
    n++;
  }
  for (const fx of efectos) {
    entradas.push("-i", fx.archivo);
    const ms = Math.max(0, Math.round(fx.t * 1000));
    filtros.push(`[${n}:a]aresample=48000,${st},volume=${fx.volumen ?? 0.8},adelay=${ms}|${ms}[fx${n}]`);
    mezcla.push(`[fx${n}]`);
    n++;
  }
  filtros.push(`${mezcla.join("")}amix=inputs=${mezcla.length}:duration=first:normalize=0,apad=pad_dur=0.8[out]`);
  await ffmpeg([...entradas, "-filter_complex", filtros.join(";"), "-map", "[out]", "-ar", "48000", "-ac", "2", previa]);

  // Normalización en dos pasadas a -14 LUFS / -1,5 dBTP
  const m = await medirLoudness(previa);
  const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  await ffmpeg(["-i", previa, "-af", ln, "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", destino]);
  fs.rmSync(previa, { force: true });
  return destino;
}

// ───────── Síntesis local (demo, sin claves) ─────────

function musicaDemo(destino, s) {
  // Pad grave desafinado + ruido filtrado con trémolo lento
  return ffmpeg([
    "-f", "lavfi", "-i", `sine=frequency=55:duration=${s}`,
    "-f", "lavfi", "-i", `sine=frequency=82.4:duration=${s}`,
    "-f", "lavfi", "-i", `sine=frequency=58.3:duration=${s}`,
    "-f", "lavfi", "-i", `anoisesrc=color=pink:amplitude=0.25:duration=${s}`,
    "-filter_complex", `[3:a]lowpass=f=400[n];[0:a][1:a][2:a][n]amix=inputs=4:normalize=0,volume=0.35,tremolo=f=0.2:d=0.6,aecho=0.8:0.7:120:0.4,afade=t=in:d=3`,
    "-ac", "2", destino,
  ]).then(() => destino);
}

function efectoDemo(destino, descripcion) {
  const d = descripcion.toLowerCase();
  let src, fil;
  if (/whisper|susurr|breath/.test(d)) { src = "anoisesrc=color=white:amplitude=0.5:duration=1.8"; fil = "bandpass=f=2500:w=1800,tremolo=f=9:d=0.8,afade=t=in:d=0.4,afade=t=out:st=1.2:d=0.6,volume=0.6"; }
  else if (/riser|swell|build|sello/.test(d)) { src = "sine=frequency=60:duration=2"; fil = "vibrato=f=6:d=0.5,afade=t=in:d=1.6,afade=t=out:st=1.7:d=0.3,volume=1.4"; }
  else if (/door|creak|puerta|cruj/.test(d)) { src = "anoisesrc=color=brown:amplitude=0.8:duration=1.5"; fil = "bandpass=f=600:w=300,tremolo=f=25:d=0.9,afade=t=out:st=0.8:d=0.7"; }
  else if (/step|paso|footstep/.test(d)) { src = "sine=frequency=70:duration=2"; fil = "tremolo=f=2:d=1,afade=t=out:st=1.4:d=0.6,volume=1.2"; }
  else { src = "sine=frequency=45:duration=1.5"; fil = "afade=t=in:d=0.01,afade=t=out:st=0.05:d=1.4,aecho=0.8:0.8:90:0.5,volume=1.6"; } // golpe grave
  return ffmpeg(["-f", "lavfi", "-i", src, "-af", fil, "-ac", "2", destino]).then(() => destino);
}
