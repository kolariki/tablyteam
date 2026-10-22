---
title: Claude Code vs Codex vs API: who writes your app's code and what it costs
description: The three types of builder in Tably Team compared: Claude Code and Codex on a subscription, or a model via API with your key. Differences in quality, cost and speed, and how to use your subscription from your phone with your computer turned off.
category: How Tably works
date: 2026-10-22
tags: [Claude Code, Codex, builder, costs]
keywords: [Claude Code vs Codex, coding agent, build an app with a Claude subscription, Codex CLI, cost of building an app with AI]
---

In Tably Team, the **builder** is the agent that writes the code. It is the decision that weighs most on the result and on the bill. There are three types, and it pays to understand the differences well.

## The three types

### Claude Code (desktop)

Anthropic's coding agent. It is a program that operates on the project: it reads and writes files, runs commands, executes tests, reads the errors and fixes them. It runs on **your Claude subscription**, so it doesn't spend API tokens.

In Tably it appears as "Claude Code · desktop" when it is installed and signed in on the machine where Tably runs. With the model set to "default", it uses Opus, the most capable in the family.

### Codex CLI (desktop)

OpenAI's coding agent. Same concept: it operates on the project with **your ChatGPT account**, with no API tokens. It appears as "Codex CLI · desktop" when it is installed and authenticated.

### Via API

Any model configured with your key (Claude, GPT, Gemini, DeepSeek, Kimi, Mistral, Qwen via OpenRouter…). Tably passes it the brief, the design and the files, and the model responds with the complete files. **Tokens are billed by the provider**, not by Tably.

## Comparison

| | Claude Code | Codex CLI | Via API |
|---|---|---|---|
| Cost | Subscription; zero tokens | Subscription; zero tokens | Tokens billed by the provider |
| Operates on the repository | Yes (reads, edits, runs, tests) | Yes | No: receives context and returns files |
| Long builds (many files and stages) | Excellent | Good | Depends on the model; more risk of losing the thread |
| Fixes compilation errors on its own | Yes | Yes | Only in the next review |
| Reverse engineering of references (REA) | Yes | Yes | No |
| Works in Tably in the cloud with your computer off | Yes, with a setup token | Requires a session on the server | Yes |
| Best for | Complete apps, long iteration | Desktop alternative | Small and medium projects, tests |

## What we observe in practice

- **Claude Code finishes more projects without intervention.** When a build fails, it reads the error and fixes it; when one file depends on another, it reads it before writing. That is why it is our default.
- **Codex is a solid alternative.** On projects where both agents are available, it is worth building the same brief with both and comparing: there are cases (especially with Python stacks or heavy business logic) where Codex performs as well or better.
- **Via API works well up to a certain size.** For an app of ten or fifteen files, a frontier model via API delivers a correct result. Beyond that, the desktop agent makes the difference because it keeps the project state between turns and verifies it.

## Real costs

- **Subscription**: you pay your Claude or ChatGPT plan, and Tably adds nothing per build. A medium-sized app consumes part of your plan's usage limit; the higher plans allow building several per day.
- **Via API**: a medium-sized app usually costs between a few cents and a few dollars depending on the model. Opus and full GPT in the high range; DeepSeek, Kimi, Mistral and Qwen in the low range. Tably shows the real cost when it finishes and adds it to the spending panel.

## Building from your phone with your computer turned off

If you use Tably in the cloud (for example, deployed on Railway), the build runs on the server. To make it use **your Claude subscription**:

1. On your computer, with Claude Code installed, run `claude setup-token`.
2. Paste the token into Tably's "Models and API keys", in the subscription section.
3. From then on the server builds with your subscription, even if your computer is turned off. The token is stored encrypted in your account and is only used for your builds.

## How to choose the builder in Tably

- In the **direct builder**, the "Builder" section of the form lists the available desktop agents and the API option with its provider and model. The choice is remembered.
- In the **builder with a team**, the builder is chosen in the council's verdict, before starting, and can be changed in each review round.

## Frequently asked questions

**Can I have Claude Code and Codex at the same time?** Yes. You choose per project.

**Is the code mine?** Yes. Each build has its own git repository, downloads as a zip and can be pushed to your GitHub.

**What happens if the build is interrupted?** The state is saved; you can resume it from where it left off.

## In summary

If you have a Claude subscription, build with Claude Code: it is the combination that works best and spends no API tokens. If you have ChatGPT, try Codex. Use the API for small projects, tests and model comparisons.
