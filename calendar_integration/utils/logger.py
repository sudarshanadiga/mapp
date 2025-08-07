"""
Unified logging helper.

`get_logger(__name__)` returns a logger that writes:
* human-readable lines to stdout
* daily-rotated files under ~/.pitext/logs/
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Final

from logging.handlers import TimedRotatingFileHandler

_LOG_DIR: Final[Path] = Path.home() / ".pitext" / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)

_FMT: Final[str] = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATEFMT: Final[str] = "%Y-%m-%d %H:%M:%S"


def _file_handler(name: str) -> logging.Handler:
    file_path = _LOG_DIR / f"{name}.log"
    handler = TimedRotatingFileHandler(
        file_path, when="midnight", backupCount=14, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter(_FMT, _DATEFMT))
    return handler


def _stdout_handler() -> logging.Handler:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(_FMT, _DATEFMT))
    return handler


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:  # already configured
        return logger

    logger.setLevel(level)
    logger.addHandler(_stdout_handler())
    logger.addHandler(_file_handler(name.replace(".", "_")))
    logger.propagate = False
    return logger 