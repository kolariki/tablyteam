---
title: Apps de referencia e ingeniería inversa: cómo Tably estudia las apps que te gustan antes de construir la tuya
description: Cómo funciona la investigación de referencias en Tably Team: visita real con navegador, capturas, descripción con un modelo de visión y, con el análisis profundo, ingeniería inversa de bundles, rutas y APIs para replicar una app con fidelidad.
category: Prompt engineering y referencias
date: 2026-10-22
tags: [apps de referencia, ingeniería inversa, cómo funciona, diseño]
keywords: [clonar una app con IA, ingeniería inversa de apps, apps de referencia, replicar diseño de una app, REA reverse engineering]
---

«Que se parezca a X» es una de las instrucciones más útiles y más mal entendidas en el desarrollo con IA. Un modelo que no vio X no puede parecerse a X: inventa. Tably Team resuelve eso **mirando las apps de verdad** antes de diseñar y construir.

## Nivel 1: observación

Cuando cargás una o más apps de referencia (hasta seis), el sistema hace lo siguiente para cada una:

1. **La visita con un navegador real**, en paralelo, con una ventana de tamaño de escritorio y de móvil.
2. **Saca capturas** de la pantalla principal y, cuando puede, de secciones internas.
3. **Un modelo con visión** (Gemini Flash por defecto; también GPT o Claude) describe cada captura: jerarquía visual, componentes, paleta, tipografía, patrones de navegación, estados vacíos, llamados a la acción.
4. **Un modelo de síntesis** arma un documento de investigación: qué patrones vale la pena emular, cuáles evitar, en qué se parecen y en qué se diferencian las referencias entre sí.

Ese documento y las capturas quedan dentro del proyecto, en la carpeta de investigación, y los leen el diseñador y el constructor. Es **gratis**: solo gasta los tokens del modelo de visión, que son pocos.

Ves todo el proceso en pantalla: las capturas apareciendo, la descripción escribiéndose, el documento final. Si una referencia no se pudo visitar (sitios que bloquean navegadores automáticos, por ejemplo), lo ves y podés reemplazarla.

## Nivel 2: análisis profundo e ingeniería inversa

Activando «Análisis profundo e ingeniería inversa», el constructor recibe además una herramienta de ingeniería inversa (REA) con la que, durante la construcción, puede:

- Analizar los **bundles** de JavaScript de la app de referencia para entender su estructura de componentes.
- Descubrir **rutas** y pantallas que no son visibles desde la portada.
- Inspeccionar las **APIs** que la app consume: qué datos pide, cómo los organiza.
- Extraer tokens de diseño reales: colores exactos, tipografías, espaciados, radios, sombras.

Con esto, el proyecto entra en **modo clon**: el sistema de diseño y las pantallas se transcriben del referente en lugar de inspirarse en él. El brief y las ideas propias del diseñador quedan subordinados al plano: si pediste una réplica, la referencia manda.

### Requisitos

- REA instalado en la máquina donde corre Tably (`npx rea-agents setup`). Si no está, la casilla aparece deshabilitada y el equipo solo observa (nivel 1).
- Un constructor de escritorio (Claude Code o Codex), que son los que pueden usar herramientas durante la construcción.
- Corre con tu suscripción o tu API key; Tably no cobra tarifa por el análisis.

## Qué significa «fidelidad» en Tably

Hay dos niveles de instrucción que recibe el equipo:

- **Sin ingeniería inversa**: «llevá las pantallas al nivel de esos productos; emulá los patrones marcados, evitá los señalados». La referencia es una vara.
- **Con ingeniería inversa**: «construí la réplica pantalla por pantalla contra el plano y las capturas; la paleta, la tipografía, la grilla y los componentes son los del referente aunque el brief diga otra cosa». La referencia es un plano.

Esa distinción existe porque son pedidos distintos. «Que se vea profesional como Linear» no es lo mismo que «quiero un Linear para mi equipo».

## Cómo elegir buenas referencias

- **Dos o tres, no seis.** Más referencias diluyen la señal.
- **Del mismo tipo de producto** que el tuyo: una app de turnos para una app de turnos.
- **Páginas públicas** que se puedan ver sin iniciar sesión. Si la pantalla que te interesa está detrás de un login, el navegador de Tably no va a entrar.
- **Una referencia por aspecto**, si querés: «la navegación de A, el onboarding de B».

## Cuestiones legales y de uso razonable

Observar una app pública y describir sus patrones es lo que hace cualquier diseñador con una pestaña abierta. La ingeniería inversa de bundles y APIs públicas, como herramienta de aprendizaje, está dentro de prácticas habituales de la industria, pero **replicar una marca, copiar contenido con derechos o reproducir una app completa para competir con ella puede infringir términos de servicio o leyes de propiedad intelectual**. Usá el modo clon para prototipos, aprendizaje y productos propios con identidad propia; la responsabilidad del uso es tuya.

## Qué ves en el proyecto

- `research/REFERENCES.md`: el documento de investigación.
- `research/shots/`: las capturas.
- `research/DEEP_ANALYSIS.md` (con análisis profundo): el plano de clonación.
- `design/DESIGN.md` y `design/tokens.css`: el sistema de diseño que resultó.

## En resumen

Pasale las apps que te gustan y Tably las mira antes de diseñar. Si querés una vara, dejá el nivel 1. Si querés un plano, activá la ingeniería inversa y construí con un agente de escritorio.
