// Estado global + bus de eventos (SSE) + persistencia en data/db.json
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { cfg } from "./config.js";

export const bus = new EventEmitter();
bus.setMaxListeners(100);

export const AGENTES = [
  { id: "tendencias", n: 1, nombre: "Tendencias", rol: "Busca qué temas de terror están pegando" },
  { id: "guion", n: 2, nombre: "Guion", rol: "Escribe la historia (45-55 s) con gancho" },
  { id: "voz", n: 3, nombre: "Voz y Sonido", rol: "Narrador propio, música, efectos y mezcla profesional" },
  { id: "animacion", n: 4, nombre: "Animación", rol: "Monta el video vertical con subtítulos" },
  { id: "miniaturas", n: 5, nombre: "Miniaturas", rol: "Crea la portada" },
  { id: "subida", n: 6, nombre: "Subida", rol: "Publica en YouTube" },
  { id: "datos", n: 7, nombre: "Datos", rol: "Mide vistas, retención y suscriptores" },
  { id: "gerente", n: 8, nombre: "Gerente", rol: "Decide, revisa calidad y políticas" },
  { id: "tesoreria", n: 9, nombre: "Tesorería", rol: "Controla gastos, ingresos y ROI" },
];

const DB = path.join(cfg.dirDatos, "db.json");
const base = () => ({
  videos: [],
  finanzas: { movimientos: [], ingresosTotales: 0, gastosTotales: 0 },
  canal: { suscriptores: 0, vistasTotales: 0, vistas90d: 0, actualizado: null },
});

export const db = fs.existsSync(DB) ? { ...base(), ...JSON.parse(fs.readFileSync(DB, "utf8")) } : base();
let guardando = null;
export function guardar() {
  clearTimeout(guardando);
  guardando = setTimeout(() => fs.writeFileSync(DB, JSON.stringify(db, null, 2)), 200);
}

export const agentes = Object.fromEntries(
  AGENTES.map((a) => [a.id, { ...a, estado: "libre", mensaje: "Esperando turno…", progreso: 0, modo: "demo" }])
);
export const log = [];
export const runtime = { autopiloto: false, produciendo: false };

export function emitir(tipo, datos) {
  bus.emit("evento", { tipo, datos, t: Date.now() });
}

export function registrar(agenteId, texto, nivel = "info") {
  const linea = { t: Date.now(), agente: agenteId, texto, nivel };
  log.push(linea);
  if (log.length > 300) log.shift();
  emitir("log", linea);
}

/** Helper que usa cada agente para reportar su estado a la oficina. */
export function agente(id) {
  const a = agentes[id];
  const set = (cambios) => {
    Object.assign(a, cambios);
    emitir("agente", a);
  };
  return {
    trabajando(mensaje, progreso = 0) { set({ estado: "trabajando", mensaje, progreso }); registrar(id, mensaje); },
    progreso(progreso, mensaje) { set({ progreso, ...(mensaje ? { mensaje } : {}) }); },
    listo(mensaje, silencioso = false) { set({ estado: "listo", mensaje, progreso: 1 }); if (!silencioso) registrar(id, "✔ " + mensaje); setTimeout(() => a.estado === "listo" && set({ estado: "libre" }), 4000); },
    error(mensaje) { set({ estado: "error", mensaje }); registrar(id, "✖ " + mensaje, "error"); },
    modo(m) { set({ modo: m }); },
    log: (t, n) => registrar(id, t, n),
  };
}

export function snapshot() {
  return { agentes, videos: db.videos.slice(-40), finanzas: resumenFinanzas(), canal: db.canal, virales: db.virales || null, log: log.slice(-80), runtime, marca: cfg.marca, demo: cfg.demo };
}

export function resumenFinanzas() {
  const hoy = new Date().toISOString().slice(0, 10);
  const gastoHoy = db.finanzas.movimientos.filter((m) => m.tipo === "gasto" && m.fecha.startsWith(hoy)).reduce((s, m) => s + m.usd, 0);
  const { ingresosTotales: ing, gastosTotales: gas } = db.finanzas;
  return {
    ingresos: ing, gastos: gas, beneficio: ing - gas, gastoHoy, limiteDiario: cfg.gastoMaxDiario,
    roi: gas > 0 ? (ing - gas) / gas : 0,
    ypp: { suscriptores: db.canal.suscriptores, metaSubs: 1000, vistas90d: db.canal.vistas90d, metaVistas: 10_000_000 },
    ultimos: db.finanzas.movimientos.slice(-15),
  };
}

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));
