#!/usr/bin/env python3
"""Create reference snapshots from free official Australian sources."""

import argparse
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

ABS_URL = (
    "https://geo.abs.gov.au/arcgis/rest/services/ASGS2026/LGA/FeatureServer/0/query?"
    + urlencode(
        {
            "where": "1=1",
            "outFields": "LGA_CODE_2026,LGA_NAME_2026,STATE_CODE_2026,STATE_NAME_2026",
            "returnGeometry": "false",
            "orderByFields": "LGA_CODE_2026",
            "f": "json",
        }
    )
)
GOV_URL = "https://www.directory.gov.au/sites/default/files/export.xml"
MAX_BYTES = 32 * 1024 * 1024
STATES = {
    "1": "AU-NSW",
    "2": "AU-VIC",
    "3": "AU-QLD",
    "4": "AU-SA",
    "5": "AU-WA",
    "6": "AU-TAS",
    "7": "AU-NT",
    "8": "AU-ACT",
    "9": "AU-OT",
    "Z": "AU-OUTSIDE",
}
ORGANISATIONS = {
    "organisation",
    "other_entities",
    "board",
    "portfolio",
    "commonwealth_parliament",
    "governor_general",
}
RELEVANT = re.compile(
    r"environment|climate|local government|home affairs|polic|waste|recycl",
    re.IGNORECASE,
)


class OfficialRedirects(HTTPRedirectHandler):
    def redirect_request(
        self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str
    ) -> Any:
        if urlparse(newurl).scheme != "https" or urlparse(newurl).hostname not in {
            "geo.abs.gov.au",
            "www.directory.gov.au",
            "directory.gov.au",
            "query.wikidata.org",
        }:
            raise ValueError("Source redirect left the official host allowlist")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def read_source(path: Path | None, url: str) -> bytes:
    if path is not None:
        with path.open("rb") as stream:
            body = stream.read(MAX_BYTES + 1)
    else:
        request = Request(
            url,
            headers={
                "User-Agent": "CivicLens-authority-register/0.1 (https://github.com/tesserix/civiclens)"
            },
        )
        with build_opener(OfficialRedirects()).open(request, timeout=30) as response:
            body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Source exceeds the 32 MB import limit")
    return body


def record(
    record_id: str,
    kind: str,
    name: str,
    evidence: str,
    region: str | None,
    details: dict[str, Any],
    website: str | None = None,
) -> dict[str, Any]:
    return {
        "id": record_id,
        "kind": kind,
        "name": name.strip(),
        "countryCode": "AU",
        "regionCode": region,
        "officialUrl": website
        if website
        and urlparse(website).scheme == "https"
        and urlparse(website).hostname
        else None,
        "evidenceUrl": evidence,
        "verificationStatus": "reference",
        "details": details,
    }


def abs_records(body: bytes) -> list[dict[str, Any]]:
    data = json.loads(body)
    if (
        data.get("error")
        or data.get("exceededTransferLimit")
        or not data.get("features")
    ):
        raise ValueError("ABS response is empty, failed or truncated")
    result = []
    ids = set()
    for feature in data["features"]:
        area = feature["attributes"]
        code, name = area["LGA_CODE_2026"], area["LGA_NAME_2026"]
        if code in ids or not re.fullmatch(r"[0-9Z]{5}", code) or not name:
            raise ValueError("ABS response has invalid or duplicate area identities")
        ids.add(code)
        special = any(
            word in name.lower()
            for word in (
                "unincorporated",
                "no usual address",
                "migratory",
                "outside australia",
            )
        )
        result.append(
            record(
                code,
                "statistical_area",
                name,
                "https://geo.abs.gov.au/arcgis/rest/services/ASGS2026/LGA/FeatureServer/0",
                STATES[area["STATE_CODE_2026"]],
                {
                    "statisticalOnly": True,
                    "specialArea": special,
                    "vintage": "2026",
                    "stateName": area["STATE_NAME_2026"],
                },
            )
        )
    return sorted(result, key=lambda entry: entry["id"])


