---
title: Reference apps and reverse engineering: how Tably studies the apps you like before building yours
description: How reference research works in Tably Team: a real browser visit, screenshots, descriptions from a vision model and, with deep analysis, reverse engineering of bundles, routes and APIs to replicate an app faithfully.
category: Prompt engineering and references
date: 2026-10-22
tags: [reference apps, reverse engineering, how it works, design]
keywords: [clone an app with AI, app reverse engineering, reference apps, replicate an app's design, REA reverse engineering]
---

"Make it look like X" is one of the most useful and most misunderstood instructions in AI-assisted development. A model that has never seen X cannot look like X: it makes things up. Tably Team solves that by **actually looking at the apps** before designing and building.

## Level 1: observation

When you load one or more reference apps (up to six), the system does the following for each one:

1. **Visits it with a real browser**, in parallel, with a desktop-sized window and a mobile-sized one.
2. **Takes screenshots** of the main screen and, when it can, of internal sections.
3. **A vision model** (Gemini Flash by default; GPT or Claude also work) describes each screenshot: visual hierarchy, components, palette, typography, navigation patterns, empty states, calls to action.
4. **A synthesis model** assembles a research document: which patterns are worth emulating, which to avoid, and how the references resemble and differ from one another.

That document and the screenshots stay inside the project, in the research folder, where the designer and the builder read them. It is **free**: it only spends the vision model's tokens, which are few.

You see the whole process on screen: the screenshots appearing, the description being written, the final document. If a reference could not be visited (sites that block automated browsers, for example), you see it and can replace it.

## Level 2: deep analysis and reverse engineering

When you enable "Deep analysis and reverse engineering", the builder additionally receives a reverse engineering tool (REA) with which, during the build, it can:

- Analyze the reference app's JavaScript **bundles** to understand its component structure.
- Discover **routes** and screens that are not visible from the landing page.
- Inspect the **APIs** the app consumes: what data it requests and how it organizes it.
- Extract real design tokens: exact colors, typefaces, spacing, radii, shadows.

With this, the project enters **clone mode**: the design system and the screens are transcribed from the reference instead of being inspired by it. The brief and the designer's own ideas are subordinated to the blueprint: if you asked for a replica, the reference rules.

### Requirements

- REA installed on the machine where Tably runs (`npx rea-agents setup`). If it is not, the checkbox appears disabled and the team only observes (level 1).
- A desktop builder (Claude Code or Codex), which are the ones that can use tools during the build.
- It runs on your subscription or your API key; Tably does not charge a fee for the analysis.

## What "fidelity" means in Tably

The team receives two levels of instruction:

- **Without reverse engineering**: "bring the screens up to the level of those products; emulate the marked patterns, avoid the flagged ones". The reference is a benchmark.
- **With reverse engineering**: "build the replica screen by screen against the blueprint and the screenshots; the palette, typography, grid and components are the reference's even if the brief says otherwise". The reference is a blueprint.

That distinction exists because they are different requests. "Make it look as professional as Linear" is not the same as "I want a Linear for my team".

## How to choose good references

- **Two or three, not six.** More references dilute the signal.
- **The same type of product** as yours: an appointment app for an appointment app.
- **Public pages** that can be viewed without signing in. If the screen you care about is behind a login, Tably's browser will not get in.
- **One reference per aspect**, if you want: "A's navigation, B's onboarding".

## Legal considerations and reasonable use

Observing a public app and describing its patterns is what any designer does with an open tab. Reverse engineering public bundles and APIs, as a learning tool, falls within common industry practice, but **replicating a brand, copying copyrighted content or reproducing an entire app to compete with it may violate terms of service or intellectual property laws**. Use clone mode for prototypes, learning and your own products with their own identity; responsibility for its use is yours.

## What you see in the project

- `research/REFERENCES.md`: the research document.
- `research/shots/`: the screenshots.
- `research/DEEP_ANALYSIS.md` (with deep analysis): the cloning blueprint.
- `design/DESIGN.md` and `design/tokens.css`: the resulting design system.

## In summary

Hand Tably the apps you like and it looks at them before designing. If you want a benchmark, stay at level 1. If you want a blueprint, enable reverse engineering and build with a desktop agent.
