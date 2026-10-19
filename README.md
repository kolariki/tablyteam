# ⚡ Agent Arena

Experimento multi-agente **en vivo**: modelos de distintas empresas (Claude, GPT, DeepSeek, Gemini, Kimi, Grok, Llama, Mistral…) conversan entre sí, deciden a quién pasarle la palabra, discrepan, votan un ganador — y todo se ve en pantalla en tiempo real, listo para grabar y subir a redes. Cada llamada queda trazada en **Langfuse**.

```
┌──────────── Frontend (React + React Flow + Framer Motion + Recharts) ────────────┐
│  grafo de agentes · partículas en cada handoff · globos de diálogo en streaming   │
│  subtítulos tipo "lower third" · métricas · matriz de alianzas · veredicto 👑    │
└───────────────▲──────────────────────────────────────────────────────────────────┘
                │ WebSocket  /ws/sessions/{id}   (eventos JSON en streaming)
┌───────────────┴──────────── Backend (FastAPI) ───────────────────────────────────┐
│  Orchestrator ─► turnos / handoffs / votación ─► guarda sesión (replay)           │
│  Providers: Anthropic SDK · OpenAI-compatible (OpenAI, DeepSeek, Gemini, Kimi, xAI,   │
│             Groq, Mistral, OpenRouter, Ollama) · mock (sin API, gratis)            │
└───────────────┬──────────────────────────────────────────────────────────────────┘
                │ OpenTelemetry (Langfuse SDK v4)
         ┌──────▼──────┐
         │  Langfuse   │  trace por sesión · span por turno · generation por LLM
         └─────────────┘  costo, tokens, latencia, scores (ganador, desacuerdo…)
```

## Landing y cuentas

Antes del login hay una landing con una demo animada en loop (escribir el experimento → elegir las IAs → debate con handoffs → veredicto). Botones *Iniciar sesión* / *Crear cuenta*; `#login` abre directo el login.

## Arranque rápido

```bash
cp .env.example .env        # Langfuse local; las API keys de modelos se cargan por usuario en la app
make install
make dev                    # backend :8000 + frontend :5173 — dejalo corriendo en una terminal propia
```

Si la UI muestra la barra roja *«El backend no responde»*, es que el proceso de `make dev` no está corriendo.

Abrí http://localhost:5173, elegí un experimento y dale **Iniciar**. Si un proveedor no tiene key, el preset lo reemplaza por un agente **simulado** (mismo color/logo) para que puedas probar todo gratis.

### Langfuse

- **Cloud**: creá un proyecto en https://cloud.langfuse.com, copiá `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` y `LANGFUSE_BASE_URL` al `.env`.
- **Local (self-hosted)**: `make langfuse` levanta Langfuse en http://localhost:3000. Las variables `LANGFUSE_INIT_*` del `.env` crean automáticamente la org, el proyecto, el usuario y las keys en el primer arranque (usuario: `LANGFUSE_INIT_USER_EMAIL` / `LANGFUSE_INIT_USER_PASSWORD`).

Qué se registra:

| Langfuse | Contenido |
|---|---|
| Session | una por corrida (`session_id` = id de la arena) |
| Trace `arena · <título>` | config completa, transcripción y stats finales; tags = modo + proveedores |
| `turn-NN · <agente>` (agent) | prompt del que llamó, salida parseada |
| `llm · <modelo>` (generation) | system+user, salida cruda, tokens, costo, TTFT, razonamiento nativo |
| eventos `handoff A → B` | motivo, si fue pedido o forzado |
| `final-vote` | votos de cada agente |
| Scores | `winner`, `disagreement_rate`, `avg_confidence`, `total_cost_usd` |

En la UI aparece un botón **Langfuse** que abre la traza de la sesión.

## Configuración: modelos y API keys

Botón **Modelos y API keys** (arriba en el inicio). Por cada proveedor:
- **API key propia**: se verifica contra el proveedor antes de guardarse (una key rechazada no se guarda), se cifra (Fernet) en `backend/data/arena.db` y nunca vuelve al navegador: solo se ven los últimos 4 caracteres.
- **Modelo por defecto**: dropdown con la **lista real** del proveedor (más nuevos primero, sin modelos de audio/imagen/embeddings); lo usan los presets, los agentes nuevos y el brief.
- **Estado**: *Tu key* o *Sin key*. Sin key propia, ese proveedor no se puede usar (las keys del `.env` solo se comparten si `ARENA_SHARE_SERVER_KEYS=true`).
- Ollama: URL del servidor local.

