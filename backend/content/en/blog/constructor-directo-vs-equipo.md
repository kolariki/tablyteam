---
title: Direct builder or builder with a team: which one is right for your app
description: The two ways to build in Tably Team, compared honestly. What each one does, how long it takes, how much it costs, what quality to expect and a simple rule for choosing.
category: How Tably works
date: 2026-10-22
tags: [Tably Team, how it works, costs]
keywords: [build an app fast with AI, prompt to app, agent team vs a single model, Tably direct builder]
---

On the Tably Team home screen there are two doors: **Direct builder** and **Builder with a development team**. They are two different philosophies, and choosing wrong costs time or money. This guide compares them without selling you either one.

## What each one does

### Direct builder

1. You write the request (and, if you want, attach context or reference apps).
2. **Prompt engineering** turns your text into a complete brief: goal, users, screens, data, rules, acceptance criteria.
3. The builder (Claude Code, Codex or a model via API) starts right away, design included.
4. When it finishes, you see an **estimated savings card**: how many tokens, minutes and dollars you saved compared to the team path, with the assumptions explained.

There is no debate, no council, no intermediate design approval. The team stays one click away to audit the result afterward.

### Builder with a development team

1. Same request, same context.
2. The team researches the references and introduces itself.
3. **Council debate**: CEO, CTO, Head of Engineering, Product, Design and QA discuss in turns and leave justified decisions.
4. The debate produces the brief; the brief produces the design (system, screens, mockup), which **you approve**.
5. The builder writes the code in stages.
6. The council reviews each version; you ask for changes; the team iterates.

## Comparison

| | Direct | With a team |
|---|---|---|
| Time to first code | Minutes | Tens of minutes (debate + design + approval) |
| Council token cost | Zero | Depends on the models; each round adds up |
| Justified decisions in writing | No (only the brief) | Yes, turn by turn |
| Design approval before code | No | Yes |
| Risk of building the wrong thing | Higher if the request is ambiguous | Lower: the team narrows scope and asks |
| Code quality | The same: depends on the builder | The same: depends on the builder |
| Best for | Clear ideas, small apps, prototypes, tests | Products that grow, clients, architectures you don't want to rebuild |

One important point: **code quality does not change between the two paths**. What changes is the quality of the decisions that reach the builder.

## When to choose the direct path

- You know exactly what you want and can describe it in ten lines.
- The app is small: a calculator, a form, a simple dashboard, a landing page.
- You are testing an idea or comparing builders.
- You already had a team debate on a similar project and want to reuse what you learned.
- The budget is zero: with Claude Code on a subscription, the direct path spends no tokens.

## When to choose the team

- The idea has parts that are not defined ("a marketplace", "an app for my clinic").
- You will have to explain the decisions to a client, a partner or an investor.
- There are architecture decisions with consequences (multi-user, payments, sensitive data, mobile and web at the same time).
- You want to approve the design before any code exists.
- You want someone to tell you "this doesn't belong in the first version".

## A simple rule

> If you can write the acceptance criteria yourself in five minutes, use the direct path. If not, use the team.

## Switching from one to the other

It is not an irreversible decision.

- From a direct build you can **call in the team** to audit: the council reviews what was built, produces a list of changes and the builder applies it.
- From a team project you can ask the builder for small changes directly, without reopening the debate.

## About the estimated savings

The card that appears when a direct build finishes compares against an equivalent team path: it estimates the tokens of K rounds of debate and review, the time of those rounds and the cost at list price. They are **estimates with visible assumptions**, not measurements of a run that never happened. They are for sizing, not for invoicing.

## In summary

The direct path is the way to build quickly what you already have clear. The team is the way to decide well what you don't yet. Both build with the same builder; the difference comes before the code.
