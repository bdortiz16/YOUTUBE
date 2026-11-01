// Diseña la voz exclusiva del narrador con ElevenLabs Voice Design y guarda 3 muestras para escucharlas.
// Uso: npm run voz:disenar            (usa la descripción por defecto)
//      VOZ_DESCRIPCION="..." npm run voz:disenar
// Si ya existe una voz guardada, bórrala de data/db.json (marca.vozId) para diseñar otra.
import "../src/config.js";
import { vozDelCanal } from "../src/audio.js";

if (!process.env.ELEVENLABS_API_KEY) { console.error("Falta ELEVENLABS_API_KEY en .env"); process.exit(1); }
if (process.env.ELEVENLABS_VOICE_ID) { console.log("Ya usas ELEVENLABS_VOICE_ID; quítalo del .env para diseñar una voz propia."); process.exit(0); }
const id = await vozDelCanal(console.log);
console.log(`\nVoz del narrador: ${id}\nEscucha output/voz-muestra-1.mp3 (las otras 2 muestras son alternativas).`);
setTimeout(() => process.exit(0), 300);
