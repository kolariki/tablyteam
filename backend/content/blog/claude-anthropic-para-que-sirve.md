---
title: Claude (Anthropic): para qué sirve, qué modelos hay y en qué rol rinde mejor
description: Guía completa de Claude, la familia de modelos de Anthropic. Opus, Sonnet y Haiku, su estilo de razonamiento, dónde brilla al escribir código y diseñar productos, y qué roles de tu equipo conviene darle.
date: 2026-10-22
tags: [Claude, Anthropic, modelos de IA]
keywords: [Claude Anthropic, Claude Opus, Claude Sonnet, Claude Haiku, Claude Code, para qué sirve Claude, mejor IA para programar]
provider: anthropic
---

Claude es la familia de modelos de lenguaje de **Anthropic**. Es, hoy, el modelo que más usamos dentro de Tably Team cuando el trabajo es escribir código, redactar un brief preciso o diseñar un producto con criterio. Esta guía explica qué lo distingue, cómo elegir entre sus variantes y qué sillas del equipo le conviene ocupar.

## Las variantes: Opus, Sonnet y Haiku

Anthropic publica cada generación en tres tamaños. La lógica es siempre la misma: más capacidad cuesta más y tarda más.

| Modelo | Para qué | Cuándo elegirlo en Tably |
|---|---|---|
| **Claude Opus** | El más capaz: razonamiento largo, tareas con muchos pasos, código complejo, arquitectura | Constructor (vía Claude Code), CTO, Head of Engineering |
| **Claude Sonnet** | Equilibrio entre calidad, velocidad y costo | Product, Diseño, CEO; el brief del constructor directo |
| **Claude Haiku** | Rápido y barato, excelente para tareas acotadas | QA de consistencia, resúmenes, clasificación, descripciones de capturas |

En Tably, cuando dejás el modelo en «default» con Claude Code como constructor, el motor corre con Opus, que es el que mejor sostiene una construcción de muchos turnos sin perder el hilo.

## Qué lo distingue

### Sigue instrucciones largas sin desarmarse

Un brief de Tably puede tener cuarenta puntos: pantallas, datos, reglas de negocio, criterios de aceptación, restricciones de stack. Claude es notablemente bueno para **respetar todos a la vez** y para avisar cuando dos se contradicen, en lugar de elegir uno en silencio.

### Escribe código que se puede leer

El código de Claude tiende a estar bien estructurado, con nombres claros y pocas sorpresas. Para un constructor que entrega decenas de archivos, eso vale más que una solución ingeniosa que nadie después entiende.

### Trabaja sobre repositorios completos

**Claude Code**, el agente de programación de Anthropic, es un programa que corre en tu máquina (o en el servidor de Tably) y opera directamente sobre el proyecto: lee archivos, los edita, corre comandos, ejecuta pruebas. Es el constructor de escritorio por defecto en Tably y funciona con tu suscripción, sin gastar tokens de API.

### Es cauto con lo que no sabe

Frente a un requisito ambiguo, Claude pregunta o deja la suposición por escrito. En un equipo de agentes eso es una virtud: el CTO «Claude» es el que suele decir «esto no está definido, lo resolvemos así y lo marcamos».

### Ventana de contexto grande

Los modelos actuales de Claude manejan contextos muy amplios, lo que permite darle el brief, el sistema de diseño, la investigación de referencias y los archivos ya escritos sin resumir nada.

## Dónde conviene no usarlo

- **Tareas triviales y masivas**: si solo necesitás clasificar mil textos cortos, Haiku alcanza y Opus es un desperdicio.
- **Cuando el costo por token es lo único que importa**: hay alternativas más baratas (DeepSeek, Llama en Groq, Mistral) para roles de bajo riesgo.
- **Búsqueda en tiempo real**: Claude no navega por sí mismo; en Tably la investigación de referencias la hace el sistema con un navegador real y le pasa los resultados.

## Qué rol darle en tu equipo

Nuestra recomendación, después de cientos de construcciones:

- **Constructor**: Claude Code con Opus. Es la combinación que más proyectos termina sin intervención.
- **CTO o Head of Engineering**: Opus o Sonnet. Argumenta decisiones de arquitectura con claridad y detecta riesgos que otros modelos pasan por alto.
- **Diseño**: Sonnet. Entrega sistemas de diseño coherentes y sabe transcribir una referencia sin «mejorarla» cuando le pedís una réplica.
- **Product**: Sonnet. Escribe criterios de aceptación concretos y detecta cuando un flujo no cierra.
- **QA**: Haiku para revisiones rápidas de consistencia; Sonnet cuando la revisión es de fondo.

Un equipo entero de Claude funciona, pero pierde la riqueza del desacuerdo. Lo que mejor nos resulta es Claude en construcción e ingeniería, y otro proveedor (GPT o Gemini) en dirección o producto, para que el consejo discuta de verdad.

## Cómo se conecta en Tably

Hay dos caminos, y podés usar los dos:

1. **API key de Anthropic** en «Modelos y API keys». Sirve para cualquier rol del consejo y para el constructor por API. Se cobran los tokens a tu cuenta de Anthropic.
2. **Suscripción (Claude Code)**. Si tenés Claude Code instalado y con sesión iniciada, aparece como constructor de escritorio. Si usás Tably en la nube, generás un token con `claude setup-token` y lo pegás en tu configuración: el servidor construye con tu suscripción aunque tu computadora esté apagada.

## Preguntas que nos hacen seguido

**¿Claude es mejor que GPT para programar?** Para construcciones largas sobre un repositorio, en nuestra experiencia sí, de forma consistente. Para fragmentos cortos o tareas puntuales, las diferencias son chicas y dependen del día y del modelo exacto.

**¿Puedo mezclar Claude con otros modelos?** Es la idea de Tably. Cada rol elige su modelo.

**¿Cuánto cuesta?** Con Claude Code y suscripción, el costo de construcción es cero en tokens. Por API, depende del modelo: Opus es el más caro, Haiku el más barato. Tably muestra una estimación antes de arrancar y el costo real al terminar.

## En resumen

Claude es el modelo para el trabajo que más duele rehacer: la arquitectura, el código, el brief. Dale las sillas donde el criterio importa y dejá que otros modelos lo contradigan en dirección y producto.
