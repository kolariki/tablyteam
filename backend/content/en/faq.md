---
title: Frequently asked questions
---

## What is Tably Team?

Tably Team is a platform for building applications with a **team of AI models with roles**: CEO, CTO, Head of Engineering, Product, Design and QA. You describe your idea, the team debates it, studies reference apps, designs the screens, writes the code and reviews it. You approve each step and the app is ready to run, download or publish.

## How is it different from a chat with ChatGPT or Claude?

In a chat, a single model guesses what you want and spits out code. In Tably, several models with different roles **discuss and decide before building**: scope, stack, architecture, flows. The decisions are written down, the design is approved before the code, and every version is reviewed. You can also put a different AI in each role, which a chat does not allow.

## Is it free?

The platform is used with your own API keys and subscriptions. Tably does not resell tokens or charge per build: the only costs are those of the AI providers (at list price) and, if you publish with external services, those of the services. With a Claude subscription and Claude Code as the builder, building spends no API tokens.

## How much does it cost to build an app?

It depends on the models you choose. A council with budget models costs cents; with premium models, a few dollars. Building via subscription (Claude Code or Codex) spends no tokens; via API, between cents and a few dollars depending on the model. Tably shows an estimate before you start and the real cost when you finish.

## Which AI models can I use?

Claude (Anthropic), GPT (OpenAI), Gemini (Google), DeepSeek, Grok (xAI), Llama (via Groq), Kimi (Moonshot AI), Mistral, any of the more than 300 models on OpenRouter, and local models with Ollama. Each role on the team can use a different provider and model.

## Which AI is best for each role?

Our favorite combination: GPT as CEO, Claude as CTO, Gemini Pro in engineering, Claude Sonnet in product and design, Claude Haiku or DeepSeek in QA, and Claude Code as the builder. For tight budgets: GPT mini, DeepSeek, Kimi, Gemini Flash and Llama on Groq. There is a complete guide by role on the blog.

## Who writes the code?

The **builder**, which can be Claude Code (with your Claude subscription), Codex CLI (with your ChatGPT account) or any model via API with your key. Claude Code is the one that best finishes complete projects without intervention and is our default when it is available.

## Can I use my Claude subscription instead of an API key?

Yes. If Claude Code is installed and signed in on the machine where Tably runs, it appears as a desktop builder. If you use Tably in the cloud, you generate a token with `claude setup-token`, paste it into your settings, and the server builds with your subscription even when your computer is off.

## What is the Direct builder?

The fast route: your request goes through prompt engineering, becomes a complete brief, and the builder starts immediately, with no team debate. It is the fastest and the cheapest. The team stays one click away to audit the result afterward.

## What is the Builder with a development team?

The full route: the team researches the references, debates your idea in turns, leaves justified decisions, produces the brief, designs the screens you approve, and only then builds. Every version is reviewed and you can request changes.

## Can I build mobile apps?

Yes. You choose web, mobile (iOS and Android with Expo) or both from a single codebase. Mobile apps run from Tably in the iOS simulator or the Android emulator, with the device screen live, if those tools are installed where Tably runs.

## What are reference apps?

URLs of apps you like. Tably visits them with a real browser, takes screenshots, describes them with a vision model and assembles a research document that the designer and the builder read. With "Deep analysis and reverse engineering", it also analyzes their bundles, routes and APIs to replicate them faithfully (requires REA installed and a desktop builder). There is no additional cost: it runs on your subscription or your API key.

## Where does my code live?

In your account, in its own git repository per project. You can download it as a zip, clone it, push it to your GitHub with one click and compare versions. It is yours and it is portable.

## How do I publish the app?

From the builder's Cloud panel: on the Tably instance itself with one click, or on Cloudflare or Fly with your accounts. Tably Cloud also provisions a database and authentication with Neon or Supabase and generates migration kits when the data model changes.

## What happens with my API keys?

They are stored encrypted in your account, used only for your requests, and you can view them (last characters), replace them and delete them whenever you want. They are never written into your projects' code. We recommend creating keys specifically for Tably with a spending limit.

## Is my data used to train models?

Tably does not train anything with your data. What each AI provider does with what it receives depends on its policies; the paid APIs of the major providers do not train on your data by default. If nothing can leave your infrastructure, you can use local models with Ollama and run Tably on your own server.

## Can I run Tably on my own machine or server?

Yes. There is a Docker image and a guide for deploying it on Railway or on any server. Each user connects their own keys and subscriptions.

## Can I use it from my phone?

Yes, with Tably deployed on a server. The builds run there; with the Claude subscription token loaded, you build with your plan even when your computer is off.

## What happens if a build fails or gets interrupted?

The state is saved. You can resume it from where it left off, change the builder or the model, and try again. Desktop agents fix compilation errors on their own during the build.

## Can I request changes afterward?

Yes. You request changes to the design or the code, the builder applies them, and the council reviews the new version. You can also call in the team to audit a direct build.

## Can I save my team configuration?

Yes. An experiment saves the theme, mode, team (provider, model, prompt and skills for each role) and debate settings, so you can reuse it with other ideas and compare results.

## What are skills?

Packages of specific knowledge (pitch, MVP scope, stack review, costs, architecture, CI/CD, among others) that are added to a role's context so it works with sharper judgment. They are chosen per role from the team editor.

## Which languages does it work in?

The interface is in Spanish and English. The team can work in Rioplatense Spanish, neutral Spanish, English or other languages you choose for the project; the models handle it without trouble.

## Is Tably for people without a technical background?

Yes. You describe the problem in your own words, the team decides the technical part and explains it to you, and you approve the design before any code exists. If you are technical, you can set the stack, edit the brief and review every file.