El secreto de cifrado sale de `ARENA_SECRET_KEY` o se genera en `backend/data/.secret` (permisos 600). Si lo perdés, las keys guardadas quedan ilegibles y hay que volver a cargarlas.

## Conectar tu plan pago (Claude Code / Codex)

En **Configuración → Tu suscripción** la app muestra cada agente local (Claude Code, Codex CLI) con su estado: instalado, con login, conectado. Si falta algo, da los pasos (`npm install -g @anthropic-ai/claude-code` → `claude auth login` → «Ya me logueé, verificar»); mientras te logueás desde la terminal, la app consulta sola cada 4 s y avisa cuando queda conectado. Para probar ese flujo sin cerrar tu sesión real: `touch backend/data/.engines-offline` (o `ARENA_ENGINES_OFFLINE=1`) hace que todos los agentes aparezcan como "sin sesión"; borrá el archivo para volver a la realidad.

## Cuentas

Cada usuario se registra con email y contraseña y ve **solo sus** experimentos, replays y videos (guardados en `backend/data/sessions/<user_id>/`). Contraseñas con scrypt, tokens opacos con vencimiento (30 días), SQLite en `backend/data/arena.db`. En Langfuse cada traza lleva el `user_id` (email).
La **primera cuenta** que se crea adopta las sesiones grabadas antes de que existieran las cuentas. `ARENA_ALLOW_SIGNUP=false` cierra el registro.

## Experimentos propios y sus "videos"

Cada tarjeta de experimento tiene de fondo una **escena animada** (SVG con animaciones nativas, en loop, 1–7 KB, sin licencias). Las 10 escenas de los experimentos incluidos están en `frontend/public/scenes/`. Con **«Guardar como experimento»** (setup) la configuración actual (tema, modo, equipo, skills) se guarda como tarjeta propia y la app **genera su escena al instante** (`backend/app/scenes.py`): elige el motivo por las palabras del título/tema (tienda → productos y carrito; móvil → teléfonos; startup → cohete; juicio/debate → podio; detective/incidente → radar; negociación → curvas que convergen; datos/marketing → dashboard; IA/API/equipo → red de nodos; construir → plano; ética → orbes y balanza) y los colores a partir del título. Se sirve en `GET /api/scenes/{id}.svg`; se puede reemplazar por un `.mp4` propio. Endpoints: `GET/POST /api/presets`, `DELETE /api/presets/{id}`.

## Roles de equipo

Cada rol tiene, además de su personalidad (`roles.py`), su **oficio real** (`expertise.py`): cómo trabaja ese profesional, con qué herramientas y estándares (p. ej. el Product Designer: Figma, design tokens, escala de espaciado 4/8, tipografía, contraste WCAG AA, patrones web/desktop/mobile con iOS HIG y Material, estados vacío/carga/error, referentes como Linear/Stripe/Notion), qué entrega y qué revisa antes de firmar. Ese bloque se inyecta en todos los prompts donde el rol habla (debate, ronda de cierre, consejo, revisión paralela, auditoría), y los **estándares de calidad** de los roles del equipo se le dan al constructor como la vara con la que lo van a revisar. Antes de cada ronda del consejo, la app pregunta **qué querés que traten primero**; el equipo empieza por eso y después suma lo que cada uno encuentre.


Cada agente puede tener un **rol** (CEO, CTO, Senior Head of Engineering, Product Manager, Product Designer, QA, Security, AI Engineer, DevOps, Growth, Inversor, Abogado del diablo, Usuario final… 31 en total, en `backend/app/roles.py`). El rol entra al prompt con una **responsabilidad concreta** ("debe quedar resuelto: stack, arquitectura, riesgos técnicos…"), así un equipo cubre un proyecto de punta a punta y el brief final sale con pasos accionables. Al elegir un rol se autocompletan nombre y personalidad (editables). Preset listo: **🏗️ Construir una app: equipo completo** (CEO, CTO, Head of Eng, Product, Diseño, QA).

