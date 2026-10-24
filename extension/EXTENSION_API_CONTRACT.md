# Extension ↔ Backend API Contract

Base URL is user-configurable (default `http://localhost:8000`). All responses use the
platform envelope `{ "success": bool, "data": ..., "error": {code,message}, "request_id" }`.

## Reused endpoint

### `POST /api/v1/scans`  (anonymous allowed)
Request:
```json
{ "type": "URL", "payload": "https://example.com/login" }
```
Response `data` (the platform ScanOutcome — consumed as-is, no re-scoring):
```json
{
  "scan_id": "…", "scan_type": "URL", "status": "COMPLETE",
  "risk_level": "LOW|SUSPICIOUS|HIGH|CRITICAL",
  "risk_score": 0, "confidence": 0.0, "category": "PHISHING",
  "indicators": ["…"],
  "evidence": [{ "indicator": "…", "summary": "…", "source": "rule|domain|intel|…", "weight": 0 }],
  "recommendations": ["…"], "explanation": "…", "notes": ["…"]
}
```
Rules honored by the UI: a `LOW` result is **not** a safety guarantee; confidence ≠
risk; evidence with `weight > 0` are the real findings.

## New endpoints (added for the extension; no new risk logic)

### `GET /api/v1/extension/health`
```json
{ "status": "ok", "engine_version": "1.0.0", "app_name": "CyberShield 360",
  "capabilities": { "url": true, "message": true, "website": true } }
```

### `GET /api/v1/extension/blocklist`
High-confidence (≥0.8) known-bad **domains** for client-side `declarativeNetRequest`
rules. Bounded (≤1000).
```json
{ "domains": [ { "domain": "account-verify-login.example", "threat_type": "PHISHING", "confidence": 0.88 } ],
  "count": 1 }
```

## Notes
- No API keys are embedded in the extension; these endpoints are public read-only.
- The extension sends only URLs the user chooses to analyze (and the active tab's URL
  when the user clicks *Analyze*). It never transmits page content, credentials or history.
- CORS is not required: the service worker / extension pages fetch under host permissions.
