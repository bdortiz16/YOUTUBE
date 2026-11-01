# 🕯️ Hora Muerta Studio

**Una fábrica de Shorts de terror con 9 agentes de IA trabajando en una oficina.**
Canal: **Hora Muerta**. Lema: *"Historias que no deberías escuchar a las 3:33"*.

```
Tesorería ─► Tendencias ─► Gerente ─► Guion ─► Gerente (revisa) ─► Voz ─► Animación ─► Miniaturas ─► TÚ apruebas ─► Subida ─► Datos ─┐
    ▲                                                                                                                              │
    └──────────────────────── ingresos / vistas / qué temas funcionan ◄──────────────────────────────────────────────────────────────┘
```

| # | Agente | Qué hace | Con qué |
|---|--------|----------|---------|
| 1 | Tendencias | Radar de virales: Shorts de terror de los últimos 7 días ordenados por vistas/hora; analiza sus patrones de gancho y propone ideas originales | YouTube Data API + Claude + búsqueda web |
| 2 | Guion | Escribe 5 ganchos, elige el mejor y sigue la fórmula de retención (gancho → escalada → giro → final en bucle) | Claude |
| 3 | Voz | Narra el guion | ElevenLabs |
| 4 | Animación | Pide una imagen o clip por escena y monta el Short vertical 1080×1920 con fundidos, subtítulos, ruido y viñeta | **Higgsfield** o **fal.ai** + ffmpeg |
| 5 | Miniaturas | Portada 1280×720 con texto de impacto | ffmpeg |
| 6 | Subida | Publica en YouTube (marca `containsSyntheticMedia`) | YouTube Data API v3 |
| 7 | Datos | Lee vistas, likes, subs, retención e ingresos reales | YouTube Data + Analytics API |
| 8 | Gerente | Elige la idea según virales + datos propios; puntúa el guion con una rúbrica viral (gancho ≥ 8/10) y pide reescrituras | Claude |
| 9 | Tesorería | Presupuesto diario, costo por video, ingresos, ROI | interno |

Cada agente funciona en **modo DEMO** (simulado) si le falta su clave, así que puedes verlo andar desde el primer minuto.

## Arrancar

Requisitos: Node 20+ y ffmpeg.

```bash
npm install
npm run demo          # todo simulado, renderiza videos de verdad con ffmpeg
# abre http://localhost:3333
```

Para producir de verdad:

```bash
cp .env.example .env  # rellena las claves
npm run auth:youtube  # una vez, para conseguir YT_REFRESH_TOKEN
npm start
```

- **Claude**: `ANTHROPIC_API_KEY` (console.anthropic.com).
- **ElevenLabs**: `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` (elige una voz grave en español).
- **YouTube**: en Google Cloud crea un proyecto, habilita *YouTube Data API v3* y *YouTube Analytics API*, crea credenciales OAuth tipo *App de escritorio* y ejecuta `npm run auth:youtube`.
- **Fondos**: mete imágenes oscuras propias o con licencia en `assets/fondos/` y la animación les hará zoom lento (Ken Burns). Sin imágenes usa un degradado animado.

## Fórmula viral

**1. Radar (Tendencias).** Busca en YouTube Shorts de terror en español publicados en los últimos 7 días y los ordena por **vistas por hora**, que mide la velocidad de crecimiento y no solo el total. Claude detecta qué patrones se repiten en los que más crecen (reglas, imposible cotidiano, segunda persona…) y propone ideas **originales** con esos patrones. Nunca copia historias ajenas. Necesita `YT_API_KEY`.

**2. Guion con estructura de retención.**

| Tiempo | Parte | Regla |
|--------|-------|-------|
| 0–2 s | Gancho | Entra directo al conflicto y abre una pregunta. Sin "hola" ni intro |
| 2–10 s | Contexto | Quién, dónde, la regla o la anomalía |
| 10–40 s | Escalada | Un detalle nuevo e inquietante cada 5–8 s |
| 40–50 s | Giro | Cambia el sentido de todo |
| Final | Bucle | La última frase conecta con la primera para que se vuelva a ver |

Además escribe 5 ganchos con técnicas distintas y elige el más fuerte. Durante los primeros 2,2 s aparece un **texto grande en pantalla** que complementa al gancho.

**3. Rúbrica del Gerente.** Puntúa gancho, escalada, giro, bucle, título y originalidad de 0 a 10. Solo aprueba con **gancho ≥ 8** y media ≥ 7. Si no, pide reescribir (hasta 3 intentos).

