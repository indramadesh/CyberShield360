"""Content worker — the persistent process that keeps content fresh.

    python -m app.content.worker            # run forever (production)
    python -m app.content.worker --once     # run whatever is due, then exit (cron-style)
    python -m app.content.worker --once --force ingest_feeds   # run a job now

Safe to run more than one copy: jobs are protected by database leases.
"""
from __future__ import annotations

import argparse
import json
import logging
import signal
import threading

from app.db.session import SessionLocal


def main() -> None:
    parser = argparse.ArgumentParser(description="CyberShield360 content worker")
    parser.add_argument("--once", action="store_true", help="run due jobs once and exit")
    parser.add_argument("--force", action="append", default=[], help="run this job even if not due (repeatable)")
    parser.add_argument("--tick", type=int, default=60, help="seconds between scheduler ticks")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    from app.content import scheduler
    from app.db.seed import run_all
    from app.db.session import init_db
    from app.core.config import settings

    if not settings.is_production:
        init_db()
    with SessionLocal() as s:
        run_all(s)

    if args.once:
        print(json.dumps(scheduler.run_pending(SessionLocal, force=set(args.force)), indent=2, default=str))
        return
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    scheduler.run_forever(SessionLocal, tick_seconds=args.tick, stop=stop)


if __name__ == "__main__":
    main()
