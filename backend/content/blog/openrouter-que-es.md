---
title: OpenRouter: una sola API key para más de 300 modelos
description: Qué es OpenRouter, cómo funciona, qué modelos abre (Qwen, Llama, DeepSeek, Claude, GPT y cientos más), qué cuesta y cómo aprovecharlo en un equipo de IA sin cargar diez claves distintas.
date: 2026-10-22
tags: [OpenRouter, modelos de IA, API]
keywords: [OpenRouter, qué es OpenRouter, Qwen, una API para todos los modelos, comparar modelos de IA]
provider: openrouter
---

**OpenRouter** no es un laboratorio de IA: es un **enrutador**. Con una sola API key accedés a cientos de modelos de decenas de proveedores, con un formato unificado y una factura única. En Tably Team es la forma más rápida de probar modelos que no tienen una integración directa, o de llenar un equipo entero sin cargar diez claves.

## Qué ofrece

- **Catálogo**: más de 300 modelos, desde los premium (Claude, GPT, Gemini) hasta modelos abiertos de laboratorios chinos y europeos (Qwen, DeepSeek, Kimi, Mistral, Llama) y modelos especializados.
- **Un formato**: todos responden con el mismo esquema, así que Tably los trata igual.
- **Precios por modelo**: pagás lo que cobra cada proveedor más un margen chico; muchos modelos abiertos tienen variantes gratuitas con límites.
- **Enrutamiento**: para un mismo modelo abierto, podés preferir el proveedor más barato, el más rápido o el que no retiene datos.

## Qwen, el modelo por defecto en Tably

Cuando elegís OpenRouter, Tably propone un modelo **Qwen** grande de Alibaba, de pesos abiertos, con muy buena relación calidad/precio y rendimiento sólido en código y razonamiento. Es un buen primer modelo para probar, y después podés cambiarlo por cualquier otro del catálogo desde el selector.

## Para qué sirve en un equipo de IA

### Probar antes de comprometerse

¿Querés saber si Qwen rinde como CTO, si un modelo chico alcanza para QA, si vale la pena pagar un premium para Product? Con OpenRouter armás seis equipos distintos en diez minutos, sin registrarte en seis proveedores.

### Modelos sin integración directa

Cualquier modelo que no esté en la lista de proveedores de Tably está casi seguro en OpenRouter.

### Redundancia

Si un proveedor está caído o con latencia alta, OpenRouter puede enrutar al mismo modelo en otra infraestructura.

### Control sobre los datos

Podés elegir proveedores que no retienen prompts ni los usan para entrenar. Es un ajuste de tu cuenta de OpenRouter que Tably respeta.

## Dónde conviene no usarlo

- **Constructores de escritorio**: Claude Code y Codex corren con suscripción, fuera de OpenRouter.
- **Cuando ya tenés la clave directa**: para Claude o GPT, la API directa suele ser marginalmente más barata y tiene menos intermediarios.
- **Latencia mínima**: el salto extra cuesta algunos milisegundos; para la mayoría de los usos es irrelevante.

## Qué rol darle

Cualquiera. La gracia es que podés poner un modelo distinto en cada silla y comparar. Combinaciones que nos gustaron:

- **CTO con Qwen** y **CEO con GPT**: debate técnico sólido a bajo costo.
- **QA con un modelo chico gratuito** para revisiones de consistencia.
- **Constructor por API con DeepSeek vía OpenRouter** cuando no querés usar la API oficial china.

## Cómo se conecta en Tably

Cargá tu **API key de OpenRouter** en «Modelos y API keys». El selector de modelos carga el catálogo y podés buscar por nombre.

## Costos

Dependen del modelo. OpenRouter muestra el precio de cada uno; Tably estima el costo del consejo antes de arrancar y registra el costo real al terminar.

## Preguntas frecuentes

**¿Es más caro que ir directo?** Un poco, por el margen del enrutador. Para experimentar, la comodidad lo compensa; para producción con un solo proveedor, la API directa es más eficiente.

**¿Puedo usar Claude a través de OpenRouter?** Sí, pero si vas a usar Claude seguido, cargá la clave de Anthropic directamente.

**¿Qué es Qwen?** La familia de modelos abiertos de Alibaba. Son de los mejores modelos abiertos disponibles, especialmente en código y en idiomas asiáticos, y rinden muy bien en español.

## En resumen

OpenRouter es el laboratorio de pruebas: una clave, todos los modelos, un equipo distinto por experimento. Cuando encuentres la combinación ganadora, cargá las claves directas de los proveedores que elegiste.
