// Generación de visuales profesionales por escena con proveedores externos.
//   · Higgsfield  (HF_CREDENTIALS="KEY_ID:KEY_SECRET")  → imágenes + clips (DoP)
//   · fal.ai      (FAL_KEY)                             → Flux, Kling, Veo, Seedance… con una sola clave
// VISUAL_MODO = imagenes  → una imagen por escena (barato, con zoom lento)
//             = video     → cada imagen se anima como clip (más profesional, más caro)
import fs from "node:fs";
import path from "node:path";
import { cfg } from "./config.js";

const e = process.env;
const ESTILO =
  "cinematic horror film still, vertical 9:16, dark moody lighting, volumetric fog, film grain, 35mm, high detail, unsettling atmosphere, no text, no watermark";

export const visual = {
  proveedor: cfg.demo ? null : e.HF_CREDENTIALS ? "higgsfield" : e.FAL_KEY ? "fal" : null,
  modo: e.VISUAL_MODO === "video" ? "video" : "imagenes",
  // Costos aproximados (USD) para la Tesorería — ajústalos a tu plan
  usdImagen: Number(e.VISUAL_USD_IMAGEN ?? 0.05),
  usdClip: Number(e.VISUAL_USD_CLIP ?? 0.35),
};

// ── Adaptadores ──
const proveedores = {
  higgsfield: {
    async cliente() {
      const { createHiggsfieldClient } = await import("@higgsfield/client/v2");
      return (this._c ||= createHiggsfieldClient({ credentials: e.HF_CREDENTIALS }));
    },
    async imagen(prompt) {
      const c = await this.cliente();
      const r = await c.subscribe(e.HF_MODELO_IMAGEN || "flux-pro/kontext/max/text-to-image", {
        input: { prompt, aspect_ratio: "9:16", safety_tolerance: 2 },
        withPolling: true,
      });
      return comprobar(r, r.images?.[0]?.url);
    },
    async clip(prompt, imagenUrl) {
      const c = await this.cliente();
      const r = await c.subscribe(e.HF_MODELO_VIDEO || "/v1/image2video/dop", {
        input: { model: e.HF_DOP_MODELO || "dop-turbo", prompt, input_images: [{ type: "image_url", image_url: imagenUrl }] },
        withPolling: true,
      });
      return comprobar(r, r.video?.url);
    },
  },

  fal: {
    async cliente() {
      const { fal } = await import("@fal-ai/client");
      fal.config({ credentials: e.FAL_KEY });
      return fal;
    },
    async imagen(prompt) {
      const fal = await this.cliente();
      const r = await fal.subscribe(e.FAL_MODELO_IMAGEN || "fal-ai/flux/dev", { input: { prompt, image_size: "portrait_16_9" } });
      return r.data?.images?.[0]?.url ?? falla("fal no devolvió imagen");
    },
    async clip(prompt, imagenUrl) {
      const fal = await this.cliente();
      const modelo = e.FAL_MODELO_VIDEO || "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
      const r = await fal.subscribe(modelo, { input: { prompt, image_url: imagenUrl, duration: "5", aspect_ratio: "9:16" } });
      return r.data?.video?.url ?? falla("fal no devolvió video");
    },
  },
};

function comprobar(r, url) {
  if (r.status === "nsfw") falla("Higgsfield rechazó la escena por moderación");
  if (r.status !== "completed" || !url) falla(`Higgsfield: estado ${r.status}`);
  return url;
}
function falla(m) { throw new Error(m); }

async function descargar(url, destino) {
  const r = await fetch(url);
  if (!r.ok) falla(`Descarga ${r.status}: ${url}`);
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  return destino;
}

/**
 * Genera los visuales de todas las escenas (en paralelo, de 3 en 3).
 * Devuelve [{ tipo: "imagen"|"video", archivo }] y el costo total.
 * Si una escena falla se reintenta como imagen; si también falla se omite.
 */
export async function generarEscenas(video, progreso = () => {}) {
  const p = proveedores[visual.proveedor];
  if (!p) return { escenas: [], costo: 0 };
  const lista = (video.guion.escenas || []).slice(0, 8);
  const escenas = new Array(lista.length);
  let costo = 0, hechas = 0;

  const una = async (desc, i) => {
    const prompt = `${desc}. ${ESTILO}`;
    const base = path.join(cfg.dirSalida, `${video.id}-esc${i}`);
    try {
      const img = await p.imagen(prompt);
      costo += visual.usdImagen;
      if (visual.modo === "video") {
        try {
          const clip = await p.clip(`${desc}. slow creeping camera movement, subtle horror motion`, img);
          costo += visual.usdClip;
          escenas[i] = { tipo: "video", archivo: await descargar(clip, base + ".mp4") };
        } catch {
          escenas[i] = { tipo: "imagen", archivo: await descargar(img, base + ".png") };
        }
      } else {
        escenas[i] = { tipo: "imagen", archivo: await descargar(img, base + ".png") };
      }
    } catch (err) {
      console.warn(`Escena ${i} omitida:`, err.message);
    }
    progreso(++hechas / lista.length);
  };

  for (let i = 0; i < lista.length; i += 3) await Promise.all(lista.slice(i, i + 3).map((d, k) => una(d, i + k)));
  return { escenas: escenas.filter(Boolean), costo };
}
