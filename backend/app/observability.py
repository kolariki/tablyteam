"""Langfuse (SDK v4) tracing. Every arena session = one Langfuse trace grouped under a Langfuse session.

Trace tree:
    arena-session (chain)
      ├─ turn-01 · Claude (agent)
      │    └─ llm · claude-sonnet (generation: model, prompt, output, usage, cost)
      ├─ handoff Claude → DeepSeek (event)
      ├─ ...
      └─ final-vote (chain) → vote · <agent> (agent) → generation
    scores: winner, avg_confidence, disagreement_rate, total_cost_usd

If LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are missing, everything degrades to no-ops.
Observability must never break the show, so every call is wrapped.
"""
from __future__ import annotations

import contextlib
import logging
from typing import Any

from .config import env

log = logging.getLogger("arena.obs")

_client = None
ENABLED = bool(env("LANGFUSE_PUBLIC_KEY") and env("LANGFUSE_SECRET_KEY"))

if ENABLED:
    try:
        from langfuse import get_client

        _client = get_client()
    except Exception as e:  # pragma: no cover
        log.warning("Langfuse disabled: %s", e)
        ENABLED = False


def client():
    return _client


@contextlib.contextmanager
def session_trace(session_id: str, user_id: str, name: str, tags: list[str], metadata: dict[str, str], input: Any):
    """Root observation for one arena run. Yields the span (or None)."""
    if not ENABLED:
        yield None
        return
    from langfuse import propagate_attributes

    with _client.start_as_current_observation(as_type="chain", name="arena-session", input=input) as root:
        with propagate_attributes(
            session_id=session_id,
            user_id=user_id[:200],
            trace_name=name[:200],
            tags=tags,
            metadata={k: str(v)[:200] for k, v in metadata.items()},
        ):
            yield root


@contextlib.contextmanager
def observation(**kwargs):
    if not ENABLED:
        yield None
        return
    try:
        cm = _client.start_as_current_observation(**kwargs)
        obs = cm.__enter__()
    except Exception as e:
        log.debug("langfuse observation failed: %s", e)
        yield None
        return
    try:
        yield obs
    finally:
        with contextlib.suppress(Exception):
            cm.__exit__(None, None, None)


def safe_update(obs, **kwargs) -> None:
    if obs is None:
        return
    with contextlib.suppress(Exception):
        obs.update(**kwargs)


def event(name: str, **kwargs) -> None:
    if not ENABLED:
        return
    with contextlib.suppress(Exception):
        _client.create_event(name=name, **kwargs)


def score(trace_id: str | None, name: str, value, comment: str | None = None, data_type: str | None = None) -> None:
    if not ENABLED or not trace_id:
        return
    with contextlib.suppress(Exception):
        _client.create_score(name=name, value=value, trace_id=trace_id, comment=comment, data_type=data_type)


def current_trace_id() -> str | None:
    if not ENABLED:
        return None
    with contextlib.suppress(Exception):
        return _client.get_current_trace_id()
    return None


def trace_url(trace_id: str | None) -> str | None:
    if not ENABLED or not trace_id:
        return None
    with contextlib.suppress(Exception):
        return _client.get_trace_url(trace_id=trace_id)
    return None


def flush() -> None:
    if ENABLED:
        with contextlib.suppress(Exception):
            _client.flush()
