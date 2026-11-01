// HORA MUERTA STUDIO — oficina en vivo
const $ = (s) => document.querySelector(s);
const estado = { agentes: {}, videos: [], finanzas: null, canal: null, runtime: {} };

const PANTALLA = {
  tendencias: () => `<div class="tiles">${"<span></span>".repeat(6)}</div>`,
  guion: () => `<div class="doc">${"<i></i>".repeat(6)}</div>`,
  voz: () => `<div class="onda">${Array.from({ length: 22 }, (_, i) => `<i style="animation-delay:${(i * 37) % 500}ms"></i>`).join("")}</div>`,
  animacion: () => `<div class="frame"><b data-sub>…</b></div>`,
  miniaturas: () => `<div class="mini"><b data-mini>¿QUÉ HAY AHÍ?</b><span>💀</span></div>`,
  subida: () => `<div class="subir"><div class="flecha">⬆</div><div class="bar"><i data-bar></i></div></div>`,
  datos: () => `<svg class="grafico" viewBox="0 0 100 50" preserveAspectRatio="none"><polygon class="area" data-area points=""/><polyline data-linea points=""/></svg>`,
  gerente: () => `<div class="kanban"><div><i></i><i></i><i></i></div><div><i class="rojo"></i><i></i></div><div><i class="ok"></i><i class="ok"></i><i class="ok"></i></div></div>`,
  tesoreria: () => `<div class="caja"><span class="monedas">🪙🪙🪙</span><b data-caja>$0.00</b><small data-caja2>beneficio</small></div>`,
};
const ICONO = { tendencias: "📈", guion: "📝", voz: "🎙️", animacion: "🎬", miniaturas: "🖼️", subida: "⬆️", datos: "📊", gerente: "👔", tesoreria: "💰" };
const COLOR = { tendencias: "#f3eefe", guion: "#eef6ff", voz: "#fff1f6", animacion: "#f0fff6", miniaturas: "#fff7e8", subida: "#ffeef0", datos: "#eefcff", gerente: "#f6f0ff", tesoreria: "#fffbe6" };

const fantasma = (id) => `
<svg viewBox="0 0 46 52" aria-hidden="true">
  <ellipse cx="23" cy="50" rx="15" ry="2.5" fill="#0002"/>
  <path d="M5 24 C5 10 13 3 23 3 C33 3 41 10 41 24 L41 44 L36 40 L31 45 L26 40 L21 45 L16 40 L11 45 L5 41 Z" fill="${COLOR[id]}" stroke="#2a2550" stroke-width="2"/>
  <rect x="14" y="18" width="5" height="7" rx="2" fill="#1b1730"/><rect x="27" y="18" width="5" height="7" rx="2" fill="#1b1730"/>
  <rect x="15" y="19" width="2" height="2" fill="#fff"/><rect x="28" y="19" width="2" height="2" fill="#fff"/>
  <ellipse cx="12" cy="29" rx="3" ry="1.6" fill="#ff9db4" opacity=".7"/><ellipse cx="34" cy="29" rx="3" ry="1.6" fill="#ff9db4" opacity=".7"/>
  <text x="34" y="12" font-size="11">${{ voz: "🎧", gerente: "👔", tesoreria: "💵", guion: "✏️", datos: "🔍" }[id] || ""}</text>
</svg>`;

function crearCubiculos(agentes) {
  $("#cubiculos").innerHTML = Object.values(agentes)
    .map((a) => `
    <div class="cubiculo ${a.estado}" id="c-${a.id}" title="${a.rol}">
      <div class="burbuja" data-msg>${a.mensaje}</div>
      <div class="monitor">
        <div class="etiqueta">${ICONO[a.id]} ${a.n}<span class="nom">. ${a.nombre.toUpperCase()}</span></div>
        <span class="chip ${a.modo}" data-modo>${a.modo === "real" ? "REAL" : "DEMO"}</span>
        <div class="pantalla">${PANTALLA[a.id]()}</div>
      </div>
      <div class="pie-monitor"></div>
      <div class="progreso"><i data-prog></i></div>
      <div class="escritorio"><div class="teclado"></div></div>
      <div class="fantasma">${fantasma(a.id)}</div>
      <div class="nombre">${a.nombre}</div>
    </div>`)
    .join("");
}

