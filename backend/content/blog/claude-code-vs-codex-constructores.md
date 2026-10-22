---
title: Claude Code vs Codex vs API: quién escribe el código de tu app y cuánto cuesta
description: Los tres tipos de constructor de Tably Team comparados: Claude Code y Codex por suscripción, o un modelo por API con tu clave. Diferencias de calidad, costo, velocidad y cómo usar tu suscripción desde el teléfono con la computadora apagada.
date: 2026-10-22
tags: [Claude Code, Codex, constructor, costos]
keywords: [Claude Code vs Codex, agente de programación, construir app con suscripción Claude, Codex CLI, costo de construir app con IA]
---

En Tably Team, el **constructor** es el agente que escribe el código. Es la decisión que más pesa en el resultado y en la factura. Hay tres tipos, y conviene entender bien las diferencias.

## Los tres tipos

### Claude Code (escritorio)

El agente de programación de Anthropic. Es un programa que opera sobre el proyecto: lee y escribe archivos, corre comandos, ejecuta pruebas, lee los errores y corrige. Corre con **tu suscripción de Claude**, así que no gasta tokens de API.

En Tably aparece como «Claude Code · escritorio» cuando está instalado y con sesión iniciada en la máquina donde corre Tably. Con el modelo en «default», usa Opus, el más capaz de la familia.

### Codex CLI (escritorio)

El agente de programación de OpenAI. Mismo concepto: opera sobre el proyecto con **tu cuenta de ChatGPT**, sin tokens de API. Aparece como «Codex CLI · escritorio» cuando está instalado y autenticado.

### Por API

Cualquier modelo configurado con tu clave (Claude, GPT, Gemini, DeepSeek, Kimi, Mistral, Qwen vía OpenRouter…). Tably le pasa el brief, el diseño y los archivos, y el modelo responde con los archivos completos. **Se cobran los tokens al proveedor**, no a Tably.

## Comparación

| | Claude Code | Codex CLI | Por API |
|---|---|---|---|
| Costo | Suscripción; cero tokens | Suscripción; cero tokens | Tokens al proveedor |
| Opera sobre el repositorio | Sí (lee, edita, corre, prueba) | Sí | No: recibe contexto y devuelve archivos |
| Construcciones largas (muchos archivos y etapas) | Excelente | Buena | Depende del modelo; más riesgo de perder el hilo |
| Corrige errores de compilación por sí mismo | Sí | Sí | Solo en la revisión siguiente |
| Ingeniería inversa de referencias (REA) | Sí | Sí | No |
| Funciona en Tably en la nube con la computadora apagada | Sí, con token de configuración | Requiere sesión en el servidor | Sí |
| Mejor para | Apps completas, iteración larga | Alternativa de escritorio | Proyectos chicos y medianos, pruebas |

## Qué observamos en la práctica

- **Claude Code termina más proyectos sin intervención.** Cuando una compilación falla, lee el error y lo arregla; cuando un archivo depende de otro, lo lee antes de escribir. Por eso es nuestro default.
- **Codex es una alternativa sólida.** En proyectos donde los dos agentes están disponibles, vale la pena construir el mismo brief con ambos y comparar: hay casos (sobre todo con stacks de Python o con mucha lógica de negocio) donde Codex rinde igual o mejor.
- **Por API funciona bien hasta cierto tamaño.** Para una app de diez o quince archivos, un modelo frontera por API entrega un resultado correcto. A partir de ahí, el agente de escritorio marca la diferencia porque mantiene el estado del proyecto entre turnos y lo verifica.

## Costos reales

- **Suscripción**: pagás tu plan de Claude o de ChatGPT, y Tably no suma nada por construcción. Una app mediana consume una parte del límite de uso de tu plan; los planes más altos permiten construir varias por día.
- **Por API**: una app mediana suele costar entre algunos centavos y algunos dólares según el modelo. Opus y GPT completo en el rango alto; DeepSeek, Kimi, Mistral y Qwen en el rango bajo. Tably muestra el costo real al terminar y lo suma en el panel de gasto.

## Construir desde el teléfono con la computadora apagada

Si usás Tably en la nube (por ejemplo, desplegado en Railway), la construcción corre en el servidor. Para que use **tu suscripción de Claude**:

1. En tu computadora, con Claude Code instalado, corré `claude setup-token`.
2. Pegá el token en «Modelos y API keys» de Tably, en la sección de suscripción.
3. Desde ese momento el servidor construye con tu suscripción, aunque tu computadora esté apagada. El token queda cifrado en tu cuenta y solo se usa para tus construcciones.

## Cómo elegir el constructor en Tably

- En el **constructor directo**, la sección «Constructor» del formulario lista los agentes de escritorio disponibles y la opción por API con su proveedor y modelo. La elección se recuerda.
- En el **constructor con equipo**, el constructor se elige en el veredicto del consejo, antes de arrancar, y se puede cambiar en cada ronda de revisión.

## Preguntas frecuentes

**¿Puedo tener Claude Code y Codex a la vez?** Sí. Elegís por proyecto.

**¿El código es mío?** Sí. Cada construcción tiene su repositorio git, se descarga como zip y se puede subir a tu GitHub.

**¿Qué pasa si se corta la construcción?** El estado queda guardado; podés reanudarla desde donde quedó.

## En resumen

Si tenés una suscripción de Claude, construí con Claude Code: es la combinación que mejor funciona y no gasta API. Si tenés ChatGPT, probá Codex. Usá la API para proyectos chicos, pruebas y comparaciones de modelos.
