---
title: Security and privacy in Tably Team: what happens with your API keys, your code and your data
description: Where your keys are stored, what each AI provider sees, where your code lives, what data leaves your machine, how the subscription token works, and what options you have if nothing can leave your infrastructure.
category: Costs and security
date: 2026-10-22
tags: [security, privacy, API keys]
keywords: [AI API key security, artificial intelligence data privacy, where is my AI code stored, Claude token security, AI without sending data]
---

Before pasting an API key into any tool, it is worth knowing what it does with it. This guide explains how Tably Team handles keys, code and data, without euphemisms.

## Your API keys

- They are stored **encrypted** in your Tably account, on the server where your instance runs. They are never written into your projects' code or into the logs.
- They are used **only for your requests**: when a role on your team or your builder calls the provider, it does so with your key. No other user of the instance sees or uses them.
- You can **view the last characters**, replace them and delete them in "Models and API keys". Deletion is immediate.
- If you run Tably on your own machine, the keys never leave it except to go to the corresponding provider.

Recommendation: create keys specifically for Tably with each provider, with a spending limit, so you can revoke them without affecting anything else.

## The Claude subscription token

To build with your Claude subscription on a server (for example, Tably deployed in the cloud), you generate a token with `claude setup-token` and paste it into your settings.

- It is stored **encrypted** in your account, like an API key.
- It is used **only for your builds**, with a Claude Code environment isolated per user.
- You can **revoke** it from Tably (by deleting it) and from your Anthropic account.

It is equivalent to signing in to Claude Code on another computer of yours.

## What each AI provider sees

When a role uses a model, the provider receives what that role needs: the brief, the debate context, the relevant project files, the reference descriptions. This is unavoidable: the model has to read in order to work. What each provider does with that depends on **its** policies:

- The paid APIs of Anthropic, OpenAI, Google and most providers **do not train on your data** by default. Check each one's current terms.
- Some providers (DeepSeek, Moonshot) process data in different jurisdictions. If that matters, use the same models via OpenRouter choosing providers that do not retain data, or run local models.
- With **Ollama**, nothing leaves your machine.

Tably lets you choose the provider role by role precisely so you can make that decision per project.

## Your code

- Each project lives in **your account**, in its own git repository.
- You can download it, clone it and push it to your GitHub at any time.
- No other user of the instance has access to your projects.
- If you delete a project, its repository, its files and its history are deleted.

## Reference apps

When you provide reference URLs, Tably visits them with its own browser. The screenshots and descriptions stay inside your project. With reverse engineering enabled, the bundles and public responses that are analyzed stay there too. Nothing is shared with other users.

## The apps you publish

- Each published app has **its own environment variables and secrets**, encrypted, which no other app sees.
- The Neon, Supabase, Cloudflare or Fly credentials you enter for Tably Cloud are stored encrypted in your account and used only to provision your projects.
- Your app's service keys (payments, email) are entered as project secrets, never in the code.

## If nothing can leave

Tably can run **entirely on your infrastructure**: your machine or your server, with your database. With Ollama for the models and Claude Code or Codex via subscription for building, the full workflow works without entering a single third-party API key. There is a deployment guide (Docker and Railway) in the project repository.

## What Tably does not do

- It does not read your projects to train anything.
- It does not share your keys, tokens or code with third parties, except the AI provider you chose for each call.
- It does not charge hidden fees for AI usage: the cost you see is the providers' cost.

## Best practices

1. Keys per service with a spending limit.
2. One provider per project according to the sensitivity of the data.
3. Review the project secrets before publishing.
4. Delete the subscription token from servers you no longer use.

## In summary

Your keys are stored encrypted and used only for you; your code is yours and portable; what each AI provider sees is your decision, role by role; and if necessary, everything can run on your infrastructure.
