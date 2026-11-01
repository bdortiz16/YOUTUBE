// Obtiene el YT_REFRESH_TOKEN con un flujo OAuth local (una sola vez).
// 1) En Google Cloud Console: crea un proyecto, habilita "YouTube Data API v3" y "YouTube Analytics API".
// 2) Crea credenciales OAuth tipo "App de escritorio" y pon YT_CLIENT_ID / YT_CLIENT_SECRET en .env
// 3) npm run auth:youtube  → abre el enlace, autoriza con la cuenta del canal, copia el token al .env
import http from "node:http";
import "../src/config.js";

const { YT_CLIENT_ID: id, YT_CLIENT_SECRET: secreto } = process.env;
if (!id || !secreto) { console.error("Falta YT_CLIENT_ID / YT_CLIENT_SECRET en .env"); process.exit(1); }
const PUERTO = 53682, redirect = `http://127.0.0.1:${PUERTO}`;
const scopes = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
].join(" ");
const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: "code", scope: scopes, access_type: "offline", prompt: "consent" })}`;
console.log("\nAbre este enlace y autoriza con la cuenta de tu canal:\n\n" + url + "\n");

http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get("code");
  if (!code) return res.end("Sin código");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secreto, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  res.end(j.refresh_token ? "Listo. Vuelve a la terminal." : "Error: " + JSON.stringify(j));
  console.log(j.refresh_token ? `\nAñade esto a tu .env:\n\nYT_REFRESH_TOKEN=${j.refresh_token}\n` : j);
  process.exit(0);
}).listen(PUERTO);
