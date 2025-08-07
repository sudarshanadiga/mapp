"""
Serve uploaded attachments or large static blobs
that are not handled by Flask's normal static routing.
"""

from __future__ import annotations

from pathlib import Path
from flask import Blueprint, abort, send_from_directory

uploads_bp = Blueprint("uploads", __name__)

UPLOAD_ROOT = Path(__file__).parent.parent / "uploads"
UPLOAD_ROOT.mkdir(exist_ok=True)


@uploads_bp.get("/uploads/<path:filename>")
def serve_upload(filename: str):
    safe_path = (UPLOAD_ROOT / filename).resolve()
    if not safe_path.is_file() or UPLOAD_ROOT not in safe_path.parents:
        abort(404)
    return send_from_directory(UPLOAD_ROOT, safe_path.relative_to(UPLOAD_ROOT)) 