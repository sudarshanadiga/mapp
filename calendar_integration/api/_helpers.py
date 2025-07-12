"""
Tiny, framework-free helpers for input validation, CSRF checks,
error responses and common JSON utilities.
"""

from __future__ import annotations

import functools
import json
import logging
from typing import Any, Callable, Dict, Tuple, TypeVar

from flask import Request, Response, abort, jsonify, request

JSONDict = Dict[str, Any]
_F = TypeVar("_F", bound=Callable[..., Response])

log = logging.getLogger("pitext_calendar.helpers")


# ---------------------------------------------------------------------
# CSRF protection (assumes cookie "csrftoken" and header "X-CSRFToken")
# ---------------------------------------------------------------------
def csrf_protect(view: _F) -> _F:  # type: ignore[misc]
    @functools.wraps(view)
    def _wrapped(*args, **kwargs):
        token_cookie = request.cookies.get("csrftoken")
        token_header = request.headers.get("X-CSRFToken")
        if token_cookie != token_header:
            log.warning("CSRF token mismatch")
            abort(403, description="CSRF verification failed")
        return view(*args, **kwargs)

    return _wrapped  # type: ignore[return-value]


# ---------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------
def parse_json(req: Request) -> JSONDict:
    try:
        return req.get_json(force=True, silent=False)  # type: ignore[return-value]
    except Exception as exc:
        log.debug("Invalid JSON: %s", exc)
        abort(400, description="Malformed JSON")


def ok(data: Any = None, status: int = 200) -> tuple[Response, int]:
    payload = dict(data=data, status="success")
    return jsonify(payload), status


def err(message: str, status: int = 400) -> tuple[Response, int]:
    payload = dict(error=message, status="error")
    return jsonify(payload), status


# ---------------------------------------------------------------------
# Simple request arg validator
# ---------------------------------------------------------------------
def require_args(*arg_names: str) -> Callable[[_F], _F]:
    def _decorator(view: _F) -> _F:  # type: ignore[misc]
        @functools.wraps(view)
        def _wrapped(*args, **kwargs):
            missing = [k for k in arg_names if k not in request.args]
            if missing:
                abort(
                    400,
                    description=f"Missing query parameters: {', '.join(missing)}",
                )
            return view(*args, **kwargs)

        return _wrapped  # type: ignore[return-value]

    return _decorator 