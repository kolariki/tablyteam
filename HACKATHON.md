# Tably Team × Meta Global AI Developer Hackathon

**Track:** Startups · **Problem statement:** Build for Your World · **Building period:** Oct 27 – Nov 4, 2026

Tably Team is an existing product: a platform where a team of AI agents with roles (CEO, CTO, Head of Engineering, Product, Design, QA) debates an idea, researches reference apps, designs the screens, writes the code, reviews it and publishes the app. The hackathon rules allow startups to build on an existing codebase as long as the new work is clearly identified. This file is that identification.

## Where the line is

- Everything up to the git tag **`pre-hackathon`** (commit `62cccb4`, Oct 22, 2026) existed before the event.
- Everything after that tag was built during the building period. To see exactly what is new:

```bash
git log --oneline pre-hackathon..main
git diff --stat pre-hackathon..main
```

The demo video and the live demo only show the features listed under "Built during the hackathon".

## What existed before (for context only)

- The multi-model council (Claude, GPT, Gemini, DeepSeek, Grok, Llama, Kimi, Mistral, OpenRouter, Ollama), the direct builder lane, the design stage, the builder (Claude Code, Codex or an API model), reference research with a real browser, Tably Cloud (own git, one-click publish, Neon/Supabase provisioning), mobile builds with Expo, the blog and FAQ.
- The repository history before the tag is the proof.

## Built during the hackathon (with Meta models)

Each item links to the code and names the Meta model it uses. This list is updated as the work lands.

| # | Feature | Meta model | Where |
|---|---|---|---|
| 1 | **Meta · Muse as a first-class provider**: Muse Spark 1.3 and Muse Wonder 1.0 available for every role of the council, for prompt engineering and as the API builder, through the Meta Model API (OpenAI-compatible surface). | `muse-spark-1.3`, `muse-wonder-1.0` | `backend/app/providers.py`, `backend/app/pricing.py`, `frontend/src/lib/brand.ts`, `frontend/src/components/ProviderRow.tsx` |
| 2 | **Muse Code as the desktop builder**: Tably runs `muse exec --json` headless on the project (streams text, tool activity and tokens), resumes sessions, and «My sessions» lists and continues Muse Code conversations from this machine. Auth with the user's Meta Model API key or `muse login`. | Muse Code (`muse-wonder-1.0` by default) | `backend/app/local_engine.py`, `backend/app/agent_sessions.py`, `frontend/src/components/AgentSessions.tsx`, `frontend/src/components/SubscriptionPanel.tsx` |
| 3 | **Muse-first product**: every role lands on its recommended Muse model (Wonder for direction and engineering, Spark for product, design and QA), prompt engineering on Spark, shares and intros grouped by Muse model, Muse-only pickers for the hackathon edition. | `muse-wonder-1.0`, `muse-spark-1.3` | `frontend/src/lib/muse.ts`, `frontend/src/lib/flags.ts`, `frontend/src/components/Setup.tsx` |
| 4 | **Growth levels, Tably Analytics and the marketplace**: every project climbs a strict ladder the team follows to the letter (1 En línea → 2 Medido → 3 Visible → 4 Monetizado). Each level is a list of checks evaluated on the real project (files, council verdict, Tably Cloud, analytics hits); the builder and the council get the pending checks of the level being climbed as blocking items, the president marks each one and the UI shows the % towards the next level. Level 2 brings a built-in, cookie-less analytics collector (`/a.js` + `/api/a/<site>`). From level 1 the app can be listed on the marketplace (pitch, price, real visits) and its ownership transferred to another account. | council and builder on `muse-wonder-1.0` / `muse-spark-1.3` | `backend/app/levels.py`, `backend/app/orchestrator.py`, `backend/app/builder.py`, `backend/app/main.py`, `frontend/src/components/LevelsPanel.tsx`, `frontend/src/components/Marketplace.tsx` |

_(more rows are added as features ship: SAM 3.1 on reference screenshots, Muse Image in the design stage, Muse Voice Transcribe for spoken requests)_

## How to run it

See `README.md` and `docs/railway.md`. To use the Meta models, add a Meta Model API key under *Models and API keys* (env `META_API_KEY` for a server-wide key).

## Team

Ivan Kolariki (solo founder) with the Tably Team agents.