def government_records(body: bytes) -> list[dict[str, Any]]:
    text = body.decode("utf-8-sig")
    if "\x00" in text or "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
        raise ValueError("XML entity declarations and non-UTF-8 input are not accepted")
    root = ET.fromstring(text)
    if root.tag != "response" or not list(root):
        raise ValueError("Government Directory response is empty or invalid")
    items: dict[str, ET.Element] = {}
    for item in root:
        identity = item.findtext("content_id", "")
        if not identity or identity in items:
            raise ValueError("Government Directory has duplicate or missing identities")
        items[identity] = item
    roles = {
        identity: item
        for identity, item in items.items()
        if item.findtext("type") == "portfolio_role"
        and RELEVANT.search(item.findtext("title", ""))
    }
    people = {item.findtext("contact") for item in roles.values()} - {None, ""}
    result = []
    for identity, item in items.items():
        source_kind = item.findtext("type", "")
        name = item.findtext("title", "").strip()
        if not name or re.search(
            r"dummy|do not delete|test organisation", name, re.IGNORECASE
        ):
            continue
        if source_kind in ORGANISATIONS:
            kind = "organisation"
        elif identity in roles:
            kind = "role"
        elif source_kind == "person" and identity in people:
            kind = "officeholder"
        else:
            continue
        details = {"sourceType": source_kind, "listingIsNotTenureVerification": True}
        for source_key, key in [
            ("unique_record_id", "sourceRecordId"),
            ("parent_organisation", "parentOrganisationId"),
            ("portfolio_id", "portfolioId"),
            ("role_belongs_to", "organisationId"),
            ("contact", "personId"),
            ("classification", "classification"),
            ("is_acting_current", "actingCurrent"),
        ]:
            value = item.findtext(source_key)
            if value:
                details[key] = value
        evidence = f"https://www.directory.gov.au/node/{identity}"
        result.append(
            record(
                identity, kind, name, evidence, None, details, item.findtext("website")
            )
        )
    if not result:
        raise ValueError("Government Directory contains no relevant records")
    return sorted(result, key=lambda entry: entry["id"])


VIC_URL = "https://www.viccouncils.asn.au/find-your-council/council-contacts-list"


