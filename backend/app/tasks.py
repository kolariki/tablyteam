"""Background jobs (arena runs, builds, reviews, deploys) run under a job runner started with the app,
never inside a request's task/cancel scope: a finished HTTP request must not cancel the job it started.
Outside the app (tests, scripts) `spawn` falls back to a plain task with a clean context."""
from __future__ import annotations

import asyncio
import contextvars
import logging
from typing import Any, Awaitable, Coroutine

log = logging.getLogger("arena.tasks")
_queue: asyncio.Queue | None = None
_loop: asyncio.AbstractEventLoop | None = None
_runner: asyncio.Task | None = None
_jobs: set[asyncio.Task] = set()


def spawn(coro: Coroutine[Any, Any, Any]) -> Awaitable[Any]:
    loop = asyncio.get_running_loop()
    if _queue is not None and _loop is loop:
        fut: asyncio.Future = loop.create_future()
        _queue.put_nowait((coro, fut))
        return fut
    task = loop.create_task(coro, context=contextvars.Context())
    _jobs.add(task)
    task.add_done_callback(_jobs.discard)
    return task


async def _run() -> None:
    assert _queue is not None
    while True:
        coro, fut = await _queue.get()
        task = asyncio.get_running_loop().create_task(coro)
        _jobs.add(task)

        def done(t: asyncio.Task, fut: asyncio.Future = fut) -> None:
            _jobs.discard(t)
            if fut.done():
                return
            if t.cancelled():
                fut.cancel()
            elif t.exception():
                log.error("background job failed: %r", t.exception())
                fut.set_exception(t.exception())  # type: ignore[arg-type]
            else:
                fut.set_result(t.result())

        task.add_done_callback(done)


def start_runner() -> None:
    global _queue, _loop, _runner
    _loop = asyncio.get_running_loop()
    _queue = asyncio.Queue()
    _runner = _loop.create_task(_run(), context=contextvars.Context())


async def stop_runner() -> None:
    global _queue, _loop, _runner
    if _runner:
        _runner.cancel()
    for t in list(_jobs):
        t.cancel()
    _queue = _loop = _runner = None