## Skills por rol

Cada rol puede llevar **skills**: documentos Markdown con conocimiento que el usuario carga (guías, convenciones, formatos de datos, referencias; p. ej. "formato de datos de INPRES", "nuestra voz de marca", "checklist de Stripe"). Se guardan por usuario (`backend/app/skills.py`, tabla `skills`), hay plantillas listas (iOS HIG, Material 3, WCAG 2.2, Stripe, Next.js App Router, SEO/landing, OWASP) y se adjuntan desde el chip **skills** de cada tarjeta de rol en el setup, desde **Equipo** en plena sesión (aplican desde el próximo turno del rol) y, antes de cada ronda del consejo, en el diálogo de prioridades (por rol). El rol las recibe en su prompt en todos los contextos donde habla (debate, cierre, consejo, revisión, auditoría) y el Product Designer en la fase de diseño. Endpoints: `GET/POST/DELETE /api/skills`, `PATCH /api/sessions/{sid}/agents/{aid}/skills`, `PATCH /api/builds/{bid}/team/{aid}/skills`.

## Modos

- **Handoff libre** — cada agente elige a quién llamar (o `END`). Es el que mejor muestra "quién llama a quién y por qué".
- **Debate** — ronda fija; igual se registra a quién *quería* llamar cada uno (aparece como "↻ turno fijo").
- **Mesa redonda** — ronda ordenada para construir una solución.
- **Ronda de cierre** (por defecto, si hay roles) — terminado el debate, cada rol entrega sus **decisiones finales** sobre su responsabilidad, sin debatir, en Markdown. Es lo que alimenta el brief.
- **Votación final** (opcional) — todos votan en paralelo al mejor aporte; desempate por confianza promedio.
- **Juez** — después de la votación, un modelo neutral (elegible en el setup) explica **por qué ganó**: titular, argumento, momento clave y qué le faltó al resto, basado en la transcripción, los votos y los datos. El overlay también muestra los números duros (votos y de quién, confianza, veces que lo llamaron, desempate).

Cada agente responde con un protocolo de etiquetas (`<reflexion> <message> <stance> <confidence> <next> <reason>`; no se usa `<thinking>` porque los Claude 5 rechazan fabricar ese bloque) que el front parsea **mientras llega el stream**, así funciona igual con cualquier proveedor. Con `deepseek-reasoner` (o modelos que exponen `reasoning_content`) también se muestra el razonamiento nativo 🧠.

## Exportar cada sesión

Menú **Exportar** (barra superior, en sesiones terminadas o replays):

| Export | Qué es |
|---|---|
| **Video** | MP4/WebM 9:16 o 16:9 (ver abajo) |
| **Brief para construir** | Un modelo que elegís convierte el debate + ronda de cierre en una **especificación completa para construir sin volver a preguntar** (17 secciones): decisiones del equipo, alcance, historias de usuario, stack, **cuentas y API keys necesarias** (dónde obtenerlas, variable de entorno, costo), `.env` completo, arquitectura (mermaid), **DDL SQL**, contratos de API, pantallas con estados, estructura de carpetas, **comandos de setup**, tickets por etapa, tests y gate de release, deploy/operación, riesgos y un **prompt listo para pegar** adaptado al constructor: **Claude Code** (BRIEF.md + CLAUDE.md), **Cursor** (.cursor/rules), **ChatGPT/Claude.ai** o genérico. Se ve escribirse en vivo; *Copiar prompt*, *Copiar todo* o *Descargar .md*. Se cachea por destino (no re-gasta tokens) y queda trazado en Langfuse. |
| **Transcripción** | El debate completo en Markdown (sin modelo): participantes, turnos, posturas, handoffs, veredicto, métricas. |

Flujo típico: debate → **Brief para construir** → o bien descargás el .md y pegás el prompt final en tu agente, o bien **Construir en la app**.

## Auditar un proyecto existente