function pintarAgente(a) {
  estado.agentes[a.id] = a;
  const c = $(`#c-${a.id}`);
  if (!c) return;
  c.className = `cubiculo ${a.estado}`;
  c.querySelector("[data-msg]").textContent = a.mensaje;
  c.querySelector("[data-prog]").style.width = `${Math.round((a.progreso || 0) * 100)}%`;
  const chip = c.querySelector("[data-modo]");
  chip.className = `chip ${a.modo}`;
  chip.textContent = a.modo === "real" ? "REAL" : "DEMO";
  if (a.id === "subida") c.querySelector("[data-bar]").style.width = `${Math.round((a.progreso || 0) * 100)}%`;
}

// ── Monitores que reflejan el video actual ──
let subIdx = 0;
setInterval(() => {
  const v = [...estado.videos].reverse().find((x) => x.guion);
  if (!v) return;
  const palabras = v.guion.narracion.split(/\s+/);
  subIdx = (subIdx + 3) % palabras.length;
  const sub = document.querySelector("[data-sub]");
  if (sub) sub.textContent = palabras.slice(subIdx, subIdx + 3).join(" ").toUpperCase();
  const mini = document.querySelector("[data-mini]");
  if (mini && v.guion.textoMiniatura) mini.textContent = v.guion.textoMiniatura.toUpperCase();
}, 700);

const historialVistas = [];
function pintarCanal(c) {
  estado.canal = c;
  historialVistas.push(c.vistasTotales || 0);
  if (historialVistas.length > 30) historialVistas.shift();
  const max = Math.max(1, ...historialVistas);
  const pts = historialVistas.map((v, i) => `${(i / Math.max(1, historialVistas.length - 1)) * 100},${48 - (v / max) * 44}`).join(" ");
  $("[data-linea]")?.setAttribute("points", pts);
  $("[data-area]")?.setAttribute("points", `0,50 ${pts} 100,50`);
  pintarKpis();
}

function pintarFinanzas(f) {
  estado.finanzas = f;
  const caja = $("[data-caja]");
  if (caja) { caja.textContent = `${f.beneficio < 0 ? "-" : ""}$${Math.abs(f.beneficio).toFixed(2)}`; caja.style.color = f.beneficio < 0 ? "#ff7a8c" : ""; }
  pintarKpis();
}

const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + " M" : n >= 1e3 ? (n / 1e3).toFixed(1) + " k" : String(Math.round(n || 0)));
function pintarKpis() {
  const f = estado.finanzas || { ingresos: 0, gastos: 0, beneficio: 0, roi: 0, ypp: {} };
  const c = estado.canal || {};
  const publicados = estado.videos.filter((v) => v.estado === "publicado").length;
  const k = [
    ["Videos publicados", publicados],
    ["Vistas", fmt(c.vistasTotales)],
    ["Suscriptores", fmt(c.suscriptores)],
    ["Ingresos", `$${f.ingresos.toFixed(2)}`, "pos"],
    ["Gastos", `$${f.gastos.toFixed(2)}`, "neg"],
    ["Beneficio", `${f.beneficio < 0 ? "-" : ""}$${Math.abs(f.beneficio).toFixed(2)}`, f.beneficio >= 0 ? "pos" : "neg"],
  ];
  $("#kpis").innerHTML = k.map(([l, v, cl]) => `<div class="kpi"><small>${l}</small><b class="${cl || ""}">${v}</b></div>`).join("");
  const subs = c.suscriptores || 0, vistas = c.vistas90d || 0;
  $("#yppSubs").textContent = `${fmt(subs)} / 1.000`;
  $("#yppVistas").textContent = `${fmt(vistas)} / 10 M`;
  $("#barSubs").style.width = `${Math.min(100, (subs / 1000) * 100)}%`;
  $("#barVistas").style.width = `${Math.min(100, (vistas / 1e7) * 100)}%`;
}

const ETQ = { publicado: "Publicado", pendiente: "Revisar", produciendo: "En producción", error: "Error", rechazado: "Rechazado" };
function pintarVideos() {
  const lista = [...estado.videos].reverse();
  $("#videos").innerHTML = lista.length
    ? lista.map((v) => `
      <div class="fila-video" data-ver="${v.video || ""}" title="${v.error || ""}">
        ${v.mini ? `<img src="${v.mini}" alt="">` : `<div class="ph"></div>`}
        <div class="t">${v.guion?.titulo || v.idea?.tema || "Buscando idea…"}${v.metricas ? ` · 👁 ${fmt(v.metricas.vistas)}` : ""}${v.url ? ` · <a href="${v.url}" target="_blank" rel="noopener">abrir</a>` : ""}</div>
        <span class="estado ${v.estado}">${v.estado === "produciendo" ? "⚙ " + (v.paso || "") : ETQ[v.estado] || v.estado}</span>
      </div>`).join("")
    : `<small style="color:var(--tenue)">Aún no hay videos. Pulsa “Producir 1 video”.</small>`;

  const pend = lista.filter((v) => v.estado === "pendiente");
  $("#tarjetaPendientes").hidden = !pend.length;
  $("#pendientes").innerHTML = pend.map((v) => `
    <div class="pendiente">
      <video src="${v.video}" muted playsinline preload="metadata" data-ver="${v.video}"></video>
      <div>
        <p>${v.guion.titulo}</p>
        <small style="color:var(--tenue)">${Math.round(v.segundos || 0)} s · ${v.idea.tema}</small>
        <div class="acciones" style="margin-top:8px">
          <button class="btn chico ok" data-aprobar="${v.id}">Aprobar y subir</button>
          <button class="btn chico" data-rechazar="${v.id}">Rechazar</button>
        </div>
      </div>
    </div>`).join("");
  pintarKpis();
}

