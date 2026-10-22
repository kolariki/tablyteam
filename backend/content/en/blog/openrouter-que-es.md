---
title: OpenRouter: a single API key for more than 300 models
description: What OpenRouter is, how it works, which models it unlocks (Qwen, Llama, DeepSeek, Claude, GPT and hundreds more), what it costs and how to make the most of it on an AI team without entering ten different keys.
category: AI models
date: 2026-10-22
tags: [OpenRouter, AI models, API]
keywords: [OpenRouter, what is OpenRouter, Qwen, one API for all models, compare AI models]
provider: openrouter
---

**OpenRouter** is not an AI lab: it is a **router**. With a single API key you get access to hundreds of models from dozens of providers, with a unified format and a single bill. In Tably Team it is the fastest way to try models that do not have a direct integration, or to fill an entire team without entering ten keys.

## What it offers

- **Catalog**: more than 300 models, from the premium ones (Claude, GPT, Gemini) to open models from Chinese and European labs (Qwen, DeepSeek, Kimi, Mistral, Llama) and specialized models.
- **One format**: they all respond with the same schema, so Tably treats them the same way.
- **Per-model pricing**: you pay what each provider charges plus a small margin; many open models have free variants with limits.
- **Routing**: for the same open model, you can prefer the cheapest provider, the fastest one or the one that does not retain data.

## Qwen, the default model in Tably

When you choose OpenRouter, Tably proposes a large open-weight **Qwen** model from Alibaba, with a very good quality/price ratio and solid performance on code and reasoning. It is a good first model to try, and afterwards you can swap it for any other in the catalog from the selector.

## What it is good for on an AI team

### Try before committing

Want to know whether Qwen performs as CTO, whether a small model is enough for QA, whether it is worth paying for a premium model for Product? With OpenRouter you assemble six different teams in ten minutes, without signing up with six providers.

### Models without a direct integration

Any model that is not on Tably's list of providers is almost certainly on OpenRouter.

### Redundancy

If a provider is down or has high latency, OpenRouter can route to the same model on other infrastructure.

### Control over your data

You can choose providers that do not retain prompts or use them for training. It is a setting on your OpenRouter account that Tably respects.

## Where not to use it

- **Desktop builders**: Claude Code and Codex run on a subscription, outside OpenRouter.
- **When you already have the direct key**: for Claude or GPT, the direct API is usually marginally cheaper and has fewer intermediaries.
- **Minimum latency**: the extra hop costs a few milliseconds; for most uses it is irrelevant.

## What role to give it

Any. The beauty of it is that you can put a different model in each seat and compare. Combinations we liked:

- **CTO with Qwen** and **CEO with GPT**: solid technical debate at low cost.
- **QA with a small free model** for consistency reviews.
- **API builder with DeepSeek via OpenRouter** when you do not want to use the official Chinese API.

## How to connect it in Tably

Enter your **OpenRouter API key** under "Models and API keys". The model selector loads the catalog and you can search by name.

## Costs

They depend on the model. OpenRouter shows the price of each one; Tably estimates the cost of the council before starting and records the actual cost when it finishes.

## Frequently asked questions

**Is it more expensive than going direct?** A little, because of the router's margin. For experimenting, the convenience makes up for it; for production with a single provider, the direct API is more efficient.

**Can I use Claude through OpenRouter?** Yes, but if you are going to use Claude regularly, enter the Anthropic key directly.

**What is Qwen?** Alibaba's family of open models. They are among the best open models available, especially on code and in Asian languages, and they perform very well in Spanish.

## In summary

OpenRouter is the test lab: one key, every model, a different team per experiment. When you find the winning combination, enter the direct keys of the providers you chose.
