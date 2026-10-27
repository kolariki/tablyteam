"""Approximate USD prices per 1M tokens (input, output). Estimates for on-screen comparison only —
edit freely or override with ARENA_PRICE_<MODEL>=in,out env vars. Matching is by longest prefix."""
import os

PRICES: dict[str, tuple[float, float]] = {
    # Anthropic
    "claude-fable": (15.0, 75.0),  # placeholder: same tier as Opus until the list price is confirmed; override with ARENA_PRICE_CLAUDE_FABLE
    "claude-opus": (15.0, 75.0),
    "claude-sonnet": (3.0, 15.0),
    "claude-haiku": (1.0, 5.0),
    # Meta Model API, list prices Oct 2026 (dev.meta.ai/docs/pricing-rate-limits): Standard mode; Contributor mode is the discounted variant
    "muse-wonder": (4.0, 20.0),
    "muse-spark-1.3-contributor": (0.10, 0.20),
    "muse-spark-1.2-contributor": (0.10, 0.20),
    "muse-spark": (1.25, 4.25),
    "muse-image": (0.0, 0.0),  # billed per image ($0.01), not per token
    # OpenAI
    "gpt-5-nano": (0.05, 0.40),
    "gpt-5-mini": (0.25, 2.0),
    "gpt-5": (1.25, 10.0),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.0, 8.0),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.5, 10.0),
    "o4-mini": (1.1, 4.4),
    # DeepSeek
    "deepseek-chat": (0.27, 1.10),
    "deepseek-reasoner": (0.55, 2.19),
    # Google
    "gemini-2.5-pro": (1.25, 10.0),
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-3.8-flash": (0.30, 2.50),
    "gemini-3": (1.25, 10.0),
    "gemini": (0.30, 2.50),
    # xAI
    "grok-4": (3.0, 15.0),
    "grok": (2.0, 10.0),
    # Moonshot
    "kimi-k3": (2.0, 8.0),
    "kimi-k2.6": (0.95, 4.0),
    "kimi-k2.5": (0.60, 3.0),
    "kimi": (0.95, 4.0),
    # Groq / open models
    "llama": (0.59, 0.79),
    "mock": (0.0, 0.0),
}


def _env_override(model: str) -> tuple[float, float] | None:
    key = "ARENA_PRICE_" + "".join(c if c.isalnum() else "_" for c in model).upper()
    raw = os.getenv(key)
    if not raw:
        return None
    a, b = raw.split(",")
    return float(a), float(b)


def price_for(model: str) -> tuple[float, float]:
    override = _env_override(model)
    if override:
        return override
    name = model.lower().split("/")[-1]
    best = max((p for p in PRICES if name.startswith(p)), key=len, default=None)
    return PRICES.get(best, (0.0, 0.0)) if best else (0.0, 0.0)


def cost_usd(model: str, input_tokens: int, output_tokens: int, cached_input: int = 0, cache_write: int = 0) -> float:
    """input_tokens is the whole prompt; cached_input/cache_write are the parts served from / written to the prompt cache."""
    pin, pout = price_for(model)
    plain = max(0, input_tokens - cached_input - cache_write)
    return round((plain * pin + cached_input * pin * 0.1 + cache_write * pin * 1.25 + output_tokens * pout) / 1_000_000, 6)
