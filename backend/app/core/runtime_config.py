"""Runtime config overrides (admin-editable, no redeploy).

Values live in the `app_config` table and are cached here in-process. They layer
ON TOP of env `settings`. Keys used: 'features' (dict), 'thresholds' (dict).
"""
from __future__ import annotations

from app.core.config import settings

_OVERRIDES: dict[str, dict] = {}


def load(session) -> None:
    from app.db.models.appconfig import AppConfig

    _OVERRIDES.clear()
    for row in session.query(AppConfig).all():
        _OVERRIDES[row.key] = row.value_json or {}


def set_override(session, key: str, value: dict) -> None:
    from app.db.models.appconfig import AppConfig

    row = session.get(AppConfig, key)
    if row:
        row.value_json = value
    else:
        session.add(AppConfig(key=key, value_json=value))
    session.commit()
    _OVERRIDES[key] = value


def feature_overrides() -> dict:
    return _OVERRIDES.get("features", {})


def effective_thresholds() -> dict:
    t = _OVERRIDES.get("thresholds", {})
    return {
        "suspicious": int(t.get("suspicious", settings.risk_threshold_suspicious)),
        "high": int(t.get("high", settings.risk_threshold_high)),
        "critical": int(t.get("critical", settings.risk_threshold_critical)),
    }


def snapshot() -> dict:
    return dict(_OVERRIDES)