Botón **Auditar un proyecto** en el inicio: subís un `.zip` de tu código (se ignoran `node_modules`, `.git`, binarios y archivos > 400 KB), ponés nombre y una descripción de qué es y qué te preocupa, elegís el **equipo auditor** (preset: CTO, Head of Engineering, Security, QA, Product, Diseño; cualquier rol del catálogo) y el motor (API o Claude Code/Codex local). Cada rol audita desde su área leyendo el código y devuelve **qué está bien**, **qué hay que mejorar** (`[crítico]` / `[importante]` / `[mejora]`), **propuestas concretas** y un **puntaje 0–10**; un "presidente" sintetiza todo en un **Informe de auditoría** (pestaña *Informe*, descargable como `.md`). Después tildás las propuestas que querés y **Aplicar mejoras**: el constructor las implementa sobre tu proyecto y el consejo las revisa hasta aprobarlas; descargás el zip mejorado. Las auditorías quedan en el historial y se reabren desde ahí.

## Construir en la app

**Fase de diseño primero** (activada por defecto en el panel de brief): antes de escribir código, el Product Designer del equipo (su modelo por API; si no hay key, el propio constructor o Claude Code) entrega `design/DESIGN.md` (dirección visual, sistema con paleta HEX y contraste AA, tipografía con escala, espaciado 4/8, componentes con estados, cada pantalla con layout/jerarquía/estados/responsive, flujo, checklist), `design/tokens.css` (variables) y `design/mockup.html` (maqueta hi-fi navegable de 3-5 pantallas). El constructor recibe la regla de implementarlo fielmente (tokens tal cual, misma estructura y estados; "una UI que no coincide con el mockup es un bug") y el consejo juzga la interfaz contra ese diseño. Pestaña **Diseño** del constructor para verlo; la miniatura "Cómo va quedando" muestra el mockup desde el primer minuto. Evento `design.ready`.

Mientras un agente local (Claude Code / Codex) construye, el chat no muestra llamadas crudas a herramientas sino **qué está haciendo en lenguaje simple**: "Escribiendo src/api.py", "Instalando dependencias", "Corriendo los tests"; su propio plan (TodoWrite) como barra de progreso; su razonamiento en vivo mientras piensa (`--include-partial-messages`); y un latido ("sin novedades hace 20 s") para que un paso largo nunca parezca colgado. Cada turno cierra con un resumen (archivos nuevos, ediciones, tests, comandos). La sesión de Claude Code se guarda (`engine_session`) y el botón **"abrir en mi Claude Code"** copia `cd <carpeta> && claude --resume <id>`; las reanudaciones desde la app usan ese mismo id. Si cerrás el panel y volvés, "Brief para construir" ofrece **Retomar la construcción** en vez de empezar de cero. Detener mata el proceso del agente (no quedan agentes huérfanos escribiendo en la carpeta).

### Sin API: motores locales (Claude Code / Codex)

En el selector de constructor aparece primero **Claude Code · tu suscripción** (y **Codex CLI · ChatGPT**). Agent Arena corre el CLI oficial en esta máquina (`claude -p … --output-format stream-json` / `codex exec --json`), con el login del propio CLI (plan Pro/Max de claude.ai o cuenta de ChatGPT): **no se usa la API ni tu key**. El agente trabaja en una carpeta real (`backend/data/builds/<usuario>/<build>/`, con `BRIEF.md` adentro): escribe los archivos, puede correr `npm install`/tests, mantiene su propia conversación (`--continue`) para cambios y reanudaciones, y genera `preview/index.html`. El **consejo de revisión** también corre por el CLI (un revisor por vez, en modo solo lectura). Requisitos: CLI instalado y logueado (`claude auth login` / `codex login`); el estado se muestra en el selector. Aplican los límites de uso de tu plan. No se conecta a claude.ai/chatgpt.com por fuera de los CLI oficiales.


Desde el brief, botón **Construir el producto**: elegís el modelo constructor entre tus proveedores con key (si hay uno solo, se usa ese), se muestra la intro con el logo del modelo y se abre el **constructor**: un chat tipo asistente donde el modelo escribe el proyecto archivo por archivo siguiendo el plan del brief (etapas, `README.md`, `.env.example`, código completo), con árbol de archivos y visor de código en vivo. Podés escribirle para pedir cambios (los toma en el siguiente turno, o reanuda la construcción si ya terminó), detenerlo y **descargar el .zip** del proyecto (incluye `BRIEF.md`). No se ejecuta código en el servidor: el zip se corre en tu máquina siguiendo el README. Cada construcción queda guardada por sesión y trazada en Langfuse (`build · <título>`); se puede reabrir y **reanudar** con un mensaje incluso después de reiniciar el servidor.

