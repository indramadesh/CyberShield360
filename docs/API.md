# CyberShield 360 — API Map

Base prefix: `/api/v1`. All responses use the envelope below. Auth via Bearer JWT
(access token); refresh via rotating refresh tokens. OpenAPI served at `/docs`.

## Response envelope
```json
// success
{ "success": true, "data": { ... }, "request_id": "req_..." }
// error (never leaks stack traces / secrets)
{ "success": false, "error": { "code": "INVALID_INPUT", "message": "..." }, "request_id": "req_..." }
```

## Meta / health
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | none | liveness (process up) |
| GET | `/ready` | none | readiness — checks db, redis, worker, providers |
| GET | `/api/v1/config` | none | public config: enabled features, threat categories, thresholds → UI hides disabled modules |

## Auth
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/v1/auth/register` | none | create account |
| POST | `/api/v1/auth/login` | none | issue access + refresh |
| POST | `/api/v1/auth/refresh` | refresh | rotate tokens |
| POST | `/api/v1/auth/logout` | access | revoke refresh |
| GET  | `/api/v1/auth/me` | access | current user |
| POST | `/api/v1/auth/password/reset-request` | none | begin reset |
| POST | `/api/v1/auth/password/reset` | token | complete reset |

## Scans (unified)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/v1/scans` | optional* | create scan `{type, payload}` (URL/MESSAGE/EMAIL/QR inline) |
| POST | `/api/v1/scans/upload` | optional* | multipart for IMAGE/`.eml` (size/MIME validated) |
| POST | `/api/v1/scans/website` | access | **queued** website analysis (sandbox) → returns scan id |
| GET  | `/api/v1/scans/{id}` | owner/analyst | fetch result (poll for queued) |
| GET  | `/api/v1/scans` | access | paginated history (redacted) |
| DELETE | `/api/v1/scans/{id}` | owner | delete a scan |
| POST | `/api/v1/scans/{id}/feedback` | optional* | `{useful, marked_wrong, note}` |

\* anonymous allowed but rate-limited harder; `user_id` null.

## Threat categories & intel
| GET | `/api/v1/threat-categories` | none | configured categories |
| GET | `/api/v1/threat-intel/status` | admin | per-provider health/quota |

## Incident response
| POST | `/api/v1/incidents` | optional | submit questionnaire answers → tailored guidance (never auto-files a report) |
| GET  | `/api/v1/incidents/{id}` | owner | retrieve guidance |
| GET  | `/api/v1/incidents/reporting-info` | none | India: cybercrime.gov.in, 1930 (static, configurable) |

## Content (feature-flagged)
| GET | `/api/v1/news` | none | paginated feed |
| GET | `/api/v1/laws` | none | cyber-law / regulation tracker |
| GET | `/api/v1/awareness` | none | lessons list |
| GET | `/api/v1/awareness/{slug}` | none | lesson + quiz |
| GET | `/api/v1/challenges/daily` | optional | gamified challenge |

## Community reports
| POST | `/api/v1/reports` | access | report a suspicious indicator (rate-limited, dupe-detected) |
| GET  | `/api/v1/reports` | analyst/admin | moderation queue |
| PATCH| `/api/v1/reports/{id}` | analyst/admin | moderate |

## Admin
| GET | `/api/v1/admin/analytics` | admin | scans/day, risk & category distribution, latency |
| GET/PUT | `/api/v1/admin/config` | admin | feature flags, thresholds, retention, rate limits |
| GET/PUT | `/api/v1/admin/providers` | admin | enable/disable providers |
| CRUD | `/api/v1/admin/content/*` | admin | awareness/news-sources/orgs/categories CMS |
| GET | `/api/v1/admin/system` | admin | db/redis/worker/ocr/llm status |
| GET | `/api/v1/admin/evaluation` | admin | precision/recall/F1/FPR/FNR (separate from user feedback) |

## Cross-cutting
Every endpoint: input validation (Pydantic), authz, rate limiting, structured
errors, request-id, timeout, input-size limits. Website fetches go through the
**SSRF gate** and run only in the sandbox worker — never inline in an API handler.
