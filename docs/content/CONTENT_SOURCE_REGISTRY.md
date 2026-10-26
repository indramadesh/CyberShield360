# Content Source Registry

Single definition in code: `backend/app/content/registry.py` (`SOURCES`). It is
synced into the `content_sources` table at startup and every 6 hours; the
admin's enable/disable choice and all health fields live in the database.

Every source below was checked by hand on **2026-10-26**: reachable, valid
format, extractable dates, attribution possible, and automated access not
disallowed. The engine identifies itself honestly as
`CyberShield360-ContentBot/1.0 (+https://github.com/indramadesh/CyberShield360)`
and never changes that to get past a block.

## Enabled

| Key | Publisher | Access method | Format | Dates | Interval | Notes |
|---|---|---|---|---|---|---|
| `certin-home` | CERT-In (India) | `https://www.cert-in.org.in/s2cMainServlet?pageid=PUBWEL01` | HTML (no RSS offered) | Yes, `(October 26, 2026)` | 2 h | Advisories (CIAD), vulnerability notes (CIVN), current activities (CICA). No robots.txt restrictions. Titles, dates, links only. |
| `csk-alerts` | Cyber Swachhta Kendra (CERT-In) | `https://www.csk.gov.in/alerts.html` | HTML list | **No** — stored as "date not given" | 6 h | Malware/botnet alerts. |
| `cisa-advisories` | CISA (US) | `https://www.cisa.gov/cybersecurity-advisories/all.xml` | RSS (~6 MB) | Yes | 3 h | **Currently answers HTTP 403 to the engine's client** (curl reached it earlier). Left enabled with backoff; auto-pauses after 20 failures. |
| `cisa-news` | CISA (US) | `https://www.cisa.gov/news.xml` | RSS | Yes | 2 h | Same 403 behaviour as above. |
| `cisa-kev` | CISA KEV catalogue | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | JSON | Yes (`dateAdded`) | 6 h | Newest 30 entries. ETag/Last-Modified honoured (304s observed). |
| `ncsc-uk` | UK NCSC | `https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml` | RSS | Yes | 3 h | ETag honoured. Crown copyright — titles, short summaries, links. |
| `sans-isc` | SANS Internet Storm Center | `https://isc.sans.edu/rssfeed.xml` | RSS | Yes | 2 h | Research organisation. ETag honoured. |
| `legal-certin-directions-2022` | CERT-In | `https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf` | PDF (document watch) | n/a | 24 h | Conditional **GET** (HEAD on this server returns a generic 860-byte page, so it isn't used). |
| `legal-certin-directions-faq` | CERT-In | `https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf` | PDF (document watch) | n/a | 24 h | Same. |

## Evaluated and not enabled

| Source | URL | Why |
|---|---|---|
| MeitY | https://www.meity.gov.in/ | HTTP 403 "Access Denied" to automated clients (even robots.txt). |
| India Code | https://www.indiacode.nic.in/ | HTTP 403 to automated clients. |
| PIB press-release RSS | https://www.pib.gov.in/RssMain.aspx | "Access Denied" to automated clients. |
| Gazette of India | https://egazette.gov.in/ | Search is form/session driven; no machine-readable listing. |
| PRS Legislative Research | https://prsindia.org/billtrack | No feed; very large HTML page — too fragile. |

These are listed in code (`NOT_ENABLED`) and in Admin → Content operations.
Curated legal records still **link** to India Code / MeitY for the official text.

## Field reference (`content_sources`)

key · name · category (news/advisory/vulnerability/alert/legal) · base_url ·
feed_url · fmt (`rss`, `atom`, `cisa_kev`, `certin_home`, `csk_alerts`,
`doc_watch`) · jurisdiction · language · trust (official/research/media) ·
interval_minutes · timeout_seconds · max_bytes · max_items · enabled ·
paused_reason · license_notes · attribution — and health: last_attempt_at,
last_success_at, last_item_published_at, next_attempt_at, consecutive_failures,
last_error, last_error_type, last_status_code, last_response_ms, etag,
last_modified, total_items, total_duplicates.

## Adding a source

1. Inspect the publisher's real access method (feed, JSON, permitted page). Never guess a feed URL.
2. Append an entry to `SOURCES` with a supported `fmt`, or add an adapter in `app/content/adapters.py`.
3. Add a fixture + test in `tests/unit/test_content_adapters.py`.
4. The next sync creates the row; the worker picks it up on its next tick.