- **Vista previa del producto final**: al terminar, el constructor genera en una pasada `preview/index.html`, un prototipo autocontenido y navegable (pantallas principales con datos de ejemplo, mismo diseño y flujos). Se muestra en la pestaña **Vista previa** del constructor (iframe aislado), se puede abrir en una pestaña nueva, regenerar tras cambios, y va en el zip.
- **Nunca se pierde el contexto**: cada construcción guarda archivos, chat, etapas, rondas de revisión **y el historial compactado que ve el modelo**. Si se interrumpe (error de API, corte, reinicio del servidor), aparece **Reanudar construcción**: el constructor recibe el árbol de lo ya escrito y sigue desde donde quedó, en el mismo chat. Las respuestas vacías no entran al contexto (evita el 400 de Anthropic) y si un turno se corta por el límite de salida, el archivo incompleto se descarta y se le pide seguir con menos archivos por turno (máx. 3–4).
- **Servicios externos requeridos + deploy** (pestaña *Servicios y deploy* del constructor): lista todas las variables/API keys que la app necesita, derivadas de su `.env.example` y de la tabla 6.1 del brief, agrupadas por servicio (Supabase, Stripe, Resend, OpenAI, Postgres, secretos propios…) con el link para conseguir cada una y su propósito. Cargás los valores ahí (cifrados por proyecto, nunca en el código), bajás el `.env`, y hacés **deploy con un clic** a **Vercel** (recomendado para frontends/Next/Vite) o **Railway** (backends/APIs con DB): usa el CLI oficial en tu máquina con un token cargado en *Configuración → Deploy* o el login del CLI (`vercel login` / `railway login`), pasa las variables al proveedor y muestra el log y la URL final.
- **Consejo de revisión pre-producción**: terminado el proyecto, botón **Enviar al consejo** (o tildá *Revisión pre-prod del equipo al terminar* al lanzar). Los roles de la sesión revisan el proyecto **en paralelo**, cada uno desde su área, leyendo el código entregado, y devuelven *aprueba* o *pide cambios* con hallazgos `[bloqueante]`/`[mejora]` y pedidos concretos. Si hay pedidos, vuelven al constructor (que los aplica y regenera la vista previa) y el consejo revisa de nuevo —sabiendo qué pidió antes— hasta que **todos aprueban** (estado *✓ Aprobado por el consejo*) o se alcanza el máximo de rondas (1–6). Los reviewers usan el modelo de su agente en la sesión; si ese proveedor no tiene key, usan el modelo constructor. Todo queda en Langfuse (`pre-prod review · round N`).
- **Grabar la construcción**: tildá *Grabar la construcción en video* al lanzar (Chrome pide compartir la pestaña) o usá **● Grabar** en el constructor; se graba intro + chat + código + vista previa y el video se descarga al terminar (6 s después del final) o al detener.

## Revisión pre-producción = el mismo debate, en la arena

Cuando una construcción termina (o apretás «Enviar al consejo»), el equipo no revisa en silencio: se abre una **sesión de arena en modo `review`** con los mismos roles, el mismo grafo/handoffs/subtítulos que el debate inicial, y el proyecto entregado (brief + árbol + archivos clave) como contexto. Debaten, cada rol da su veredicto en la ronda de cierre (`APRUEBO` / `CAMBIOS` + lista `- [bloqueante|mejora] …`) y un presidente del consejo consolida todo en el evento `council.verdict` (`approved`, `headline`, `why`, `changes[{severity, role, text}]`). La tarjeta de veredicto muestra **lo que hay que cambiar** con checkboxes y el botón **«Construir con estos cambios»** → `POST /api/builds/{bid}/council/apply` → el constructor aplica la lista en el mismo chat; si pediste más rondas, el consejo vuelve a la arena al terminar. Lanzar a mano: `POST /api/builds/{bid}/council` → `{session_id}`. (`council: false` en `BuildRequest` conserva la revisión paralela antigua.)

## Versiones y % listo para producción

