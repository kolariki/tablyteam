---
title: Ollama: correr modelos de IA en tu propia computadora, gratis y en privado
description: Qué es Ollama, qué modelos podés correr localmente (Llama, Mistral, Qwen, DeepSeek, Gemma), qué hardware necesitás, qué calidad esperar y cómo usarlo en un equipo de IA sin que ningún dato salga de tu máquina.
date: 2026-10-22
tags: [Ollama, modelos locales, privacidad, modelos de IA]
keywords: [Ollama, modelos de IA locales, correr LLM en mi computadora, IA sin internet, IA privada, Llama local]
provider: ollama
---

**Ollama** es un programa que corre modelos de lenguaje abiertos **en tu propia computadora**. Sin API key, sin costo por token, sin que ningún dato salga de tu máquina. En Tably Team aparece como un proveedor más: cualquier rol del equipo puede usar un modelo local.

## Cómo funciona

Instalás Ollama, descargás un modelo con un comando (`ollama pull llama3.2`, por ejemplo) y queda corriendo un servidor local al que Tably le habla como a cualquier proveedor. Los modelos se guardan en disco; la inferencia usa tu procesador y, si tenés, tu placa de video.

## Qué modelos podés correr

- **Llama** (Meta): el más popular; versiones chicas corren en casi cualquier computadora moderna.
- **Mistral y Mixtral**: eficientes, buen español.
- **Qwen** (Alibaba): muy bueno en código y razonamiento para su tamaño.
- **DeepSeek** (versiones destiladas): razonamiento a bajo costo de hardware.
- **Gemma** (Google): compacto y correcto.
- **Modelos de código** (Codestral, Qwen Coder, variantes de Llama para código).

Tably propone por defecto una versión chica de Llama, que corre en una laptop común. Si tenés más hardware, subí de tamaño.

## Qué hardware necesitás

| Tamaño del modelo | Memoria recomendada | Experiencia |
|---|---|---|
| 3 a 8 mil millones de parámetros | 8 a 16 GB de RAM | Rápido en una laptop moderna; calidad de asistente básico |
| 14 a 32 mil millones | 24 a 32 GB (o GPU con 16+ GB) | Calidad seria para debate y revisión; más lento |
| 70 mil millones o más | 64 GB+ o GPU profesional | Cercano a un modelo mediano de API; lento sin GPU |

Las Mac con chip Apple Silicon rinden muy bien por la memoria unificada; en PC, una placa de video NVIDIA con mucha memoria marca la diferencia.

## Qué lo distingue

### Privacidad total

Nada sale de tu máquina. Para proyectos con datos sensibles, contratos con cláusulas de confidencialidad o simplemente para trabajar sin conexión, es la única opción con esa garantía.

### Costo cero por token

Podés correr el consejo cien veces sin que cambie la factura. Para aprender a usar Tably, para experimentar con prompts y para roles de apoyo, es ideal.

### Sin dependencia de terceros

Si un proveedor cambia precios o condiciones, tu modelo local sigue igual.

## Dónde conviene no usarlo

- **Construir una app completa**: los modelos locales, salvo que tengas hardware profesional, no están a la altura de Claude Code o de un modelo frontera por API para escribir decenas de archivos coherentes.
- **Razonamiento complejo**: un modelo de 8B no planifica una arquitectura como un Opus. Para el CTO de un proyecto serio, usá API.
- **Velocidad en consejos largos**: sin GPU, seis agentes con un modelo mediano pueden tardar bastante.
- **Visión**: hay modelos locales con visión, pero su descripción de capturas es más pobre que la de Gemini o GPT.

## Qué rol darle en tu equipo

- **QA de consistencia**: con un modelo mediano, correcto y gratis.
- **Resúmenes y clasificación**: sin problema.
- **Product en proyectos chicos**: aceptable con un modelo de 14B o más.
- **Experimentación de prompts**: perfecto. Afiná el prompt de cada rol en local y después pasalo a un modelo de API.
- **Equipos enteros de prueba**: para aprender la plataforma sin gastar.

## Cómo se conecta en Tably

Con Ollama corriendo en tu máquina, aparece como «Ollama (local)» en «Modelos y API keys». No hace falta clave. El selector muestra los modelos que tenés descargados. Si usás Tably en la nube, Ollama tiene que correr en el servidor de Tably o ser accesible desde él.

## Preguntas frecuentes

**¿Es gratis?** Sí: Ollama es de código abierto y los modelos abiertos no tienen costo de licencia para la mayoría de los usos (revisá la licencia de cada uno).

**¿Qué modelo local es el mejor para español?** Las versiones recientes de Llama, Qwen y Mistral rinden bien. Probá un par con el mismo prompt y compará.

**¿Puedo construir una app entera con un modelo local?** Con hardware profesional y un modelo grande, se puede para apps chicas. Para algo serio, usá un constructor de escritorio o un modelo de API, y reservá lo local para el consejo y la revisión.

## En resumen

Ollama te da privacidad total y costo cero a cambio de calidad y velocidad limitadas por tu hardware. Es ideal para aprender, experimentar y para roles de apoyo; para construir en serio, combinalo con un modelo de frontera.
