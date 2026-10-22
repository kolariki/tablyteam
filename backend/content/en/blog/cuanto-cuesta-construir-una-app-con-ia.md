---
title: How much it costs to build an app with AI: tokens, subscriptions and what actually drives the bill
description: An honest breakdown of the cost of building an app with an AI team: what providers charge, what a council debate costs, how to build without spending tokens using a subscription, and how Tably shows the real cost.
category: Costs and security
date: 2026-10-22
tags: [costs, tokens, subscription, practical guide]
keywords: [how much does it cost to build an app with AI, AI token cost, price of building an app with artificial intelligence, Claude GPT API cost, free app generator]
---

"How much is this going to cost me?" is a legitimate question that most tools dodge. Here is the full answer: what you pay, to whom, how much, and how to bring it down.

## Who you pay

Tably Team does not resell tokens. You pay for the models **directly to each provider** with your API key (Anthropic, OpenAI, Google, DeepSeek, xAI, Groq, Moonshot, Mistral, OpenRouter) or with your **subscription** (Claude Code with Claude, Codex with ChatGPT). Tably shows an estimate before you start and the real cost when you finish, calculated at each provider's list price.

## The three components of the cost

### 1. The council (the team debate)

Six agents, several turns each, every turn carrying the context of the previous debate. It is the most variable component, because it depends on:

- **The models**: a council with Claude Opus and full GPT costs tens of times more than one with DeepSeek, Kimi and Llama on Groq.
- **The number of turns**: the debate mode and the round settings determine it.
- **The size of the context**: attached documents, researched references, long briefs.

Typical orders of magnitude for a full debate:

| Team | Typical council cost |
|---|---|
| All premium (Opus, full GPT, Gemini Pro) | A few dollars |
| Mixed (one premium model in leadership, the rest budget) | Under a dollar |
| All budget (DeepSeek, Kimi, Llama, Flash) | Cents |
| Local (Ollama) | Zero |

### 2. The build (the code)

It is the component that weighs most if you pay via API, and the one that can be **zero** if you use a subscription:

- **Claude Code or Codex via subscription**: spends no tokens. It consumes part of your plan's usage limit.
- **Via API**: a medium-sized app costs between cents (DeepSeek, Kimi, Mistral) and a few dollars (Opus, full GPT). Each round of changes adds up.

### 3. The extras

- **Reference research**: the vision model's tokens, a few cents.
- **Prompt engineering and brief**: a couple of calls, cents.
- **Publishing**: Tably does not charge for publishing on its own instance; Cloudflare, Fly, Neon and Supabase have free plans and charge for usage above them.

## How to lower the cost without lowering quality

1. **Build via subscription.** It is the biggest lever: the code is the most expensive part via API and it is free with Claude Code.
2. **Premium only where decisions are made.** A Claude or GPT as CTO and CEO, budget models everywhere else. The debate does not lose quality and the cost drops a lot.
3. **Use the Direct builder for small things.** No council, no debate tokens.
4. **Learn with Groq or Ollama.** Experiment with the platform for free and spend when the project is real.
5. **Ask for changes in batches.** Ten changes in one request cost less than ten requests of one change each.

## What Tably shows you

- **Before you start**: an estimate per agent, with a note on the assumptions it uses.
- **During**: accumulated tokens and cost in the status bar, with a timer per turn and a total.
- **When it finishes**: the real cost of the council and the build; in the Direct builder, additionally, the card with the estimated savings compared to the team route.
- **On the home screen**: the month's API spend and the total, adding up all projects. Subscription builds do not count toward it.

## Compared with the alternatives

- **A human team**: a small app, several thousand dollars and weeks. Tably: minutes or hours, and the cost of the tokens.
- **Credit-based app generators**: you pay the provider's credits at their price, without knowing which model runs behind the scenes. Tably: your key, your model, list price.
- **A single model in a chat**: cheaper per attempt, but more attempts. The debate beforehand avoids building the wrong thing.

## Frequently asked questions

**Is Tably free?** The platform can be used with your own keys and subscriptions. The only costs are what the AI and infrastructure providers charge you.

**How much does a typical app cost?** With a subscription and a mixed council, under a dollar in tokens. Everything via API with premium models, a few dollars. Without a subscription or an API, with Ollama, zero.

**Can I set a limit?** Your providers let you set spending limits in their dashboards. Tably shows the accumulated spend so it does not take you by surprise.

## In summary

Build via subscription, put premium models only in the seats that make decisions, and use the Direct builder for small things. With that, a complete app costs cents or nothing in tokens, and what you see in Tably is the real cost, not a marketing estimate.
