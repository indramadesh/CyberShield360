# Contributing

## Ground rules (from the project charter)
1. **Preserve existing behavior.** Before changing a feature: inspect it, find
   dependents, write/adjust tests, then make the *smallest safe change*. Don't
   rewrite unrelated modules.
2. **Depend on abstractions.** Use repositories (not raw SQL) and the provider
   registry (not a concrete LLM/OCR/intel/storage). Keep the dependency arrows
   pointing downward (see ARCHITECTURE §3).
3. **Config over hard-coding.** New behavior that could vary belongs in settings /
   feature flags / `app_config`, not literals in components.
4. **No false certainty.** Never say "100% safe/malicious". Report risk +
   confidence + evidence.
5. **Untrusted input.** Treat URLs, files, messages, website and LLM content as
   hostile. The LLM explains evidence; it never originates it.

## Workflow
- Branch off `main`. Keep PRs scoped to one change.
- Update `PROJECT_STATUS.md` when a phase or major item changes.
- Any schema change ⇒ an Alembic migration (`cd backend && alembic revision
  --autogenerate -m "..."`), reviewed for correctness (don't trust autogen blindly).

## Running checks locally
Backend: `cd backend && pytest -q`
Frontend: `cd frontend && npm run build && npm test`

## Commit / PR conventions
- Conventional-style subjects (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- CI must pass (lint → type → unit → integration → security → build) before merge.
