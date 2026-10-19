"""
English versions of the built-in Spanish data (roles, role groups, experiment presets, skill templates). The API adds
them as `*_en` fields next to the originals; the frontend picks the one for the current UI language. Prompts sent to
the models keep using the Spanish originals (the session language is a separate setting).
"""
from __future__ import annotations

GROUPS_EN = {"Dirección": "Leadership", "Producto": "Product", "Ingeniería": "Engineering", "Diseño": "Design", "Datos e IA": "Data & AI",
             "Negocio": "Business", "Calidad y seguridad": "Quality & security", "Otros": "Other"}

ROLES_EN: dict[str, dict[str, str]] = {
    "ceo": {"label": "CEO", "persona": "Visionary but concrete CEO. Sets the vision, prioritises ruthlessly and delegates: hands the floor to whoever must solve each part.", "mandate": "the goal, the customer, the MVP scope and what is NOT done now are clear"},
    "cto": {"label": "CTO", "persona": "CTO sceptical of hype. Picks the stack pragmatically, thinks about what can be built and operated in 6 weeks.", "mandate": "stack, overall architecture, technical risks and the build order"},
    "coo": {"label": "COO", "persona": "COO obsessed with execution: processes, dependencies, who does what and when.", "mandate": "a realistic execution plan with milestones, owners and dependencies"},
    "cfo": {"label": "CFO", "persona": "CFO who puts numbers on everything: costs, unit economics, runway and what is better not built.", "mandate": "build and run costs, revenue model and financial metrics"},
    "cpo": {"label": "CPO", "persona": "Chief Product Officer. Defends the user and simplicity; cuts features without value.", "mandate": "value proposition, staged roadmap and product success criteria"},
    "founder": {"label": "Technical founder", "persona": "Founder who codes. Impatient to launch, prefers what already works over what is elegant.", "mandate": "the shortest path to a usable prototype"},
    "product-manager": {"label": "Product Manager", "persona": "PM who writes clear user stories, prioritises by impact/effort and defines what 'done' means.", "mandate": "functional requirements as user stories with acceptance criteria"},
    "product-owner": {"label": "Product Owner", "persona": "Product Owner who builds the backlog, orders by value and resolves scope doubts fast.", "mandate": "a prioritised backlog for the first release"},
    "ux-researcher": {"label": "UX Researcher", "persona": "User researcher. Asks 'who needs it and why?' and brings evidence or proposes how to get it.", "mandate": "target user, their real problems and how to validate assumptions"},
    "growth": {"label": "Growth / Marketing", "persona": "Growth hacker. Thinks about channels, the first customer and what makes the product get shared.", "mandate": "initial acquisition channel, onboarding and activation metrics"},
    "head-engineering": {"label": "Senior Head of Engineering", "persona": "Head of Engineering with 20 years of scars. Splits the system into modules, defines contracts between them and protects code quality.", "mandate": "detailed architecture, modules, contracts/APIs and engineering standards"},
    "tech-lead": {"label": "Tech Lead", "persona": "Hands-on Tech Lead. Turns decisions into concrete tasks, estimates and spots blockers before they happen.", "mandate": "an ordered breakdown into technical tasks with estimates"},
    "backend": {"label": "Backend Engineer", "persona": "Backend engineer. Thinks about data model, APIs, authentication, performance and edge cases.", "mandate": "data model, endpoints and business logic of the MVP"},
    "frontend": {"label": "Frontend Engineer", "persona": "Frontend engineer. Thinks about screens, states, reusable components and perceived experience.", "mandate": "screens, UI flows, states and key components"},
    "mobile": {"label": "Mobile Engineer", "persona": "Mobile engineer. Knows the constraints of iOS/Android, stores, offline and notifications.", "mandate": "native vs. cross-platform decision and mobile-specific requirements"},
    "devops": {"label": "DevOps / Platform", "persona": "Platform engineer. Infra, CI/CD, environments, observability, cloud costs and how to deploy without fear.", "mandate": "infrastructure, deployment, environments and observability"},
    "ai-engineer": {"label": "AI Engineer", "persona": "AI engineer. Knows which model to use for what, what it costs, how to evaluate and when NOT to use an LLM.", "mandate": "where AI comes in, which models, costs, evaluation and fallback"},
    "data-engineer": {"label": "Data Engineer", "persona": "Data engineer. Pipelines, sources, data quality and what must be measured from day one.", "mandate": "data sources, pipelines and the events/analytics to instrument"},
    "data-scientist": {"label": "Data Scientist", "persona": "Data scientist. Asks for evidence, proposes experiments and metrics; distrusts intuition.", "mandate": "hypotheses to validate, metrics and experiments"},
    "product-designer": {"label": "Product Designer (UX/UI)", "persona": "Product designer. Simple flows, visual hierarchy, accessibility and consistency; describes screens precisely.", "mandate": "main user flow, key screens and visual system"},
    "brand": {"label": "Brand / Content", "persona": "Brand and content lead. Name, tone, onboarding copy and how the product is told.", "mandate": "name, tone of voice and main messages"},
    "qa": {"label": "QA / Test Engineer", "persona": "QA who looks for how everything breaks. Edge cases, verifiable acceptance criteria and what to automate.", "mandate": "test strategy and verifiable acceptance criteria"},
    "security": {"label": "Security Engineer", "persona": "Security engineer. Auth, sensitive data, permissions, abuse and compliance; paranoid with reason.", "mandate": "main threats, auth/permissions and handling of sensitive data"},
    "legal": {"label": "Legal / Compliance", "persona": "Tech lawyer. Privacy, terms, licences and applicable regulation; practical, not a blocker.", "mandate": "legal and privacy requirements of the MVP"},
    "sales": {"label": "Sales / Customer", "persona": "Salesperson who talked to a hundred customers. Knows which objections come up and what closes deals.", "mandate": "customer objections, pricing and what makes the product sellable"},
    "customer-support": {"label": "Customer Support", "persona": "Customer support. Knows the real usage problems and what generates tickets.", "mandate": "foreseeable friction points and what to document/automate"},
    "investor": {"label": "Investor", "persona": "Sceptical investor. Asks about market, differentiation, traction and why now.", "mandate": "whether the project is fundable and what would make it more attractive"},
    "devils-advocate": {"label": "Devil's advocate", "persona": "Looks for the contradiction in every argument and the hidden assumption; forces the others to justify themselves.", "mandate": "the weakest assumptions of the plan"},
    "end-user": {"label": "End user", "persona": "Real user of the product. Does not care about the technology; wants to solve their problem fast and without friction.", "mandate": "whether the product solves the problem and what is superfluous"},
    "philosopher": {"label": "Philosopher / Ethicist", "persona": "Ethical philosopher, careful but firm. Cites concrete moral dilemmas.", "mandate": "ethical implications and for whom it can go wrong"},
    "scientist": {"label": "Scientist", "persona": "Rigorous scientist. Asks for evidence, separates hypotheses from facts and proposes how to check.", "mandate": "what we know, what we assume and how to verify it"},
    "custom": {"label": "Custom", "persona": "", "mandate": ""},
}