Cada pasada del constructor guarda una **versión**: v1 = primera construcción, v2 = después de aplicar la lista del consejo (ronda 1), v3 = ronda 2, … (también las mejoras de una auditoría o un pedido tuyo por chat). Por versión se guarda: qué pidió el equipo (ítems `R1.1, R1.2…` con severidad y rol), qué cambió respecto de la anterior (archivos nuevos/modificados/borrados y líneas +/−, con diff por archivo), el resumen del constructor, el veredicto del consejo sobre esa versión, qué ítems pedidos quedaron `done / partial / pending` según el consejo, y un **% listo para producción** (0–100): aprobada → 100; si no, el porcentaje de ítems pedidos resueltos (parcial cuenta mitad) menos lo que el consejo todavía encuentra abierto (15 puntos por bloqueante, 4 por mejora). Los contenidos de cada versión se guardan en `backend/data/sessions/<usuario>/<sesión>.build.<id>.v<n>.json`, y si hay `git`, la carpeta del proyecto recibe un commit + tag `v<n>` por versión (podés hacer `git diff v1 v2` vos mismo). Pestaña **Versiones** del constructor: línea de tiempo con el % por versión, los ítems pedidos con su estado y el diff de cada archivo. Endpoints: `GET /api/sessions/{sid}/builds/{bid}/versions` y `…/versions/{n}/diff?path=`. Eventos: `build.version`, `build.readiness`.

## Pedir un developer (FDE)

Última milla humana, a precio fijo y alcance cerrado (`backend/app/fde.py`): **Puesta en producción** (USD 199, 48 h), **Integración de un servicio** (USD 149), **Revisión humana pre-lanzamiento** (USD 99), **Horas** (USD 75/h, mín. 4). Entradas: tarjeta «Pedir un developer» en el modal *Correr la app*, botón en el constructor cuando la construcción terminó, y «¿Preferís que un developer lo resuelva?» en el veredicto del consejo (precarga los bloqueantes). El pedido genera un **ticket automático** con el estado real del proyecto: resumen del brief, versión y % listo, bloqueantes abiertos, servicios externos y variables faltantes, stack detectado, deploys previos; el usuario lo puede bajar en `.md`. Pago y agenda opcionales por `.env`: `FDE_CHECKOUT_URL_LAUNCH|INTEGRATION|REVIEW|HOURS` (Stripe Payment Links) y `FDE_BOOKING_URL` (Cal.com). Endpoints: `GET /api/fde/packages`, `POST/GET /api/fde/requests`, `GET /api/fde/requests/{id}/ticket.md`, `PATCH /api/fde/requests/{id}` (cancelar).

## Correr la app real (sin deploy)

Botón **Correr la app** (arriba a la derecha del constructor, y como acción principal cuando la construcción termina): abre un modal sobre el build con la app real corriendo (arranca sola) y, abajo, los próximos pasos: **Descargar el proyecto**, **Verificar con el consejo** (debate en la arena) y **Mandar a producción** (Vercel/Railway; destacado cuando el consejo ya aprobó). Desde el inicio, «Abrir» en un proyecto con build cae directo en el build (el debate queda en «← Arena»; el botón de video sigue reproduciendo el debate). La pestaña **App real** del constructor tiene lo mismo embebido: detecta qué se puede correr en el proyecto (Next/Vite/Node por `package.json`, FastAPI/Flask/Django por `pyproject`/`requirements`, o `docker compose`), instala lo que falte, levanta el dev server en un puerto libre de tu máquina y lo muestra en un iframe con logs y botón Detener. Las variables guardadas en «Servicios y deploy» se escriben como `.env` (sin pisar uno existente). Si no arranca, un botón le manda el error y el log al constructor para que lo arregle. Endpoints: `GET/POST/DELETE /api/sessions/{sid}/builds/{bid}/run`; eventos `app.status` / `app.log`. Todo se apaga con el backend.

## Hacer videos 🎬

