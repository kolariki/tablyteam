---
title: "Claude (Anthropic): what it is for, which models exist (Fable, Opus, Sonnet, Haiku) and which role it fills best"
description: A complete guide to Claude, Anthropic's family of models. Fable, Opus, Sonnet and Haiku, their reasoning style, where they shine at writing code and designing products, and which roles on your team you should give them.
category: AI models
date: 2026-10-22
tags: [Claude, Anthropic, AI models]
keywords: [Claude Anthropic, Claude Fable, Claude Opus, Claude Sonnet, Claude Haiku, Claude Code, what is Claude used for, best AI for coding]
provider: anthropic
---

Claude is the family of language models from **Anthropic**. Today, it is the model we use most inside Tably Team when the job is writing code, drafting a precise brief or designing a product with good judgment. This guide explains what sets it apart, how to choose among its variants and which seats on the team it should occupy.

## The variants: Fable, Opus, Sonnet and Haiku

Anthropic releases each generation in several sizes. The logic is always the same: more capability costs more and takes longer.

| Model | What it is for | When to choose it in Tably |
|---|---|---|
| **Claude Fable** | The highest tier in the family, above Opus: deep reasoning, long and difficult tasks | Builder and CTO on large projects, when your account has access |
| **Claude Opus** | The most capable: long reasoning, multi-step tasks, complex code, architecture | Builder (via Claude Code), CTO, Head of Engineering |
| **Claude Sonnet** | A balance of quality, speed and cost | Product, Design, CEO; the Direct builder's brief |
| **Claude Haiku** | Fast and cheap, excellent for narrowly scoped tasks | Consistency QA, summaries, classification, screenshot descriptions |

In Tably, when you leave the model on "default" with Claude Code as the builder, the engine runs on Opus, which is the one that best sustains a build of many turns without losing the thread. If your account has access to Fable, it appears in the model selector (Tably reads the list live from your API key) and you can choose it for any role or as the builder.

### Fable, the step above Opus

Fable is Anthropic's most intelligent model available to the public, part of the same generation as Opus and Sonnet but with more reasoning capacity on long problems. For Tably, it makes sense in two places: as the **builder** on large projects, where each turn coordinates dozens of files, and as **CTO** when the architecture is the decision you do not want to redo. For the remaining roles, Opus and Sonnet perform just as well at a lower cost.

Two practical notes: access depends on your Anthropic account (not every account has it enabled), and its cost per token is the highest in the family, so Tably treats it as the premium tier in its estimates.

## What sets it apart

### It follows long instructions without falling apart

A Tably brief can have forty points: screens, data, business rules, acceptance criteria, stack constraints. Claude is remarkably good at **honoring all of them at once** and at flagging when two of them contradict each other, instead of silently picking one.

### It writes code you can read

Claude's code tends to be well structured, with clear names and few surprises. For a builder that delivers dozens of files, that is worth more than a clever solution nobody understands afterwards.

### It works on complete repositories

**Claude Code**, Anthropic's coding agent, is a program that runs on your machine (or on Tably's server) and operates directly on the project: it reads files, edits them, runs commands, executes tests. It is the default desktop builder in Tably and works with your subscription, without spending API tokens.

### It is careful with what it does not know

Faced with an ambiguous requirement, Claude asks or writes the assumption down. On a team of agents that is a virtue: the "Claude" CTO is usually the one who says "this is not defined, we will resolve it this way and flag it."

### Large context window

Current Claude models handle very large contexts, which lets you give it the brief, the design system, the reference research and the files already written without summarizing anything.

## Where you should not use it

- **Trivial, high-volume tasks**: if you only need to classify a thousand short texts, Haiku is enough and Opus is a waste.
- **When cost per token is all that matters**: there are cheaper alternatives (DeepSeek, Llama on Groq, Mistral) for low-risk roles.
- **Real-time search**: Claude does not browse on its own; in Tably, reference research is done by the system with a real browser, which hands it the results.

## Which role to give it on your team

Our recommendation, after hundreds of builds:

- **Builder**: Claude Code with Opus. It is the combination that finishes the most projects without intervention.
- **CTO or Head of Engineering**: Opus or Sonnet. It argues architecture decisions clearly and spots risks other models overlook.
- **Design**: Sonnet. It delivers coherent design systems and knows how to transcribe a reference without "improving" it when you ask for a replica.
- **Product**: Sonnet. It writes concrete acceptance criteria and notices when a flow does not close.
- **QA**: Haiku for quick consistency reviews; Sonnet when the review goes deep.

An all-Claude team works, but it loses the richness of disagreement. What works best for us is Claude in build and engineering, and another provider (GPT or Gemini) in leadership or product, so the council actually debates.

## How it connects in Tably

There are two paths, and you can use both:

1. **Anthropic API key** in "Models and API keys". It works for any council role and for the builder via API. Tokens are billed to your Anthropic account.
2. **Subscription (Claude Code)**. If you have Claude Code installed and signed in, it appears as a desktop builder. If you use Tably in the cloud, you generate a token with `claude setup-token` and paste it into your settings: the server builds with your subscription even when your computer is off.

## Questions we get often

**Is Claude better than GPT for coding?** For long builds on a repository, in our experience yes, consistently. For short snippets or one-off tasks, the differences are small and depend on the day and the exact model.

**Can I mix Claude with other models?** That is the whole idea of Tably. Each role chooses its model.

**How much does it cost?** With Claude Code and a subscription, the build cost is zero in tokens. Via API, it depends on the model: Opus is the most expensive, Haiku the cheapest. Tably shows an estimate before starting and the real cost when it finishes.

## In short

Claude is the model for the work that hurts most to redo: the architecture, the code, the brief. Give it the seats where judgment matters and let other models contradict it in leadership and product.
