// AGENTE 9 · TESORERÍA — presupuesto diario, costos por video, ingresos y ROI.
import { cfg } from "../config.js";
import { agente, db, guardar, emitir, resumenFinanzas } from "../estado.js";

function mover(tipo, concepto, usd) {
  if (!usd) return;
  db.finanzas.movimientos.push({ fecha: new Date().toISOString(), tipo, concepto, usd: +usd.toFixed(4) });
  if (db.finanzas.movimientos.length > 2000) db.finanzas.movimientos.shift();
  if (tipo === "gasto") db.finanzas.gastosTotales += usd;
  guardar();
  emitir("finanzas", resumenFinanzas());
}

/** Antes de producir: ¿queda presupuesto hoy? */
export function autorizar() {
  const a = agente("tesoreria");
  const f = resumenFinanzas();
  if (f.gastoHoy >= cfg.gastoMaxDiario) {
    a.error(`Presupuesto diario agotado ($${f.gastoHoy.toFixed(2)} / $${cfg.gastoMaxDiario})`);
    return false;
  }
  a.listo(`Presupuesto OK: $${(cfg.gastoMaxDiario - f.gastoHoy).toFixed(2)} disponibles hoy`);
  return true;
}

export function gasto(concepto, usd) {
  if (!usd) return;
  agente("tesoreria").trabajando(`Registrando gasto: ${concepto} $${usd.toFixed(3)}`, 0.5);
  mover("gasto", concepto, usd);
  agente("tesoreria").listo(`Gasto total: $${db.finanzas.gastosTotales.toFixed(2)}`);
}

/** Ingresos reales reportados por YouTube Analytics. */
export function fijarIngresoReal(totalUsd) { actualizarIngresos(totalUsd, "YouTube (real)"); }
/** Proyección con RPM configurado (antes de estar monetizado o en demo). */
export function fijarIngresoEstimado(totalUsd) { actualizarIngresos(totalUsd, "Estimado RPM"); }

function actualizarIngresos(total, fuente) {
  const delta = total - db.finanzas.ingresosTotales;
  if (delta <= 0.0001) return;
  db.finanzas.ingresosTotales = total;
  db.finanzas.movimientos.push({ fecha: new Date().toISOString(), tipo: "ingreso", concepto: fuente, usd: +delta.toFixed(4) });
  guardar();
  emitir("finanzas", resumenFinanzas());
  const f = resumenFinanzas();
  agente("tesoreria").listo(`Ingresos $${f.ingresos.toFixed(2)} · ROI ${(f.roi * 100).toFixed(0)}%`, true);
}