function upsertVideo(v) {
  const i = estado.videos.findIndex((x) => x.id === v.id);
  i >= 0 ? (estado.videos[i] = v) : estado.videos.push(v);
  pintarVideos();
}

function agregarLog(l) {
  const d = document.createElement("div");
  const hora = new Date(l.t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  d.className = l.nivel;
  d.innerHTML = `<span class="hora">${hora}</span> <span class="ag">[${l.agente}]</span> `;
  d.append(document.createTextNode(l.texto));
  const box = $("#log");
  box.prepend(d);
  while (box.children.length > 120) box.lastChild.remove();
}

function nuevoPaquete() {
  const p = document.createElement("div");
  p.className = "paquete";
  $("#cinta").append(p);
  p.addEventListener("animationend", () => p.remove());
  const t = $("#toast");
  t.classList.add("ver");
  setTimeout(() => t.classList.remove("ver"), 2600);
}

function pintarRuntime(r) {
  estado.runtime = r;
  $("#chkAuto").checked = r.autopiloto;
  $("#btnProducir").disabled = r.produciendo;
  $("#btnProducir").textContent = r.produciendo ? "⚙ Produciendo…" : "▶ Producir 1 video";
}

// ── Eventos en vivo ──
function conectar() {
  const es = new EventSource("/events");
  es.onmessage = (m) => {
    const { tipo, datos } = JSON.parse(m.data);
    if (tipo === "inicio") {
      crearCubiculos(datos.agentes);
      Object.values(datos.agentes).forEach(pintarAgente);
      estado.videos = datos.videos;
      pintarVideos();
      pintarFinanzas(datos.finanzas);
      pintarCanal(datos.canal);
      pintarRuntime(datos.runtime);
      $("#log").innerHTML = "";
      datos.log.forEach(agregarLog);
      $("#avisoDemo").hidden = !Object.values(datos.agentes).some((a) => a.modo === "demo");
    }
    if (tipo === "agente") pintarAgente(datos);
    if (tipo === "log") agregarLog(datos);
    if (tipo === "video") upsertVideo(datos);
    if (tipo === "videos") { datos.forEach((v) => { const x = estado.videos.find((y) => y.id === v.id); if (x) x.metricas = v.metricas; }); pintarVideos(); }
    if (tipo === "nuevoVideo") nuevoPaquete();
    if (tipo === "finanzas") pintarFinanzas(datos);
    if (tipo === "canal") pintarCanal(datos);
    if (tipo === "runtime") pintarRuntime(datos);
  };
  es.onerror = () => { es.close(); setTimeout(conectar, 2000); };
}
conectar();

// ── Controles ──
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
$("#btnProducir").onclick = () => post("/api/producir");
$("#chkAuto").onchange = (e) => post("/api/autopiloto", { encendido: e.target.checked });
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-aprobar],[data-rechazar],[data-ver]");
  if (!t) return;
  if (t.dataset.aprobar) { t.disabled = true; post(`/api/aprobar/${t.dataset.aprobar}`, { decision: "aprobar" }); }
  else if (t.dataset.rechazar) post(`/api/aprobar/${t.dataset.rechazar}`, { decision: "rechazar" });
  else if (t.dataset.ver && !e.target.closest("a")) { $("#visorVideo").src = t.dataset.ver; $("#visor").showModal(); $("#visorVideo").play(); }
});
$("#visor").addEventListener("close", () => $("#visorVideo").pause());

// ── Reloj analógico ──
function reloj() {
  const d = new Date();
  const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  $(".aguja.s").style.transform = `rotate(${s * 6}deg)`;
  $(".aguja.m").style.transform = `rotate(${m * 6}deg)`;
  $(".aguja.h").style.transform = `rotate(${h * 30}deg)`;
}
setInterval(reloj, 1000);
reloj();