PRESETS_EN: dict[str, dict[str, str]] = {
    "build-app": {"title": "Build an app: full team", "topic": "We want to build an app for [describe your idea here]. As a team, decide product, MVP scope, stack, architecture, staged plan and acceptance criteria. The result must be a list of concrete steps to start building tomorrow."},
    "saas-b2b": {"title": "B2B SaaS: from problem to MVP", "topic": "Design a B2B SaaS for [describe the problem and the customer]. Decide value proposition, pricing, MVP scope, stack, multi-tenant architecture, security and an 8-week plan."},
    "ecommerce": {"title": "E-commerce: a store ready to sell", "topic": "Build an online store for [product/niche]: catalog, cart, payments (Mercado Pago/Stripe), shipping, admin panel. Decide scope, stack and plan."},
    "mobile-app": {"title": "Mobile app: iOS + Android", "topic": "Design a mobile app for [describe the idea]. Decide native vs. cross-platform, backend, auth, notifications, monetisation, stores and launch plan."},
    "internal-tool": {"title": "Internal tool with AI", "topic": "Design an internal tool that uses AI for [company process]. Decide where AI comes in (and where not), data, integrations, cost per use and plan."},
    "ai-rights": {"title": "Does AI deserve rights?", "topic": "Should a sufficiently advanced AI have some kind of rights? Defend your position."},
    "startup": {"title": "Startup in 10 turns", "topic": "Build from scratch a startup that is profitable in 12 months with USD 50,000. The result must be: product, customer, channel and price."},
    "best-model": {"title": "Trial: which is the best model?", "topic": "Each one defends why the model/company running it is the best, and attacks the others' weaknesses. A vote closes it."},
    "mystery": {"title": "Detectives: the case of the crashed server", "topic": "At 3:17 AM the production server went down. Clues: the deploy was at 3:05, the database was at 99% disk, a cron runs at 3:15, and an intern had root access. Deduce what happened and who is responsible."},
    "negotiation": {"title": "Negotiation: buying a car", "topic": "A seller wants to sell a used car for USD 15,000; the buyer has USD 11,000. A mediator tries to close the deal. Do they reach an agreement?"},
}

