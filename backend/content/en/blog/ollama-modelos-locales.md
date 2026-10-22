---
title: Ollama: run AI models on your own computer, free and in private
description: What Ollama is, which models you can run locally (Llama, Mistral, Qwen, DeepSeek, Gemma), what hardware you need, what quality to expect and how to use it on an AI team without any data leaving your machine.
category: AI models
date: 2026-10-22
tags: [Ollama, local models, privacy, AI models]
keywords: [Ollama, local AI models, run an LLM on my computer, offline AI, private AI, local Llama]
provider: ollama
---

**Ollama** is a program that runs open language models **on your own computer**. No API key, no per-token cost, and no data leaving your machine. In Tably Team it appears as one more provider: any role on the team can use a local model.

## How it works

You install Ollama, download a model with a command (`ollama pull llama3.2`, for example) and a local server stays running that Tably talks to like any other provider. The models are stored on disk; inference uses your processor and, if you have one, your graphics card.

## What models you can run

- **Llama** (Meta): the most popular; small versions run on almost any modern computer.
- **Mistral and Mixtral**: efficient, good Spanish.
- **Qwen** (Alibaba): very good at code and reasoning for its size.
- **DeepSeek** (distilled versions): reasoning at a low hardware cost.
- **Gemma** (Google): compact and competent.
- **Code models** (Codestral, Qwen Coder, Llama variants for code).

Tably proposes a small version of Llama by default, which runs on an ordinary laptop. If you have more hardware, go up in size.

## What hardware you need

| Model size | Recommended memory | Experience |
|---|---|---|
| 3 to 8 billion parameters | 8 to 16 GB of RAM | Fast on a modern laptop; basic-assistant quality |
| 14 to 32 billion | 24 to 32 GB (or a GPU with 16+ GB) | Serious quality for debate and review; slower |
| 70 billion or more | 64 GB+ or a professional GPU | Close to a mid-range API model; slow without a GPU |

Macs with Apple Silicon chips perform very well thanks to unified memory; on a PC, an NVIDIA graphics card with plenty of memory makes the difference.

## What sets it apart

### Total privacy

Nothing leaves your machine. For projects with sensitive data, contracts with confidentiality clauses or simply for working offline, it is the only option with that guarantee.

### Zero per-token cost

You can run the council a hundred times without the bill changing. For learning to use Tably, for experimenting with prompts and for supporting roles, it is ideal.

### No dependence on third parties

If a provider changes prices or terms, your local model stays the same.

## Where not to use it

- **Building a complete app**: local models, unless you have professional hardware, are not up to the level of Claude Code or a frontier model through an API for writing dozens of coherent files.
- **Complex reasoning**: an 8B model does not plan an architecture like an Opus does. For the CTO of a serious project, use an API.
- **Speed in long councils**: without a GPU, six agents with a mid-sized model can take quite a while.
- **Vision**: there are local models with vision, but their descriptions of screenshots are poorer than those from Gemini or GPT.

## What role to give it on your team

- **Consistency QA**: with a mid-sized model, competent and free.
- **Summaries and classification**: no problem.
- **Product on small projects**: acceptable with a 14B model or larger.
- **Prompt experimentation**: perfect. Fine-tune each role's prompt locally and then move it to an API model.
- **Entire test teams**: for learning the platform without spending.

## How to connect it in Tably

With Ollama running on your machine, it appears as "Ollama (local)" under "Models and API keys". No key is needed. The selector shows the models you have downloaded. If you use Tably in the cloud, Ollama has to run on the Tably server or be reachable from it.

## Frequently asked questions

**Is it free?** Yes: Ollama is open source and open models have no license cost for most uses (check each one's license).

**Which local model is best for Spanish?** Recent versions of Llama, Qwen and Mistral perform well. Try a couple with the same prompt and compare.

**Can I build an entire app with a local model?** With professional hardware and a large model, it can be done for small apps. For something serious, use a desktop builder or an API model, and reserve local models for the council and for review.

## In summary

Ollama gives you total privacy and zero cost in exchange for quality and speed limited by your hardware. It is ideal for learning, experimenting and for supporting roles; for serious building, combine it with a frontier model.