0. **⬇ Video** (barra superior, en sesiones terminadas o replays): elegí 9:16 o 16:9, velocidad y cuánto dura el veredicto en pantalla → la sesión se reproduce desde cero, se graba solo el área de la arena y se descarga el archivo (MP4 en Chrome reciente, si no WebM). Chrome pide permiso para compartir la pestaña: elegí *esta pestaña*.
1. **Grabá una vez con APIs reales, reproducí mil veces**: cada sesión se guarda en `backend/data/sessions/` y se puede re-ver desde *Sesiones grabadas* con velocidad 0.5×–8× (sin gastar tokens). Link directo: `http://localhost:5173/#replay=<id>`.
2. **REC**: oculta controles y agranda los subtítulos.
3. **9:16**: layout vertical para Reels / TikTok / Shorts (grabá la ventana con OBS y recortá al marco).
4. **🔊**: efectos de sonido sintetizados en cada handoff, voto y veredicto.
5. **Pausa entre turnos** (setup): subila para que la cámara "respire" entre handoffs.

## API / eventos

`POST /api/sessions` con un `SessionConfig` → `{id}`; luego `WS /ws/sessions/{id}`:

| evento | datos |
|---|---|
| `session.started` | config, colores de proveedores, url de Langfuse |
| `turn.started` | agente, quién lo llamó y por qué |
| `token` | delta de texto (`kind: text|reasoning`) |
| `turn.completed` | pensamiento, mensaje, postura, confianza, next, motivo, métricas (latencia, TTFT, tokens, t/s, costo) |
| `handoff` | from → to, motivo, `requested` vs `forced_reason` |
| `vote` / `verdict` | votos y ganador |
| `session.paused` | un proveedor devolvió 503/429/timeout dos veces seguidas: `agent_id`, `provider`, `model`, `error` (motivo literal del proveedor), `attempts` |
| `session.resumed` / `agent.updated` | el usuario eligió reintentar, o cambió el modelo de un rol (`provider`, `model`) |
| `session.completed` | stats por agente |

Constructor: `POST /api/builds` · `GET /api/sessions/{id}/builds[/{bid}[/zip]]` · `POST /api/builds/{bid}/message|stop` · `WS /ws/builds/{bid}?token=`.

Modelo caído a mitad del debate: el equipo se **detiene** y la arena muestra «Modelo no disponible» con el motivo del proveedor (no es culpa de tu configuración). Opciones: *Esperar y reintentar* (`POST /api/sessions/{id}/resume`, 3 reintentos más a 0/10/20 s) o *Cambiar de modelo* (`PATCH /api/sessions/{id}/agents/{agent_id}` con `{provider, model}`); el debate sigue desde el mismo turno sin perder nada. El mismo endpoint sirve desde el botón **Equipo** para ascender/descender cualquier rol a otro modelo en cualquier momento. Para probarlo sin gastar: agente con proveedor `mock` y modelo `mock-503`.

Otros: `GET /api/providers`, `GET /api/providers/{id}/models` (lista real de modelos del proveedor), `GET /api/presets`, `GET /api/sessions`, `GET /api/sessions/{id}`, `POST /api/sessions/{id}/stop`.

## Estructura

```
backend/app/
  main.py           FastAPI + WebSocket
  orchestrator.py   loop de turnos, handoffs, votación, stats, guardado
  providers.py      streaming unificado + mock
  observability.py  Langfuse v4 (no-op si no hay keys)
  pricing.py        precios estimados por modelo (editables)
  presets.py        experimentos listos para video
frontend/src/
  components/ArenaGraph.tsx  grafo React Flow, nodos animados, aristas con partículas
  components/Captions.tsx    subtítulos para video
  components/LiveFeed.tsx    transcripción en vivo
  components/Metrics.tsx     stats, velocidad, tokens, confianza, alianzas, timeline
  components/Verdict.tsx     podio + confetti
  components/Setup.tsx       armado del experimento + historial/replay
```

## Dashboard, costos y límites

El inicio muestra **Mis proyectos**: debates, auditorías y construcciones con estado, costo, fecha, buscador, renombrar y borrar (borra también exports, builds, carpeta y secretos), gasto en API del mes y total, trabajos en curso, y una checklist de puesta en marcha (keys / Claude Code / Langfuse). Antes de lanzar un debate se muestra el **costo estimado** en API. Límite de trabajos simultáneos por usuario (`ARENA_MAX_JOBS_PER_USER`, default 3), rate limit en login/registro, cabeceras de seguridad, y guardado de cada sesión turno a turno (un corte nunca pierde el debate). Toasts para todo lo relevante y **notificaciones del navegador** cuando termina algo largo con la pestaña en segundo plano. Error boundary: nunca una pantalla en blanco.

