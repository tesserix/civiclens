"""Fetch only the public Govt.nz council profiles, at a bounded rate."""

import argparse
import hashlib
import json
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.robotparser import RobotFileParser

from administrative_reference import CouncilLinks, profile_links


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory-html", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    agent = "CivicLens-reference-refresh/1.0 (+https://github.com/tesserix/civiclens)"

    def download(url: str) -> bytes:
        return subprocess.run(
            ["curl", "-fsSL", "--max-time", "25", "--user-agent", agent, url],
            capture_output=True,
            check=True,
        ).stdout

    policy_url = "https://www.govt.nz/robots.txt"
    robot = RobotFileParser(policy_url)
    try:
        robot.parse(download(policy_url).decode().splitlines())
    except (subprocess.SubprocessError, UnicodeError):
        raise SystemExit(
            "Govt.nz robots policy could not be retrieved. No bulk profile requests were made; retain existing source records and review access before retrying."
        ) from None
    links = CouncilLinks()
    links.feed(args.directory_html.read_text())
    if len(links.links) != 78:
        raise ValueError("Council count changed; review before fetching")
    lock = threading.Lock()
    last_start = [0.0]
    delay = max(0.65, float(robot.crawl_delay(agent) or 0))

    def fetch(href: str) -> tuple[str, dict[str, Any]]:
        url = f"https://www.govt.nz{href}"
        if not robot.can_fetch(agent, url):
            return href, {"url": url, "error": "robots_disallow", "links": {}}
        with lock:
            time.sleep(max(0, last_start[0] + delay - time.monotonic()))
            last_start[0] = time.monotonic()
        try:
            raw = download(url)
            slug = href.strip("/").split("/")[-1]
            (args.output / f"{slug}.html").write_bytes(raw)
            values = profile_links(raw.decode())
            return href, {
                "url": url,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "retrievedAt": datetime.now(UTC).isoformat(),
                "links": values,
            }
        except (subprocess.SubprocessError, UnicodeError, ValueError):
            return href, {
                "url": url,
                "error": "fetch_or_link_review_required",
                "links": {},
            }

    with ThreadPoolExecutor(max_workers=2) as executor:
        entries = dict(executor.map(fetch, sorted(links.links)))
    receipt = {"retrievedAt": datetime.now(UTC).isoformat(), "entries": entries}
    path = args.output / "profiles.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(receipt, indent=2) + "\n")
    temporary.replace(path)
    print(
        json.dumps(
            {
                "profiles": len(entries),
                "websites": sum(
                    bool(e["links"].get("website")) for e in entries.values()
                ),
                "contactPages": sum(
                    bool(e["links"].get("contactpage")) for e in entries.values()
                ),
                "needsReview": sum("error" in e for e in entries.values()),
            }
        )
    )


if __name__ == "__main__":
    main()