**4. Aprendizaje (Datos).** Mide la **retención por video** con YouTube Analytics y calcula qué técnicas de gancho retienen más en *tu* canal. Ese aprendizaje vuelve al Gerente y al Guion en cada video.

> Nada garantiza que un video se haga viral. Este sistema sube las probabilidades: ganchos probados, buena retención y aprendizaje continuo.

## Visuales profesionales (Higgsfield / fal.ai)

El Guion escribe 6 escenas visuales y el agente de Animación se las pide a un generador:

| Proveedor | Variable | Qué usa | Costo aprox. por Short (6 escenas) |
|-----------|----------|---------|------------------------------------|
| Higgsfield | `HF_CREDENTIALS=KEY_ID:KEY_SECRET` | Flux Kontext (imagen) + DoP (imagen→video) | según tus créditos |
| fal.ai | `FAL_KEY` | Flux (imagen) + Kling/Veo/Seedance (video), configurable | ~$0,30 en imágenes · ~$2 en clips |

- `VISUAL_MODO=imagenes`: una imagen por escena con zoom lento. Barato y ya se ve mucho mejor.
- `VISUAL_MODO=video`: cada imagen se convierte en un clip de 5 s con movimiento. Más profesional y unas 6 veces más caro.
- Si un clip falla, esa escena se monta como imagen; si la imagen falla, la escena se omite. Sin proveedor configurado, se usa `assets/fondos/` o el degradado.
- La miniatura usa la primera escena como fondo.
- La Tesorería suma estos costos y respeta `GASTO_MAX_DIARIO_USD`.

Los modelos se pueden cambiar en `.env` (`HF_MODELO_*`, `FAL_MODELO_*`) sin tocar código.

## Seguridad por defecto

- `REQUIERE_APROBACION=1`: nada se sube sin que pulses **Aprobar y subir**.
- `YT_PRIVACIDAD=private`: los videos se suben privados hasta que los revises.
- `GASTO_MAX_DIARIO_USD`: la Tesorería detiene la producción si se pasa del presupuesto.

## La verdad sobre "ganar dinero en automático"

Ninguna app puede garantizar ingresos. Lo que tienes que saber:

1. **Monetizar Shorts exige entrar al Programa de Socios de YouTube**: 1.000 suscriptores **y** 10 millones de vistas válidas de Shorts en 90 días (hay un nivel inicial con 500 subs + 3 M de vistas, pero no paga por anuncios de Shorts). Hasta entonces los ingresos son 0; la app los muestra como *estimados*.
2. **El RPM de Shorts es bajo**: más o menos $0,03-0,10 por cada 1.000 vistas (depende del país del público). 1 millón de vistas ≈ $30-100.
3. **YouTube no monetiza "contenido no auténtico"** (antes llamado "repetitivo"): videos en masa, hechos con plantilla y sin valor añadido. Por eso el Gerente exige historias originales y distintas, y por eso **tu revisión humana es parte del negocio**, no un estorbo. Las granjas 100 % automáticas e idénticas suelen ser rechazadas o desmonetizadas.
4. **Declara el contenido sintético**: la app marca `containsSyntheticMedia`. No lo quites.

Lo que sí funciona: publicar a diario, mirar en *Datos* qué temas retienen y dejar que el Gerente haga más de eso. También conviene poner tu toque (voz propia, ilustraciones propias) y abrir otras fuentes de ingreso cuando crezca el canal: TikTok/Reels con las mismas piezas, patrocinios y libros o audiolibros de las historias.

## Estructura

```
server.js            servidor HTTP + API + eventos en vivo (SSE)
src/pipeline.js      la cadena de montaje y el piloto automático
src/agents/*.js      los 9 agentes
src/claude.js        cliente de Claude (salida JSON estructurada + búsqueda web)
src/youtube.js       subida resumible, miniaturas, estadísticas y analytics
public/              la oficina animada (HTML/CSS/JS sin frameworks)
scripts/youtube-auth.js   obtiene el refresh token de YouTube
```

## Ideas de marca alternativas

- **Hora Muerta** (elegida): 3:33 a.m., la "hora del diablo"; fácil de recordar y en español.
- **Relatos de las 3:33**
- **No Mires Atrás**
- **Cripta Nocturna**

Antes de decidirte, comprueba que el nombre esté libre en YouTube, TikTok e Instagram.