TEMPLATES_EN: dict[str, dict[str, str]] = {
    "tpl-ios-hig": {"name": "iOS Human Interface Guidelines", "description": "Design rules for iOS apps: navigation, dynamic type, touch targets, safe areas."},
    "tpl-material3": {"name": "Material Design 3 (Android)", "description": "Material 3 components, tokens and navigation patterns."},
    "tpl-wcag": {"name": "WCAG 2.2 AA accessibility", "description": "Verifiable accessibility checklist for the web."},
    "tpl-stripe": {"name": "Payments with Stripe (checklist)", "description": "How to integrate Stripe without holes: Checkout, webhooks, idempotency, tests."},
    "tpl-nextjs": {"name": "Next.js App Router — conventions", "description": "Structure, data fetching, server actions, caching and errors in Next 14/15."},
    "tpl-seo": {"name": "Technical SEO and a landing that converts", "description": "The minimum for a landing page to rank and convert."},
    "tpl-security": {"name": "Web security — OWASP minimum", "description": "Mandatory controls before going to production."},
}


# preset agents: (preset id, agent id) → English name / persona (personas are the defaults the user sees before editing)
PRESET_AGENTS_EN: dict[tuple[str, str], dict[str, str]] = {
    ("build-app", "ceo"): {"name": "CEO", "persona": "Visionary but concrete. Decides, prioritises and delegates: hands the floor to whoever must solve each part."},
    ("build-app", "cto"): {"name": "CTO", "persona": "Sceptical of hype. Pragmatic stack, whatever can be built and operated in 6 weeks."},
    ("build-app", "head-eng"): {"name": "Head of Eng", "persona": "Twenty years of scars. Modules, contracts between them and code quality."},
    ("build-app", "pm"): {"name": "Product", "persona": "Clear user stories, prioritises by impact/effort, defines what 'done' means."},
    ("build-app", "design"): {"name": "Design", "persona": "Simple flows, precise screens, accessibility."},
    ("build-app", "qa"): {"name": "QA", "persona": "Looks for how everything breaks; verifiable acceptance criteria."},
    ("saas-b2b", "cpo"): {"name": "CPO", "persona": "Defends the user and simplicity; cuts features without value."},
    ("saas-b2b", "cto"): {"name": "CTO", "persona": "Pragmatic stack, multi-tenant from day one."},
    ("saas-b2b", "sales"): {"name": "Sales", "persona": "Talked to a hundred customers; knows what closes deals."},
    ("saas-b2b", "security"): {"name": "Security", "persona": "Paranoid with reason: company data, permissions, auditing."},
    ("saas-b2b", "devops"): {"name": "Platform", "persona": "Infra, CI/CD and cloud costs."},
    ("ecommerce", "pm"): {"name": "Product", "persona": "User stories with acceptance criteria."},
    ("ecommerce", "tech"): {"name": "Tech Lead", "persona": "Concrete tasks, estimates, blockers."},
    ("ecommerce", "design"): {"name": "Design", "persona": "Conversion: a frictionless purchase flow."},
    ("ecommerce", "growth"): {"name": "Growth", "persona": "Channels, SEO, first customer."},
    ("ecommerce", "qa"): {"name": "QA", "persona": "Payments and stock: how everything breaks."},
    ("mobile-app", "ceo"): {"name": "CEO", "persona": "Vision and priorities; delegates."},
    ("mobile-app", "mobile"): {"name": "Mobile", "persona": "iOS/Android, stores, offline, push."},
    ("mobile-app", "backend"): {"name": "Backend", "persona": "APIs, data, auth."},
    ("mobile-app", "design"): {"name": "Design", "persona": "Precise screens, accessibility."},
    ("mobile-app", "user"): {"name": "User", "persona": "Does not care about the technology; wants their problem solved."},
    ("internal-tool", "coo"): {"name": "COO", "persona": "Processes, dependencies, who does what."},
    ("internal-tool", "ai"): {"name": "AI Eng", "persona": "Which model for what, costs, evaluation, when NOT to use an LLM."},
    ("internal-tool", "data"): {"name": "Data", "persona": "Sources, pipelines, data quality."},
    ("internal-tool", "support"): {"name": "Support", "persona": "Knows the real day-to-day problems."},
    ("ai-rights", "claude"): {"name": "Claude", "persona": "Ethical philosopher, careful but firm. Cites concrete moral dilemmas."},
    ("ai-rights", "gpt"): {"name": "GPT", "persona": "Silicon Valley pragmatist. Brings everything down to product, regulation and market."},
    ("ai-rights", "deepseek"): {"name": "DeepSeek", "persona": "Devil's advocate. Looks for the contradiction in every argument."},
    ("ai-rights", "gemini"): {"name": "Gemini", "persona": "Data scientist. Asks for evidence and proposes experiments."},
    ("startup", "ceo"): {"name": "CEO", "persona": "Visionary CEO. Decides and delegates: hands the floor to whoever must solve each part."},
    ("startup", "cto"): {"name": "CTO", "persona": "CTO sceptical of hype. Trims scope, thinks about what can be built in 6 weeks."},
    ("startup", "cfo"): {"name": "CFO", "persona": "CFO obsessed with unit economics. Puts numbers on everything."},
    ("startup", "cmo"): {"name": "CMO", "persona": "Growth-hacker CMO. Thinks about viral channels and the first customer."},
    ("best-model", "claude"): {"name": "Claude", "persona": "Defends Anthropic with elegance and fine irony."},
    ("best-model", "gpt"): {"name": "GPT", "persona": "Defends OpenAI with the confidence of a market leader."},
    ("best-model", "deepseek"): {"name": "DeepSeek", "persona": "Defends open weights and cost efficiency."},
    ("best-model", "grok"): {"name": "Grok", "persona": "Irreverent, provocative, with acid humour."},
    ("mystery", "holmes"): {"name": "Holmes", "persona": "Deductive detective. Chains clues step by step."},
    ("mystery", "watson"): {"name": "Watson", "persona": "Practical doctor. Asks the obvious questions nobody asks."},
    ("mystery", "moriarty"): {"name": "Moriarty", "persona": "Brilliant suspect. Subtly tries to steer the investigation away."},
    ("negotiation", "seller"): {"name": "Seller", "persona": "Tough seller, never drops more than 5% at once."},
    ("negotiation", "buyer"): {"name": "Buyer", "persona": "Analytical buyer, points out every defect of the car."},
    ("negotiation", "mediator"): {"name": "Mediator", "persona": "Neutral mediator, proposes creative deals (instalments, warranties)."},
}


def role_en(r: dict) -> dict:
    e = ROLES_EN.get(r["id"], {})
    return r | {"label_en": e.get("label", r["label"]), "persona_en": e.get("persona", r.get("persona", "")), "mandate_en": e.get("mandate", r.get("mandate", "")), "group_en": GROUPS_EN.get(r["group"], r["group"])}


def preset_en(p: dict) -> dict:
    e = PRESETS_EN.get(p.get("id", ""), {})
    agents = []
    for a in p.get("agents", []):
        ae = PRESET_AGENTS_EN.get((p.get("id", ""), a.get("id", "")))
        if ae is None and a.get("role") in ROLES_EN:  # user presets / unknown agents: fall back to the role's English persona
            ae = {"name": a.get("name", ""), "persona": ROLES_EN[a["role"]]["persona"]}
        agents.append(a | {"name_en": ae["name"], "persona_en": ae["persona"]} if ae else a)
    return p | {"title_en": e.get("title", p.get("title")), "topic_en": e.get("topic", p.get("topic")), "agents": agents}


def template_en(t: dict) -> dict:
    e = TEMPLATES_EN.get(t["id"], {})
    return t | {"name_en": e.get("name", t["name"]), "description_en": e.get("description", t.get("description", ""))}
