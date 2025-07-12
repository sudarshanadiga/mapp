"""
pitext_calendar.api package entry.

Creates the parent Flask Blueprint (`calendar_api`) and
registers the feature-specific blueprints found in sibling modules.
"""

from importlib import import_module
from pathlib import Path
from typing import Iterable

from flask import Blueprint

__all__ = ["calendar_api"]

# ---------------------------------------------------------------------
# Blueprint factory
# ---------------------------------------------------------------------

calendar_api = Blueprint(
    "calendar_api",
    __name__,
    static_folder=str(Path(__file__).parent.parent / "static"),
    static_url_path="/static",
    template_folder=str(Path(__file__).parent.parent / "templates"),
)

# List of sub-blueprint modules (do not include the leading package path)
_SUBMODULES: Iterable[str] = (
    "events",
    "followups",
    "uploads",
    "oauth_google",
)

for mod_name in _SUBMODULES:
    module = import_module(f"{__name__}.{mod_name}")
    # every sub-module must expose `<name>_bp`
    bp_attr = next(
        a for a in dir(module) if a.endswith("_bp")
    )
    sub_bp = getattr(module, bp_attr)
    calendar_api.register_blueprint(sub_bp, url_prefix="")
