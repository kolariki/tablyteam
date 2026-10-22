---
title: Seguridad y privacidad en Tably Team: qué pasa con tus API keys, tu código y tus datos
description: Dónde se guardan tus claves, qué ve cada proveedor de IA, dónde vive tu código, qué datos salen de tu máquina, cómo funciona el token de suscripción y qué opciones tenés si necesitás que nada salga de tu infraestructura.
category: Costos y seguridad
date: 2026-10-22
tags: [seguridad, privacidad, API keys]
keywords: [seguridad API keys IA, privacidad datos inteligencia artificial, dónde se guarda mi código IA, token Claude seguridad, IA sin enviar datos]
---

Antes de pegar una API key en cualquier herramienta, conviene saber qué hace con ella. Esta guía explica cómo Tably Team maneja claves, código y datos, sin eufemismos.

## Tus API keys

- Se guardan **cifradas** en tu cuenta de Tably, en el servidor donde corre tu instancia. Nunca se escriben en el código de tus proyectos ni en los registros.
- Se usan **solo para tus pedidos**: cuando un rol de tu equipo o tu constructor llama al proveedor, lo hace con tu clave. Ningún otro usuario de la instancia las ve ni las usa.
- Podés **ver los últimos caracteres**, reemplazarlas y borrarlas en «Modelos y API keys». Borrar es inmediato.
- Si corrés Tably en tu propia máquina, las claves no salen de ella salvo hacia el proveedor correspondiente.

Recomendación: creá claves específicas para Tably en cada proveedor, con límite de gasto, para poder revocarlas sin afectar otras cosas.

## El token de suscripción de Claude

Para construir con tu suscripción de Claude en un servidor (por ejemplo, Tably desplegado en la nube), generás un token con `claude setup-token` y lo pegás en tu configuración.

- Queda **cifrado** en tu cuenta, como una API key.
- Se usa **solo para tus construcciones**, con un entorno de Claude Code aislado por usuario.
- Lo podés **revocar** desde Tably (borrarlo) y desde tu cuenta de Anthropic.

Es equivalente a iniciar sesión en Claude Code en otra computadora tuya.

## Qué ve cada proveedor de IA

Cuando un rol usa un modelo, el proveedor recibe lo que ese rol necesita: el brief, el contexto del debate, los archivos relevantes del proyecto, las descripciones de referencias. Es inevitable: el modelo tiene que leer para trabajar. Lo que cada proveedor hace con eso depende de **sus** políticas:

- Las APIs de pago de Anthropic, OpenAI, Google y la mayoría de los proveedores **no entrenan con tus datos** por defecto. Verificá los términos vigentes de cada uno.
- Algunos proveedores (DeepSeek, Moonshot) procesan en jurisdicciones distintas. Si importa, usá los mismos modelos vía OpenRouter eligiendo proveedores que no retienen datos, o corré modelos locales.
- Con **Ollama**, nada sale de tu máquina.

Tably te deja elegir el proveedor rol por rol justamente para que puedas tomar esa decisión por proyecto.

## Tu código

- Cada proyecto vive en **tu cuenta**, en un repositorio git propio.
- Lo podés descargar, clonar y subir a tu GitHub en cualquier momento.
- Ningún otro usuario de la instancia accede a tus proyectos.
- Si borrás un proyecto, se borran su repositorio, sus archivos y su historial.

## Apps de referencia

Cuando pasás URLs de referencia, Tably las visita con un navegador propio. Las capturas y las descripciones quedan dentro de tu proyecto. Con ingeniería inversa activada, los bundles y las respuestas públicas que se analizan también quedan ahí. Nada se comparte con otros usuarios.

## Las apps que publicás

- Cada app publicada tiene **sus propias variables de entorno y secretos**, cifrados, que ninguna otra app ve.
- Las credenciales de Neon, Supabase, Cloudflare o Fly que cargás para Tably Cloud quedan cifradas en tu cuenta y se usan solo para aprovisionar tus proyectos.
- Las claves de servicios de tu app (pagos, correo) se cargan como secretos del proyecto, nunca en el código.

## Si necesitás que nada salga

Tably se puede correr **íntegramente en tu infraestructura**: tu máquina o tu servidor, con tu base de datos. Con Ollama para los modelos y Claude Code o Codex por suscripción para construir, el flujo completo funciona sin cargar una sola API key de terceros. Hay una guía de despliegue (Docker y Railway) en el repositorio del proyecto.

## Lo que Tably no hace

- No lee tus proyectos para entrenar nada.
- No comparte tus claves, tokens o código con terceros, salvo el proveedor de IA que vos elegiste para cada llamada.
- No cobra tarifas ocultas por uso de IA: el costo que ves es el de los proveedores.

## Buenas prácticas

1. Claves por servicio con límite de gasto.
2. Un proveedor por proyecto según la sensibilidad de los datos.
3. Revisar los secretos del proyecto antes de publicar.
4. Borrar el token de suscripción de los servidores que ya no uses.

## En resumen

Tus claves quedan cifradas y se usan solo para vos; tu código es tuyo y portable; lo que ve cada proveedor de IA lo decidís rol por rol; y si hace falta, todo puede correr en tu infraestructura.