class CouncilTable(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_table = False
        self.in_cell = False
        self.cell: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.anchor: list[str] | None = None
        self.href = ""
        self.rows: list[tuple[str, list[tuple[str, str]]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "table" and values.get("id") == "table19340":
            self.in_table = True
        if self.in_table and tag == "td":
            self.in_cell = True
            self.cell = []
            self.links = []
        if self.in_cell and tag == "a":
            self.href = values.get("href") or ""
            self.anchor = []

    def handle_data(self, text: str) -> None:
        if self.in_cell and text.strip():
            self.cell.append(text.strip())
        if self.anchor is not None:
            self.anchor.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.anchor is not None:
            self.links.append(("".join(self.anchor).strip(), self.href))
            self.anchor = None
        if tag == "td" and self.in_cell:
            if self.cell:
                self.rows.append((self.cell[0], self.links))
            self.in_cell = False
        if tag == "table":
            self.in_table = False


def council_key(name: str) -> str:
    name = re.sub(r"\s*\(Vic\)$", "", name, flags=re.IGNORECASE)
    return re.sub(
        r"[^a-z0-9]",
        "",
        re.sub(r"\b(city|rural|shire|borough|council)\b", "", name.lower()),
    )


def victoria_records(body: bytes, areas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    parser = CouncilTable()
    parser.feed(body.decode("utf-8"))
    if len(parser.rows) != 79:
        raise ValueError("Victorian source must contain all 79 council records")
    area_ids: dict[str, str] = {}
    for area in areas:
        if area["regionCode"] == "AU-VIC" and not area["details"]["specialArea"]:
            key = council_key(area["name"])
            if key in area_ids:
                raise ValueError("Ambiguous Victorian ABS identity")
            area_ids[key] = area["id"]
    records = []
    used = set()
    for name, links in parser.rows:
        identity = area_ids.get(council_key(name))
        if identity is None or identity in used:
            raise ValueError(
                "Victorian council cannot be uniquely linked to its ABS identity"
            )
        used.add(identity)
        website = next(
            (urljoin(VIC_URL, url) for label, url in links if label == name), None
        )
        councillors = next(
            (
                urljoin(VIC_URL, url)
                for label, url in links
                if re.search("councillors|administrators", label, re.IGNORECASE)
            ),
            None,
        )
        records.append(
            record(
                identity,
                "organisation",
                name,
                VIC_URL,
                "AU-VIC",
                {
                    "absSourceId": "au-abs-lga-2026",
                    "absRecordId": identity,
                    "councillorsUrl": councillors,
                    "mayorVerified": False,
                    "responsibilityNotVerified": True,
                    "sourceCopyrightUrl": "https://www.viccouncils.asn.au/copyright",
                },
                website,
            )
        )
    return sorted(records, key=lambda entry: entry["id"])


WIKIDATA_QUERY = 'SELECT ?council ?councilLabel ?website ?leader ?leaderLabel ?regionCode WHERE { ?council wdt:P31/wdt:P279* wd:Q1867183. FILTER NOT EXISTS { ?council wdt:P576 ?dissolved. } OPTIONAL { ?council wdt:P856 ?website. } OPTIONAL { ?council wdt:P6 ?leader. } OPTIONAL { ?council wdt:P131* ?state. ?state wdt:P300 ?regionCode. FILTER(STRSTARTS(?regionCode,"AU-")) } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }'
WIKIDATA_URL = "https://query.wikidata.org/sparql?" + urlencode(
    {"query": WIKIDATA_QUERY, "format": "json"}
)


def wikidata_key(name: str) -> str:
    name = re.sub(
        r"\s*\((?:NSW|Vic|Qld|SA|WA|Tas|NT|ACT)\)$", "", name, flags=re.IGNORECASE
    )
    name = re.sub(
        r"\b(of|the|and|aboriginal|regional|district|municipality|municipal|town|rural|city|shire|borough|council|region)\b",
        "",
        name.lower(),
    )
    return re.sub(r"[^a-z0-9]", "", name)


def wikidata_records(body: bytes, areas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    bindings = json.loads(body)["results"]["bindings"]
    if not bindings:
        raise ValueError("Wikidata council response is empty")
    identities = {
        (area["regionCode"], wikidata_key(area["name"])): area["id"]
        for area in areas
        if not area["details"]["specialArea"]
    }
    groups: dict[str, dict[str, Any]] = {}
    for row in bindings:
        council_url = row.get("council", {}).get("value", "")
        qid = council_url.rsplit("/", 1)[-1]
        if not re.fullmatch(r"Q[0-9]+", qid):
            raise ValueError("Wikidata council identity is invalid")
        label = row.get("councilLabel", {}).get("value", "")
        region = row.get("regionCode", {}).get("value", "")
        area_id = identities.get((region, wikidata_key(label)))
        if not area_id:
            continue
        group = groups.setdefault(
            qid,
            {
                "name": label,
                "region": region,
                "areas": set(),
                "websites": set(),
                "leaders": {},
            },
        )
        group["areas"].add(area_id)
        website = row.get("website", {}).get("value", "")
        parsed_url = urlparse(website)
        if (
            parsed_url.scheme in {"http", "https"}
            and parsed_url.hostname
            and not parsed_url.username
            and not parsed_url.password
        ):
            group["websites"].add(parsed_url._replace(query="", fragment="").geturl())
        leader = row.get("leader", {}).get("value", "").rsplit("/", 1)[-1]
        leader_name = row.get("leaderLabel", {}).get("value", "")
        if (
            re.fullmatch(r"Q[0-9]+", leader)
            and leader_name
            and not re.fullmatch(r"Q[0-9]+", leader_name)
        ):
            group["leaders"][leader] = leader_name
    area_groups: dict[str, set[str]] = {}
    for qid, group in groups.items():
        for area in group["areas"]:
            area_groups.setdefault(area, set()).add(qid)
    result: dict[str, dict[str, Any]] = {}
    for qid, group in groups.items():
        if len(group["areas"]) != 1:
            continue
        area = next(iter(group["areas"]))
        if len(area_groups[area]) != 1:
            continue
        evidence = f"https://www.wikidata.org/wiki/{qid}"
        result[qid] = record(
            qid,
            "organisation",
            group["name"],
            evidence,
            group["region"],
            {
                "absSourceId": "au-abs-lga-2026",
                "absRecordId": area,
                "candidateWebsiteUrls": sorted(group["websites"]),
                "tenureNotVerified": True,
                "responsibilityNotVerified": True,
            },
        )
        for leader, name in sorted(group["leaders"].items()):
            result[leader] = record(
                leader,
                "officeholder",
                name,
                f"https://www.wikidata.org/wiki/{leader}",
                group["region"],
                {"tenureNotVerified": True},
            )
            role_id = f"leadership-{qid}-{leader}"
            result[role_id] = record(
                role_id,
                "role",
                f"Council leader candidate: {group['name']}",
                evidence,
                group["region"],
                {
                    "personId": leader,
                    "councilId": qid,
                    "absRecordId": area,
                    "tenureNotVerified": True,
                    "sourceClaim": "P6",
                },
            )
    return sorted(result.values(), key=lambda entry: entry["id"])


def snapshot(
    source_id: str,
    url: str,
    attribution: str,
    timestamp: str,
    body: bytes,
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "sourceId": source_id,
        "sourceUrl": url,
        "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
        "attribution": attribution,
        "retrievedAt": timestamp,
        "upstreamSha256": hashlib.sha256(body).hexdigest(),
        "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--abs-file", type=Path)
    parser.add_argument("--government-file", type=Path)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--victoria-html", type=Path)
    parser.add_argument("--wikidata-file", type=Path)
    parser.add_argument("--with-wikidata", action="store_true")
    parser.add_argument("--retrieved-at", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    if args.fetch == bool(args.abs_file or args.government_file) or (
        not args.fetch and not (args.abs_file and args.government_file)
    ):
        raise ValueError("Choose --fetch or both downloaded source files")
    timestamp = datetime.fromisoformat(args.retrieved_at)
    if timestamp.utcoffset() is None:
        raise ValueError("Retrieval timestamp must include a timezone")
    abs_body = read_source(args.abs_file, ABS_URL)
    gov_body = read_source(args.government_file, GOV_URL)
    snapshots = {
        "abs-2026.json": snapshot(
            "au-abs-lga-2026",
            ABS_URL,
            "Australian Bureau of Statistics, ASGS Edition 4, LGA 2026; identities only, statistical use",
            args.retrieved_at,
            abs_body,
            abs_records(abs_body),
        ),
        "commonwealth.json": snapshot(
            "au-commonwealth-directory",
            GOV_URL,
            "Commonwealth of Australia, Australian Government Directory; contact details omitted",
            args.retrieved_at,
            gov_body,
            government_records(gov_body),
        ),
    }
    if args.wikidata_file or args.with_wikidata:
        wiki_body = read_source(args.wikidata_file, WIKIDATA_URL)
        wiki_time = (
            datetime.fromtimestamp(args.wikidata_file.stat().st_mtime, UTC).isoformat()
            if args.wikidata_file
            else args.retrieved_at
        )
        snapshots["wikidata-councils.json"] = snapshot(
            "au-council-wikidata-candidates",
            WIKIDATA_URL,
            "Wikidata contributors, CC0; council websites and leadership claims are unverified candidates, filtered against ABS 2026 identities.",
            wiki_time,
            wiki_body,
            wikidata_records(wiki_body, snapshots["abs-2026.json"]["records"]),
        )
        snapshots["wikidata-councils.json"]["licenceUrl"] = (
            "https://creativecommons.org/publicdomain/zero/1.0/"
        )
    if args.victoria_html:
        html_body = read_source(args.victoria_html, VIC_URL)
        saved_at = datetime.fromtimestamp(
            args.victoria_html.stat().st_mtime, UTC
        ).isoformat()
        snapshots["victoria-councils.json"] = snapshot(
            "au-vic-councils-mav",
            VIC_URL,
            "Council names and official/leadership website references from Municipal Association of Victoria, Vic Councils. No contact details or page prose retained; source copyright applies.",
            saved_at,
            html_body,
            victoria_records(html_body, snapshots["abs-2026.json"]["records"]),
        )
        snapshots["victoria-councils.json"]["licenceUrl"] = (
            "https://www.viccouncils.asn.au/copyright"
        )
    if args.fetch and (
        len(snapshots["abs-2026.json"]["records"]) < 500
        or len(snapshots["commonwealth.json"]["records"]) < 1000
    ):
        raise ValueError("National source counts are unexpectedly incomplete")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for filename, data in snapshots.items():
        target = args.output_dir / filename
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(target)
        print(f"{data['sourceId']}: {len(data['records'])} reference records")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, ET.ParseError) as error:
        print(f"Import preparation rejected: {error}", file=sys.stderr)
        sys.exit(1)

    except OSError:
        print(
            "Source refresh unavailable; no database records were changed. Check source and output files before retrying with the downloaded-file options.",
            file=sys.stderr,
        )
        sys.exit(1)
