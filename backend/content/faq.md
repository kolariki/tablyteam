---
title: Preguntas frecuentes
---

## ¿Qué es Tably Team?

Tably Team es una plataforma para construir aplicaciones con un **equipo de inteligencias artificiales con roles**: CEO, CTO, Head of Engineering, Product, Diseño y QA. Describís tu idea, el equipo la debate, estudia apps de referencia, diseña las pantallas, escribe el código y lo revisa. Vos aprobás cada paso y la app queda lista para correr, descargar o publicar.

## ¿En qué se diferencia de un chat con ChatGPT o Claude?

En un chat, un solo modelo adivina qué querés y escupe código. En Tably, varios modelos con roles distintos **discuten y deciden antes de construir**: alcance, stack, arquitectura, flujos. Las decisiones quedan escritas, el diseño se aprueba antes del código y cada versión se revisa. Además podés poner una IA distinta en cada rol, cosa que un chat no permite.

## ¿Es gratis?

La plataforma se usa con tus propias claves de API y tus suscripciones. Tably no revende tokens ni cobra por construcción: los únicos costos son los de los proveedores de IA (a precio de lista) y, si publicás con servicios externos, los de esos servicios. Con una suscripción de Claude y Claude Code como constructor, construir no gasta tokens de API.

## ¿Cuánto cuesta construir una app?

Depende de los modelos que elijas. Un consejo con modelos económicos cuesta centavos; con modelos premium, algunos dólares. La construcción por suscripción (Claude Code o Codex) no gasta tokens; por API, entre centavos y algunos dólares según el modelo. Tably muestra una estimación antes de arrancar y el costo real al terminar.

## ¿Qué modelos de IA puedo usar?

Claude (Anthropic), GPT (OpenAI), Gemini (Google), DeepSeek, Grok (xAI), Llama (vía Groq), Kimi (Moonshot AI), Mistral, cualquiera de los más de 300 modelos de OpenRouter y modelos locales con Ollama. Cada rol del equipo puede usar un proveedor y un modelo distinto.

## ¿Qué IA conviene para cada rol?

Nuestra combinación favorita: GPT como CEO, Claude como CTO, Gemini Pro en ingeniería, Claude Sonnet en producto y diseño, Claude Haiku o DeepSeek en QA, y Claude Code como constructor. Para presupuestos ajustados: GPT mini, DeepSeek, Kimi, Gemini Flash y Llama en Groq. Hay una guía completa por rol en el blog.

## ¿Quién escribe el código?

El **constructor**, que puede ser Claude Code (con tu suscripción de Claude), Codex CLI (con tu cuenta de ChatGPT) o cualquier modelo por API con tu clave. Claude Code es el que mejor termina proyectos completos sin intervención y es nuestro default cuando está disponible.

## ¿Puedo usar mi suscripción de Claude en vez de una API key?

Sí. Si Claude Code está instalado y con sesión iniciada en la máquina donde corre Tably, aparece como constructor de escritorio. Si usás Tably en la nube, generás un token con `claude setup-token`, lo pegás en tu configuración y el servidor construye con tu suscripción aunque tu computadora esté apagada.

## ¿Qué es el constructor directo?

La vía rápida: tu pedido pasa por prompt engineering, se convierte en un brief completo y el constructor arranca de inmediato, sin debate del equipo. Es lo más rápido y lo más barato. El equipo queda a un clic para auditar el resultado después.

## ¿Qué es el constructor con equipo de desarrollo?

La vía completa: el equipo investiga las referencias, debate tu idea en turnos, deja decisiones justificadas, produce el brief, diseña las pantallas que aprobás y recién entonces construye. Cada versión se revisa y podés pedir cambios.

## ¿Puedo construir apps móviles?

Sí. Elegís web, móvil (iOS y Android con Expo) o ambas con un solo código. Las apps móviles se corren desde Tably en el simulador de iOS o el emulador de Android, con la pantalla del dispositivo en vivo, si esas herramientas están instaladas donde corre Tably.

## ¿Qué son las apps de referencia?

URLs de apps que te gustan. Tably las visita con un navegador real, saca capturas, las describe con un modelo con visión y arma un documento de investigación que leen el diseñador y el constructor. Con «análisis profundo e ingeniería inversa», además analiza sus bundles, rutas y APIs para replicarlas con fidelidad (requiere REA instalado y un constructor de escritorio). No tiene costo adicional: corre con tu suscripción o tu API key.

## ¿Dónde queda mi código?

En tu cuenta, en un repositorio git propio por proyecto. Lo podés descargar como zip, clonar, subir a tu GitHub con un clic y comparar versiones. Es tuyo y es portable.

## ¿Cómo publico la app?

Desde el panel Cloud del constructor: en la propia instancia de Tably con un clic, o en Cloudflare o Fly con tus cuentas. Tably Cloud también aprovisiona base de datos y autenticación con Neon o Supabase y genera kits de migración cuando cambia el modelo de datos.

## ¿Qué pasa con mis API keys?

Quedan cifradas en tu cuenta, se usan solo para tus pedidos y las podés ver (últimos caracteres), reemplazar y borrar cuando quieras. Nunca se escriben en el código de tus proyectos. Recomendamos crear claves específicas para Tably con límite de gasto.

## ¿Mis datos se usan para entrenar modelos?

Tably no entrena nada con tus datos. Lo que cada proveedor de IA hace con lo que recibe depende de sus políticas; las APIs de pago de los grandes proveedores no entrenan con tus datos por defecto. Si necesitás que nada salga de tu infraestructura, podés usar modelos locales con Ollama y correr Tably en tu propio servidor.

## ¿Puedo correr Tably en mi propia máquina o servidor?

Sí. Hay una imagen Docker y una guía para desplegarlo en Railway o en cualquier servidor. Cada usuario conecta sus propias claves y suscripciones.

## ¿Puedo usarlo desde el teléfono?

Sí, con Tably desplegado en un servidor. Las construcciones corren ahí; con el token de suscripción de Claude cargado, construís con tu plan aunque tu computadora esté apagada.

## ¿Qué pasa si una construcción falla o se corta?

El estado queda guardado. Podés reanudarla desde donde quedó, cambiar el constructor o el modelo y volver a intentar. Los agentes de escritorio corrigen por sí mismos los errores de compilación durante la construcción.

## ¿Puedo pedir cambios después?

Sí. Pedís cambios en el diseño o en el código, el constructor los aplica y el consejo revisa la nueva versión. También podés convocar al equipo para auditar una construcción directa.

## ¿Puedo guardar mi configuración de equipo?

Sí. Un experimento guarda tema, modo, equipo (proveedor, modelo, prompt y skills de cada rol) y ajustes del debate, para reutilizarlo con otras ideas y comparar resultados.

## ¿Qué son las skills?

Paquetes de conocimiento específico (pitch, alcance de MVP, revisión de stack, costos, arquitectura, CI/CD, entre otros) que se agregan al contexto de un rol para que trabaje con un criterio más preciso. Se eligen por rol desde el editor del equipo.

## ¿En qué idiomas funciona?

La interfaz está en español e inglés. El equipo puede trabajar en español rioplatense, español neutro, inglés u otros idiomas que elijas para el proyecto; los modelos lo manejan sin problema.

## ¿Tably es para personas sin perfil técnico?

Sí. Describís el problema en tus palabras, el equipo decide la parte técnica y te la explica, y aprobás el diseño antes de que exista código. Si sos técnico, podés fijar el stack, editar el brief y revisar cada archivo.