## Calidad

```bash
make test     # pytest del backend con agentes simulados (parsers, pipelines, API end-to-end)
make check    # tests + typecheck + build del frontend
```

CI en GitHub Actions (`.github/workflows/ci.yml`): backend (pytest) y frontend (tsc + build) en cada push. Los tests no usan red ni keys: todos los proveedores son el motor simulado. Documentación interactiva de la API en http://localhost:8000/api/docs.

## Docker

```bash
make langfuse   # Langfuse en :3000
make up         # app en http://localhost:8080
```

## Skills recomendadas para seguir iterando con Claude Code

Investigación (oct-2026) de las skills más útiles para la parte visual:

| Skill | Para qué | Instalación |
|---|---|---|
| **frontend-design** (Anthropic) | dirección de diseño fuerte, tipografía, animaciones; evita la estética "AI genérica" | `/plugin marketplace add anthropics/skills` |
| **Remotion best practices** | convertir sesiones guardadas en **videos MP4 renderizados por código** (intro, subtítulos, música) | `npx skills add remotion-dev/skills` |
| **shadcn** | componentes UI consistentes si el panel crece | via marketplace de skills |
| **D3.js visualization** | visualizaciones a medida (p. ej. cuerdas de alianzas, sankey de handoffs) | via marketplace de skills |

Siguiente paso natural: una composición Remotion que lea `backend/data/sessions/<id>.json` y renderice el clip vertical automáticamente.

## Catálogo de skills

Además de tus skills y las plantillas, la app descarga **todas las Agent Skills públicas** que encuentra (el repo oficial
`anthropics/skills`, la lista `VoltAgent/awesome-agent-skills` con sus ~1500 skills enlazadas, `obra/superpowers`) a
`backend/data/skills-catalog/sources/` y las indexa (`app/skills_catalog.py`).

- En cada rol, el selector de skills tiene un **buscador** y agrupa el catálogo por categoría: CEO, CTO, producto, diseño,
  frontend, backend, mobile, QA, DevOps, seguridad, datos e IA, marketing, documentos.
- **Sugerir skills** (en la cabecera de agentes) elige del catálogo las que mejor encajan con la consigna, rol por rol.
- **El consejo elige skills** (checkbox del setup) hace lo mismo automáticamente al arrancar; las rondas del consejo de
  revisión lo hacen siempre. Se suman a las que elegiste, nunca las reemplazan.
- `POST /api/skills/catalog/sync` (o «actualizar catálogo» en el selector) vuelve a descargar las fuentes. Las skills del
  catálogo entran al prompt del rol igual que las tuyas (`SKILL.md` + lista de archivos que las acompañan). Respetá la
  licencia de cada repo (ver el enlace a GitHub en cada ítem).

## Idioma de la interfaz (ES / EN)

El header tiene un switch **ES | EN** que cambia todos los textos de la app (`frontend/src/lib/i18n.ts`: cada string
visible se escribe como `T('español', 'English')` y el idioma se guarda en el navegador). Los datos integrados en el backend
(roles, grupos, experimentos, plantillas de skills) viajan en los dos idiomas (`app/i18n_data.py`, campos `*_en`). Las
skills del catálogo están en inglés; **Traducir catálogo** (en el selector de skills) las traduce al español con uno de tus
modelos y guarda el resultado en `backend/data/skills-catalog/translations.json`. El idioma del debate entre modelos es
otra cosa: se elige en el setup («Idioma»).

## Pulido visual

Para que el primer build se vea como un producto y no como "HTML con un poco de CSS", la fase de diseño y el constructor reciben la
skill oficial `frontend-design` de Anthropic (está en el catálogo descargado), y después de construir corre una pasada obligatoria de
**pulido visual** (`POLISH_PROMPT` en `app/design.py`): tipografía real cargada, todo desde `design/tokens.css`, layout y responsive,
estados de botones/inputs/vacío/carga/error, un primer impacto memorable y accesibilidad AA. Recién después se crea la versión.
