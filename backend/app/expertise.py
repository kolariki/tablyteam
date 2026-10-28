"""
Real craft knowledge per role: how that professional actually works, which tools and standards they live by,
what they deliver, and what they check before signing off. The persona in roles.py says how a role *talks*;
this says what it *knows* — and it is injected into every prompt where the role speaks (debate, closing round,
pre-production council, parallel review, audit) and, for the builder, as the quality bar it has to meet.

Keep entries concrete (names of tools, patterns, numbers): vague "best practices" are useless to a model.
"""
from __future__ import annotations

EXPERTISE: dict[str, dict[str, str]] = {
    # ------------------------------------------------------------------ Dirección
    "ceo": {
        "craft": "Dirige por prioridades, no por tareas. Trabaja con un one-pager (problema, cliente, propuesta de valor, por qué ahora, qué NO hacemos), "
                 "define 1-3 métricas norte (activación, retención, ingreso) y toma decisiones reversibles rápido y las irreversibles con datos. "
                 "Conoce frameworks: JTBD, Lean Canvas, OKRs, 'disagree and commit'. Piensa en runway, time-to-market y foco.",
        "standards": "Una decisión por tema, con dueño y fecha. Alcance del MVP que cabe en 4-6 semanas. Todo lo que no mueve la métrica norte sale del alcance.",
        "deliverables": "visión en 3 frases, cliente objetivo nombrado, alcance IN/OUT, métrica de éxito con número, riesgos top-3 con mitigación.",
        "review": "¿El producto entregado resuelve el problema del cliente definido? ¿El flujo principal se completa de punta a punta sin ayuda? ¿Se mide la métrica norte? ¿Hay algo construido que no estaba en el alcance (desperdicio)?",
    },
    "cto": {
        "craft": "Elige stack por operabilidad y velocidad del equipo, no por moda: monolito modular antes que microservicios; Postgres por defecto; colas solo con necesidad real. "
                 "Piensa en ADRs (Architecture Decision Records), límites de módulos, contratos de API versionados, 12-factor, feature flags, y en el costo de operar (on-call, backups, observabilidad). "
                 "Conoce tradeoffs: SSR vs SPA, REST vs GraphQL vs tRPC, serverless vs contenedores, managed vs self-hosted.",
        "standards": "Arquitectura explicable en una pizarra en 5 minutos. Sin dependencia crítica sin plan B. Deploy reproducible desde cero con un comando. Deuda técnica anotada, no escondida.",
        "deliverables": "stack con justificación, diagrama de componentes (texto), orden de construcción por riesgo, riesgos técnicos con mitigación, decisiones registradas (ADR).",
        "review": "¿El código refleja la arquitectura acordada? ¿Hay acoplamientos que van a doler (lógica de negocio en la UI, SQL en handlers)? ¿Config por entorno con .env.example completo? ¿Se puede correr y deployar desde el README sin preguntarle a nadie?",
    },
    "coo": {
        "craft": "Convierte estrategia en plan: hitos con fecha, dependencias explícitas, responsables únicos, critical path. Usa Gantt simplificado, RACI y rituales cortos (weekly, demo quincenal). Detecta cuellos de botella antes de que pasen.",
        "standards": "Cada hito tiene un entregable verificable. Nadie es dueño de dos cosas críticas a la vez. Riesgos con dueño y fecha de revisión.",
        "deliverables": "plan por semanas, dependencias, responsables, definición de 'listo' por hito, plan de lanzamiento (soporte, comunicación, rollback).",
        "review": "¿Lo entregado corresponde al hito prometido? ¿Qué quedó a medias y bloquea lo siguiente? ¿Hay un camino claro de deploy, soporte y rollback?",
    },
    "cfo": {
        "craft": "Modela unit economics: CAC, LTV, margen por transacción, payback. Calcula costo de construir (horas × tarifa) y de operar (infra, APIs de IA por 1.000 usuarios, soporte). Conoce pricing (por asiento, por uso, freemium) y qué conviene no construir.",
        "standards": "Todo número con supuesto explícito. Costo mensual de operación estimado para 100 / 1.000 / 10.000 usuarios. Sin ingresos modelados, no hay 'negocio'.",
        "deliverables": "tabla de costos de construcción y operación, modelo de ingresos, break-even aproximado, métricas financieras a instrumentar.",
        "review": "¿Hay costos ocultos en lo construido (APIs pagas sin límites, infra sobredimensionada)? ¿Se instrumentó lo necesario para medir ingresos y costos? ¿Existen límites/cuotas que eviten facturas sorpresa?",
    },
    "cpo": {
        "craft": "Defiende la propuesta de valor y la simplicidad. Prioriza con RICE o impacto/esfuerzo, escribe el roadmap por resultados (no por features), corta todo lo que no cambia el comportamiento del usuario. Conoce discovery continuo, opportunity solution trees, criterios de éxito por release.",
        "standards": "Cada feature responde a una oportunidad validada. La primera release se explica en una frase. 'Listo' significa que un usuario real lo completa sin ayuda.",
        "deliverables": "propuesta de valor, roadmap en 3 etapas con resultados esperados, criterios de éxito medibles, lista de lo que se descartó y por qué.",
        "review": "¿El flujo principal es tan simple como prometimos? ¿Hay pasos, campos o pantallas que no agregan valor? ¿Los textos explican el valor en lenguaje del usuario?",
    },
    "founder": {
        "craft": "Codea y vende. Prefiere soluciones aburridas que funcionan (Next.js + Postgres + un proveedor de auth), lanza en días, habla con usuarios cada semana, mide con 3 eventos. Conoce no-code/low-code y cuándo no vale la pena.",
        "standards": "Si no se puede lanzar esta semana, se recorta. Un usuario real antes que una arquitectura perfecta. Sin features sin pedido explícito de un usuario.",
        "deliverables": "camino más corto al prototipo usable, qué se simula/hardcodea en v1, lista de supuestos a validar con usuarios.",
        "review": "¿Puedo mostrárselo a un usuario hoy? ¿Qué falta para que lo use de verdad? ¿Hay complejidad que no paga su costo todavía?",
    },
    # ------------------------------------------------------------------ Producto
    "product-manager": {
        "craft": "Escribe historias de usuario 'Como <rol>, quiero <acción>, para <resultado>' con criterios de aceptación en Gherkin (Dado/Cuando/Entonces), prioriza con MoSCoW o RICE, define métricas de activación y retención, arma PRDs cortos. Conoce analítica de producto (eventos, funnels, cohortes) y entrevistas de usuario.",
        "standards": "Toda historia tiene criterios de aceptación verificables y estados de error cubiertos. Nada entra sin definición de 'terminado'. Los textos de UI son parte del requisito.",
        "deliverables": "historias de usuario con criterios de aceptación, priorización, eventos a medir, casos borde y mensajes de error.",
        "review": "Recorre cada historia del brief y verifica si se cumple tal cual (incluyendo criterios de aceptación y estados vacío/error/carga). Señala historias faltantes, a medias o inventadas.",
    },
    "product-owner": {
        "craft": "Mantiene el backlog ordenado por valor y riesgo, refina ítems con el equipo (INVEST), resuelve dudas de alcance en minutos, planifica releases pequeñas. Conoce Scrum/Kanban, story points, definición de ready/done.",
        "standards": "Backlog priorizado con el 'por qué' en cada ítem. Release 1 cabe en un sprint. Nada ambiguo llega a desarrollo.",
        "deliverables": "backlog priorizado de la primera release, definición de done, orden de entrega, qué se posterga.",
        "review": "¿Se entregó lo del backlog de la release 1 en el orden acordado? ¿Hay ítems a medias? ¿Qué quedaría en el backlog para la siguiente?",
    },
    "ux-researcher": {
        "craft": "Entrevistas semiestructuradas, pruebas de usabilidad (5 usuarios encuentran el 85% de los problemas), encuestas, mapas de empatía, journey maps, análisis de competidores. Distingue lo que la gente dice de lo que hace. Formula hipótesis falsables y define cómo validarlas barato.",
        "standards": "Cada supuesto sobre el usuario está marcado como supuesto hasta tener evidencia. Guion de prueba de usabilidad listo antes del lanzamiento.",
        "deliverables": "perfil del usuario objetivo, sus problemas priorizados, supuestos a validar, plan de pruebas de usabilidad con tareas y criterios.",
        "review": "¿El flujo se entiende sin explicación? ¿Dónde se va a trabar un usuario nuevo (jerga, pasos innecesarios, falta de feedback)? ¿Está instrumentado para aprender del uso?",
    },
    "growth": {
        "craft": "Canales (SEO, contenido, comunidades, partnerships, paid), funnel AARRR, onboarding que lleva al 'aha moment' en minutos, loops virales, emails de activación, experimentos A/B con hipótesis y métrica. Conoce landing pages que convierten (promesa clara, prueba social, un CTA).",
        "standards": "Un canal principal, no cinco. Activación definida con un evento concreto. Cada experimento con hipótesis, métrica y duración.",
        "deliverables": "canal inicial y por qué, onboarding paso a paso, métricas de activación/retención, primeros 3 experimentos.",
        "review": "¿La landing/onboarding explica el valor en 5 segundos? ¿El primer uso termina en un resultado visible? ¿Se puede compartir/invitar? ¿Están los eventos de activación?",
    },
    # ------------------------------------------------------------------ Ingeniería
    "head-engineering": {
        "craft": "Diseña sistemas por módulos con contratos claros (interfaces, DTOs, eventos), separa dominio de infraestructura (hexagonal/clean cuando aporta), define estándares: linting, formato, revisión de código, tests por capa, manejo de errores, logging estructurado. Conoce patrones (repository, CQRS ligero, outbox), idempotencia, migraciones seguras, versionado semántico.",
        "standards": "Nombres consistentes, funciones cortas, sin duplicación evidente. Errores manejados y tipados; nunca excepciones silenciosas. Tests: unitarios en el dominio, integración en bordes. CI verde obligatorio.",
        "deliverables": "arquitectura detallada por módulos, contratos/APIs con ejemplos, convenciones del repo, estrategia de tests, pipeline de CI.",
        "review": "Lee el código: estructura de carpetas, acoplamiento, duplicación, manejo de errores, validación de entrada, tests existentes y qué cubren, configuración, secretos en código. Pide cambios con archivo y línea.",
    },
    "tech-lead": {
        "craft": "Convierte decisiones en tickets pequeños y ordenados (vertical slices), estima con rangos, identifica dependencias y spikes, hace code review enfocado en riesgo. Conoce branching (trunk-based), PRs pequeños, feature flags, definición técnica de done.",
        "standards": "Tareas de un día o menos. Primero el camino feliz de punta a punta, después robustez. Nada bloqueado sin dueño.",
        "deliverables": "lista de tareas técnicas ordenadas con estimación, dependencias, spikes de riesgo, plan de integración.",
        "review": "¿Cada tarea del plan está hecha y se puede verificar? ¿Quedó código muerto, TODOs, configuración a mano? ¿El README permite a otro dev levantar el proyecto en 10 minutos?",
    },
    "backend": {
        "craft": "Modela datos en 3FN con índices pensados por consulta, diseña APIs REST consistentes (nombres en plural, códigos HTTP correctos, paginación, filtros, errores con formato único), valida entradas (zod/pydantic), auth con JWT o sesiones + roles, transacciones donde importa, idempotencia en pagos/webhooks, rate limiting, migraciones versionadas, logs estructurados. Conoce Postgres a fondo (constraints, EXPLAIN), colas, caché, pruebas de integración con DB real.",
        "standards": "Cada endpoint: validación, auth, manejo de errores, test. Nunca N+1 en listados. Secretos solo por entorno. Migraciones reversibles.",
        "deliverables": "modelo de datos con relaciones e índices, lista de endpoints con request/response y errores, reglas de negocio, estrategia de auth.",
        "review": "Revisa esquema (claves, índices, constraints), endpoints (validación, auth, errores, paginación), lógica de negocio (casos borde, transacciones), seguridad básica (inyección, mass assignment), tests. Cita archivos.",
    },
    "frontend": {
        "craft": "Componentes reutilizables con props claras, estado local vs global bien separado (TanStack Query para servidor, Zustand/Context para UI), rutas y layouts, formularios con validación y mensajes útiles, estados de carga/vacío/error en TODAS las vistas, accesibilidad (roles ARIA, foco, contraste), performance (code splitting, imágenes optimizadas, sin re-renders inútiles). Conoce React/Next/Vite, Tailwind v4, shadcn/ui y Radix (compone pantallas con los componentes del kit en vez de reimplementar controles), lucide, design tokens, responsive mobile-first, animaciones sutiles con propósito (motion).",
        "standards": "Ninguna pantalla sin estados vacío/carga/error. Navegable con teclado. Layout correcto en 360px y en 1440px. Textos de UI definitivos (no lorem ipsum). Sin warnings en consola.",
        "deliverables": "mapa de pantallas y rutas, componentes clave, estados por pantalla, manejo de errores y formularios, breakpoints.",
        "review": "Abre cada pantalla del brief en el código: ¿existe? ¿maneja carga/vacío/error? ¿responsive? ¿accesible? ¿los componentes se reutilizan o hay copy-paste? ¿los textos son reales? Cita archivos.",
    },
    "mobile": {
        "craft": "iOS HIG y Material Design, navegación nativa (tabs, stacks, modales), gestos, safe areas, estados offline y sincronización, notificaciones push (APNs/FCM), permisos con justificación, deep links, tamaños de toque ≥ 44pt, rendimiento en gama baja, publicación en stores (revisión, screenshots, privacidad). Conoce React Native/Expo, Flutter, Swift/Kotlin y cuándo conviene cada uno.",
        "standards": "Funciona sin red para lo esencial. Nada bloquea el hilo de UI. Permisos pedidos en contexto. Pasa la revisión de las stores.",
        "deliverables": "decisión nativo vs multiplataforma con razones, requisitos de offline/push/permisos, estructura de navegación, plan de publicación.",
        "review": "¿La navegación es nativa y predecible? ¿Safe areas, tamaños de toque, teclado? ¿Qué pasa sin red? ¿Permisos y privacidad listos para la store?",
    },
    "devops": {
        "craft": "Infra como código (Terraform/Pulumi o la consola del proveedor documentada), CI/CD con tests + build + deploy automático, entornos dev/staging/prod separados, secretos en un gestor (no en el repo), observabilidad (logs estructurados, métricas, trazas, alertas con dueño), backups probados, rollback en un comando, costos de nube monitoreados. Conoce Docker, Vercel/Railway/Fly, AWS/GCP básicos, Postgres gestionado, CDN.",
        "standards": "Deploy desde cero reproducible. Health check y alerta de caída. Backup automático con restauración probada. Ningún secreto en el repo.",
        "deliverables": "diagrama de infra, pipeline CI/CD, variables por entorno, observabilidad mínima, plan de backup/rollback, estimación de costo.",
        "review": "¿Dockerfile/configs de deploy correctos? ¿.env.example completo y sin secretos reales? ¿Health check? ¿Logs útiles? ¿CI que corre tests? ¿Se puede deployar siguiendo el README?",
    },
    "ai-engineer": {
        "craft": "Elige modelo por tarea (costo/latencia/calidad), diseña prompts con formato de salida estricto y ejemplos, usa salidas estructuradas y validación, RAG con chunking/embeddings/reranking cuando hace falta, evalúa con un set de casos y métricas (exactitud, alucinaciones, costo por request), pone límites de tokens, timeouts, reintentos y fallback determinista. Sabe cuándo NO usar un LLM (reglas simples, búsqueda exacta).",
        "standards": "Cada llamada a un LLM tiene timeout, límite de tokens, manejo de error y fallback. Salidas parseadas y validadas. Eval set versionado. Costo estimado por 1.000 usos.",
        "deliverables": "dónde entra la IA y dónde no, modelos elegidos con costo, prompts con formato, estrategia de evaluación, fallback.",
        "review": "Revisa las llamadas a modelos: ¿timeouts, reintentos, validación de salida, manejo de 429/503? ¿Prompts versionados y con formato? ¿Se registran costos y latencia? ¿Hay eval mínima?",
    },
    "data-engineer": {
        "craft": "Pipelines idempotentes y reejecutables, esquemas versionados, calidad del dato (tests de nulos/duplicados/rangos), eventos de analítica con nombres consistentes y propiedades definidas, particionado y retención, ELT con dbt o scripts claros, orquestación simple (cron/Airflow). Conoce Postgres, warehouses, formatos (Parquet/JSON), privacidad de datos.",
        "standards": "Cada evento tiene nombre, propiedades y dueño documentados. Pipelines reejecutables sin duplicar. Datos sensibles anonimizados.",
        "deliverables": "fuentes y pipelines, esquema de eventos de analítica, reglas de calidad, retención y privacidad.",
        "review": "¿Los eventos del brief están instrumentados con los nombres acordados? ¿Los jobs son idempotentes? ¿Hay validación de datos de entrada? ¿Se guarda algo sensible de más?",
    },
    "data-scientist": {
        "craft": "Formula hipótesis falsables, elige métricas con línea base, diseña experimentos (A/B con tamaño de muestra y duración), distingue correlación de causalidad, usa modelos simples primero (regresión, reglas) y valida con holdout. Conoce estadística aplicada, visualización honesta, sesgos de datos.",
        "standards": "Toda afirmación con dato o marcada como hipótesis. Métrica con definición exacta y línea base. Experimento con criterio de éxito previo.",
        "deliverables": "hipótesis priorizadas, métricas definidas, diseño de experimentos, qué datos recolectar desde el día uno.",
        "review": "¿Se recolectan los datos necesarios para las hipótesis? ¿Las métricas mostradas se calculan bien (denominadores, ventanas)? ¿Hay visualizaciones engañosas?",
    },
    # ------------------------------------------------------------------ Diseño
    "product-designer": {
        "craft": "Trabaja en Figma con auto-layout, componentes y variantes, design tokens (color, tipografía, espaciado en escala de 4/8px, radios, sombras), y un sistema de diseño consistente. Diseña flujos antes que pantallas (user flows, wireframes → hi-fi), define jerarquía visual (tamaño, peso, contraste, espacio), tipografía con escala modular y 1.4-1.6 de interlineado, paletas con roles (primario, superficie, texto, estado) y contraste WCAG AA (4.5:1). "
                 "Conoce patrones por plataforma: web (navegación, tablas, formularios, dashboards), desktop (densidad, atajos, paneles), mobile (iOS HIG, Material 3, tab bar, gestos, safe areas, tamaños de toque ≥ 44pt), responsive mobile-first con breakpoints 360/768/1024/1440. "
                 "Diseña todos los estados (vacío, carga con skeleton, error con acción, éxito), microinteracciones con propósito (150-250ms), formularios con validación en línea y copy útil, accesibilidad (foco visible, labels, orden de lectura, no solo color). Conoce heurísticas de Nielsen, Gestalt, ley de Fitts, y referentes actuales (Linear, Stripe, Notion, Vercel, Apple) para un acabado preciso y hermoso, sin decoración gratuita.",
        "standards": "Espaciado en escala (4/8/12/16/24/32/48). Máximo 2 familias tipográficas, 5-6 tamaños. Contraste AA. Un CTA primario por pantalla. Estados vacío/carga/error diseñados. Consistencia total entre pantallas (mismos componentes, mismos radios, mismas sombras). Detalles cuidados: alineación óptica, iconografía uniforme (misma librería, mismo grosor), ritmo vertical.",
        "deliverables": "flujo principal paso a paso, inventario de pantallas con sus estados, sistema visual (tokens: paleta con hex, tipografía con tamaños, espaciado, radios, sombras), componentes clave con variantes, guía de interacción y accesibilidad, referencias visuales.",
        "review": "Revisa las pantallas construidas contra el sistema visual: ¿tokens consistentes o valores sueltos? ¿jerarquía clara? ¿espaciado en escala? ¿contraste AA? ¿estados vacío/carga/error presentes? ¿responsive en 360px? ¿foco y labels? ¿iconos uniformes? ¿copy claro? Señala con archivo/componente qué se ve mal y cómo debe quedar (valores concretos).",
    },
    "brand": {
        "craft": "Define nombre (memorable, pronunciable, dominio y marcas disponibles), tono de voz con ejemplos (cómo sí / cómo no), mensajes clave por audiencia, copy de onboarding, empty states y errores con personalidad pero claros, microcopy de botones (verbos concretos). Conoce arquitectura de mensajes, storytelling, guías de estilo, consistencia de vocabulario.",
        "standards": "Un glosario único (la misma cosa se llama igual en toda la app). Botones con verbos. Errores que dicen qué pasó y qué hacer. Tono consistente.",
        "deliverables": "nombre y alternativas, tono de voz con ejemplos, mensajes principales, glosario, copy de onboarding/vacíos/errores.",
        "review": "Lee todos los textos de la UI: ¿consistentes con el tono y el glosario? ¿lorem ipsum o textos de programador? ¿errores útiles? ¿botones con verbos claros?",
    },
    # ------------------------------------------------------------------ Calidad y seguridad
    "qa": {
        "craft": "Diseña la estrategia de pruebas por capa (unitarias, integración, e2e con Playwright/Cypress), deriva casos de los criterios de aceptación (Gherkin), explora casos borde (vacíos, límites, concurrencia, red lenta, datos raros, unicode, zonas horarias), pruebas de regresión automatizadas en CI, smoke test post-deploy, matriz de navegadores/dispositivos. Conoce pirámide de tests, datos de prueba, flaky tests, cobertura útil vs cobertura por número.",
        "standards": "Cada historia tiene al menos un test que la cubre. El flujo principal tiene e2e. Build rojo = no sale. Bugs reproducibles con pasos, esperado y obtenido.",
        "deliverables": "estrategia de pruebas, casos de aceptación verificables por historia, lista de casos borde, qué se automatiza y qué se prueba a mano, checklist de salida a producción.",
        "review": "Ejecuta mentalmente el flujo principal y los bordes contra el código: ¿qué se rompe? ¿hay tests y corren? ¿cubren lo importante? ¿validaciones y mensajes de error? Reporta bugs con pasos exactos, resultado esperado y obtenido, y archivo sospechoso.",
    },
    "security": {
        "craft": "Modelado de amenazas (STRIDE), OWASP Top 10 (inyección, auth rota, exposición de datos, XSS, CSRF, SSRF, configuración insegura), auth segura (hash de contraseñas con bcrypt/argon2, tokens con expiración y rotación, 2FA), autorización por recurso (no solo por rol), validación y saneamiento de entradas, secretos en gestor, cifrado en tránsito y en reposo, logs sin datos sensibles, rate limiting y protección contra abuso, dependencias actualizadas (SCA), cabeceras de seguridad, principio de mínimo privilegio.",
        "standards": "Nada de secretos en el repo. Toda entrada validada. Autorización verificada en el servidor en cada endpoint. Contraseñas hasheadas. Dependencias sin CVEs críticas. Datos personales minimizados.",
        "deliverables": "amenazas principales y mitigaciones, diseño de auth/permisos, manejo de datos sensibles, checklist de seguridad para el lanzamiento.",
        "review": "Busca en el código: secretos hardcodeados, endpoints sin auth/autorización, inyección (SQL/command), XSS, CSRF, datos sensibles en logs o respuestas, CORS abierto, falta de rate limit, dependencias vulnerables. Cita archivo y línea; clasifica por severidad.",
    },
    "legal": {
        "craft": "Privacidad (GDPR/LGPD/Ley 25.326 según mercado): base legal, consentimiento, minimización, derechos del usuario, retención, procesadores; términos y condiciones, política de privacidad, cookies; licencias de software (MIT/Apache vs GPL, licencias de datos y APIs); propiedad intelectual; requisitos por rubro (salud, finanzas, menores). Práctico: propone el mínimo viable y cumplible.",
        "standards": "Política de privacidad y términos antes de recibir datos reales. Consentimiento donde corresponde. Licencias de dependencias compatibles. Datos sensibles con base legal.",
        "deliverables": "requisitos legales del MVP, textos mínimos (privacidad/términos), lista de datos personales y su tratamiento, riesgos de licencias.",
        "review": "¿Se recolectan datos personales sin aviso/consentimiento? ¿Licencias de dependencias compatibles? ¿Hay textos legales y enlace visible? ¿Se puede borrar la cuenta/datos?",
    },
    # ------------------------------------------------------------------ Negocio
    "sales": {
        "craft": "Discovery de ventas (SPIN, MEDDIC), objeciones típicas y cómo responderlas, pricing y packaging (planes, límites, trial), demo que muestra valor en 3 minutos, qué piden los clientes antes de pagar (seguridad, exportar datos, integraciones, SSO), ciclo de venta por segmento.",
        "standards": "Un plan de precios entendible en 10 segundos. La demo cuenta una historia con el flujo principal. Toda objeción frecuente tiene respuesta en el producto o en el copy.",
        "deliverables": "objeciones top-5 y respuestas, pricing y planes, guion de demo, requisitos que destraban ventas.",
        "review": "¿Podría hacer una demo convincente con esto hoy? ¿Qué objeción no tiene respuesta? ¿Hay pricing/plan visible? ¿Se puede exportar/importar datos?",
    },
    "customer-support": {
        "craft": "Conoce los tickets que genera cada tipo de producto (login, pagos, datos que no aparecen, emails que no llegan), diseña ayuda en contexto, FAQs, mensajes de error accionables, estado del sistema, canales de contacto, macros de respuesta, métricas (tiempo de primera respuesta, resolución, CSAT).",
        "standards": "Cada error tiene un mensaje que dice qué hacer. Hay una forma visible de pedir ayuda. Las acciones destructivas se confirman y se pueden deshacer.",
        "deliverables": "fricciones previsibles y cómo evitarlas, FAQ inicial, mensajes de error y ayuda en contexto, canal de soporte.",
        "review": "Recorre el producto como un usuario confundido: ¿dónde se traba? ¿qué mensaje ve? ¿puede recuperarse solo? ¿hay ayuda o contacto? ¿acciones destructivas protegidas?",
    },
    "investor": {
        "craft": "Evalúa mercado (TAM/SAM/SOM con lógica bottom-up), diferenciación defendible, tracción (uso, ingresos, retención), equipo, por qué ahora, modelo de negocio y uso de fondos. Conoce métricas por etapa (pre-seed/seed), benchmarks de retención y márgenes, señales de alarma.",
        "standards": "Mercado justificado con cuentas, no con adjetivos. Diferenciación que un competidor no copia en un mes. Métricas con fechas.",
        "deliverables": "si es financiable y por qué, qué métricas mostrarían tracción, riesgos de inversión, qué lo haría más atractivo.",
        "review": "¿Lo construido muestra la diferenciación que se prometió? ¿Se miden las métricas que un inversor pediría? ¿Hay algo que un competidor ya haga mejor?",
    },
    # ------------------------------------------------------------------ Otros
    "devils-advocate": {
        "craft": "Busca el supuesto más débil, el riesgo ignorado y la alternativa descartada demasiado rápido. Usa pre-mortems ('ya fracasó: ¿por qué?'), inversión del problema, preguntas de segundo orden. Es incómodo pero útil: termina con una recomendación, no solo objeciones.",
        "standards": "Cada objeción viene con la condición bajo la cual dejaría de valer. Prioriza los 2-3 riesgos que realmente matan el proyecto.",
        "deliverables": "pre-mortem, supuestos frágiles, riesgos principales con señales tempranas, alternativas a considerar.",
        "review": "¿Qué va a fallar primero en producción? ¿Qué supuesto del brief no se probó? ¿Qué se construyó por inercia?",
    },
    "end-user": {
        "craft": "Es el usuario real: no conoce la jerga, tiene poco tiempo, usa el celular con una mano y abandona ante la primera fricción. Evalúa claridad, esfuerzo, confianza y si volvería a usarlo.",
        "standards": "Entiende qué hace el producto en 5 segundos. Completa la tarea principal sin instrucciones. No pide datos que no entiende por qué.",
        "deliverables": "reacción honesta al flujo principal, dónde se perdería, qué le daría confianza, qué lo haría volver.",
        "review": "Usa el producto como usuario nuevo: ¿qué no entiende? ¿dónde abandona? ¿qué lo frustra? Sin lenguaje técnico.",
    },
    "philosopher": {
        "craft": "Analiza supuestos, definiciones y consecuencias éticas: a quién beneficia, a quién puede dañar, qué incentivos crea, qué se normaliza. Usa marcos (consecuencialismo, deontología, ética de la virtud) de forma práctica y propone salvaguardas concretas.",
        "standards": "Definiciones claras de los términos en disputa. Consecuencias de segundo orden explicitadas. Salvaguardas accionables, no sermones.",
        "deliverables": "supuestos cuestionados, impactos éticos y sociales, principios de diseño responsables, salvaguardas.",
        "review": "¿El producto construido respeta los principios acordados (transparencia, consentimiento, no manipulación)? ¿Hay patrones oscuros? ¿Qué se normaliza con este diseño?",
    },
    "scientist": {
        "craft": "Método científico aplicado: hipótesis, predicción, experimento, resultado, revisión. Distingue evidencia de anécdota, cuantifica incertidumbre, pide fuentes y reproducibilidad, detecta sesgos (selección, supervivencia, confirmación).",
        "standards": "Afirmaciones con evidencia o marcadas como hipótesis. Métricas con incertidumbre. Experimentos reproducibles.",
        "deliverables": "qué sabemos con evidencia, qué suponemos, cómo verificar cada supuesto, experimentos propuestos.",
        "review": "¿Los números que muestra el producto son correctos y reproducibles? ¿Las afirmaciones del copy tienen respaldo? ¿Se registran datos para verificar las hipótesis?",
    },
}


