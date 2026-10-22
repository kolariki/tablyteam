---
title: "DeepSeek: what it is for, why it is so cheap and which role to give it on your team"
description: A guide to the DeepSeek models. Their quality-to-price ratio, their direct style in debate, their performance in code and math, and the roles on an AI team where they are the right choice.
category: AI models
date: 2026-10-22
tags: [DeepSeek, AI models, costs]
keywords: [DeepSeek, DeepSeek chat, DeepSeek for coding, cheap AI, open model, what is DeepSeek used for]
provider: deepseek
---

**DeepSeek** is a Chinese lab that shook up the market by releasing frontier-level models with open weights and API prices far below the major players. For a team of agents, that changes an important equation: you can give a very capable model to roles where you used to put a small one because of cost.

## The models

DeepSeek releases a general-purpose model ("chat") and reasoning-oriented variants, with frequent updates. In Tably, the default model for DeepSeek is the chat one, which handles most council roles competently.

## What sets it apart

### Price

It is the most obvious trait and the one that matters most in a council of six agents over several turns: **a full debate with DeepSeek costs a fraction of what it costs with the premium models**. That lets you run more rounds, more reviews and more experiments without thinking about the bill.

### Code and mathematical reasoning

DeepSeek trains with a strong emphasis on code and math. For a Head of Engineering who has to propose a data model, estimate complexity or review an algorithm, it performs very well.

### It is direct in debate

In the Tably council, a "DeepSeek" CTO is usually the one who says things bluntly: "that architecture does not scale," "that cannot be done in the timeframe." That candor improves the debate when the CEO is a more conciliatory model.

### Open weights

The models are released with open weights, which means you can also run them on your own infrastructure or through alternative providers (OpenRouter offers them). For anyone who needs control over where their data runs, that is an advantage.

## Where you should not use it

- **Nuanced writing in Rioplatense Spanish**: its style is flatter than Claude's or GPT's. For a brief a client is going to read, run the text through another model.
- **Design**: its visual judgment is sound but less refined; we prefer Claude or GPT for the design system.
- **Tasks with images**: to describe reference screenshots, use a model with vision (Gemini, GPT, Claude).
- **Latency**: the API can have spikes in delay during peak demand. Tably tolerates it (retries and continues), but if you want a fast council, Groq or Gemini Flash respond sooner.

## Which role to give it on your team

- **CTO**: excellent. Technical, direct, cheap.
- **Head of Engineering**: very good, especially for the data model and the build plan.
- **QA**: it finds inconsistencies with a sharp eye and costs little.
- **Product**: solid; better when paired with a CEO with more of an instinct for synthesis.
- **Builder via API**: it works for small and medium projects. For long builds we prefer a desktop agent.

## How it connects in Tably

Add your **DeepSeek API key** in "Models and API keys". Tably uses its endpoint compatible with the standard format, so it is available for any role.

## Costs

Among the lowest on the market per token, for both input and output. It is the natural option to "fill" the council's secondary roles with a capable model without driving up the cost, and for entire teams when you are experimenting.

## Frequently asked questions

**Is it reliable for a professional project?** Yes for the council and for review. For the final code, measure it against Claude Code in your own case and decide with data.

**Does my data go to China?** If you use the official API, yes, DeepSeek processes it. If that is a problem, you can use the same models through another provider (OpenRouter lets you choose) or run them locally with Ollama.

**Does it work as the team's only model?** It works, but you lose the contrast between styles. Combine it with a GPT or Claude CEO and you will have a much richer debate.

## In short

DeepSeek is the model that lets you be generous with the team: give it the technical and review seats, run more rounds, and spend the premium budget only where it truly changes the result.