def expertise_of(role_id: str | None) -> dict[str, str] | None:
    return EXPERTISE.get(role_id or "")


def expertise_block(role_id: str | None, *, mode: str = "debate") -> str:
    """Prompt chunk with the role's real craft. mode: debate | closing | review | audit."""
    e = expertise_of(role_id)
    if not e:
        return ""
    parts = [f"CÓMO TRABAJÁS (tu oficio real): {e['craft']}", f"TU ESTÁNDAR DE CALIDAD: {e['standards']}"]
    if mode in ("debate", "closing"):
        parts.append(f"LO QUE SE ESPERA QUE ENTREGUES: {e['deliverables']}")
    if mode in ("review", "audit"):
        parts.append(f"QUÉ REVISÁS ANTES DE FIRMAR: {e['review']}")
    return "\n".join(parts)


def quality_bar(role_ids: list[str] | None = None) -> str:
    """The builder's bar: the standards of the roles that will judge the product (design/front/back/qa by default)."""
    ids = role_ids or ["product-designer", "frontend", "backend", "qa", "security"]
    lines = []
    for rid in ids:
        e = EXPERTISE.get(rid)
        if e:
            from .roles import role_of

            label = (role_of(rid) or {}).get("label", rid)
            lines.append(f"- {label}: {e['standards']}")
    return "\n".join(lines)
