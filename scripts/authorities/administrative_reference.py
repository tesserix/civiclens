"""Build auditable reference inventories. These records never grant routing rights."""

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urlsplit

SourceRow = dict[str, Any]


class AdministrativeRecord(TypedDict):
    id: str
    kind: str
    name: str
    countryCode: str
    regionCode: str | None
    officialUrl: str | None
    evidenceUrl: str
    verificationStatus: str
    details: dict[str, Any]


INDIA = "https://lgdirectory.gov.in/"
NEPAL = "https://data.humdata.org/dataset/cod-ab-npl"
NZ = "https://www.govt.nz/organisations/"


def text(row: SourceRow, key: str) -> str:
    value = row.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Missing source field: {key}")
    return " ".join(value.split())


def unit(
    identifier: str,
    country: str,
    name: str,
    level: str,
    parent: str | None,
    code: str,
    evidence: str,
    region: str | None = None,
    **details: Any,
) -> AdministrativeRecord:
    return {
        "id": identifier,
        "kind": "administrative_unit",
        "name": name,
        "countryCode": country,
        "regionCode": region,
        "officialUrl": None,
        "evidenceUrl": evidence,
        "verificationStatus": "reference",
        "details": {
            "adminLevel": level,
            "parentId": parent,
            "officialCode": code,
            "complaintApiStatus": "unknown",
            **details,
        },
    }


def india_records(
    states: list[SourceRow],
    districts: list[SourceRow],
    bodies: list[SourceRow],
    coverage: list[SourceRow],
) -> list[AdministrativeRecord]:
    records = [unit("in", "IN", "India", "country", None, "IN", INDIA)]
    state_codes = set()
    for row in states:
        code = text(row, "State Code")
        state_codes.add(code)
        records.append(
            unit(
                f"in-state-{code}",
                "IN",
                text(row, "State Name (In English)"),
                "state",
                "in",
                code,
                INDIA,
                f"IN-LGD-{code}",
                unitType="union_territory"
                if row.get("State or UT") == "U"
                else "state",
            )
        )
    district_state = {}
    for row in districts:
        code, state = text(row, "District Code"), text(row, "State Code")
        if state not in state_codes:
            raise ValueError("District references an unknown state")
        district_state[code] = state
        records.append(
            unit(
                f"in-district-{code}",
                "IN",
                text(row, "District Name(In English)"),
                "district",
                f"in-state-{state}",
                code,
                INDIA,
                f"IN-LGD-{state}",
            )
        )
    mappings: dict[str, set[str]] = defaultdict(set)
    for row in coverage:
        code, district = (
            row.get("Local Body Code", "").strip(),
            row.get("District Code", "").strip(),
        )
        if code and district:
            mappings[code].add(district)
    for row in bodies:
        code, state = text(row, "Local Body Code"), text(row, "State Code")
        if state not in state_codes:
            raise ValueError("Local body references an unknown state")
        known = sorted(d for d in mappings[code] if district_state.get(d) == state)
        unresolved = sorted(mappings[code] - set(known))
        parent = (
            f"in-district-{known[0]}"
            if len(known) == 1 and not unresolved
            else f"in-state-{state}"
        )
        records.append(
            unit(
                f"in-ulb-{code}",
                "IN",
                text(row, "Local Body Name (In English)"),
                "municipality",
                parent,
                code,
                INDIA,
                f"IN-LGD-{state}",
                localBodyTypeCode=text(row, "Localbody Type Code"),
                districtIds=[f"in-district-{d}" for d in known],
                unresolvedDistrictCodes=unresolved,
                districtCoverage="complete"
                if known and not unresolved
                else "needs_review",
            )
        )
    validate_hierarchy(records)
    return records


def nepal_records(
    provinces: list[SourceRow], districts: list[SourceRow], local: list[SourceRow]
) -> list[AdministrativeRecord]:
    records = [unit("np", "NP", "Nepal", "country", None, "NP", NEPAL)]
    for row in provinces:
        code = text(row, "adm1_pcode")
        records.append(
            unit(
                code.lower(),
                "NP",
                text(row, "adm1_name"),
                "province",
                "np",
                code,
                NEPAL,
                code,
            )
        )
    for row in districts:
        code = text(row, "adm2_pcode")
        records.append(
            unit(
                code.lower(),
                "NP",
                text(row, "adm2_name"),
                "district",
                text(row, "adm1_pcode").lower(),
                code,
                NEPAL,
                text(row, "adm1_pcode"),
            )
        )
    types = {
        "1": "metropolitan_city",
        "2": "sub_metropolitan_city",
        "3": "municipality",
        "4": "rural_municipality",
        "5": "other_administrative_area",
    }
    for row in local:
        code = text(row, "adm3_pcode")
        if not re.fullmatch(r"NP\d{7}", code) or code[-3] not in types:
            raise ValueError("Unknown Nepal administrative type code")
        records.append(
            unit(
                code.lower(),
                "NP",
                text(row, "adm3_name"),
                "protected_area" if code[-3] == "5" else "municipality",
                text(row, "adm2_pcode").lower(),
                code,
                NEPAL,
                text(row, "adm1_pcode"),
                unitType=types[code[-3]],
                sourceAdminTypeCode=code[-3],
            )
        )
    validate_hierarchy(records)
    return records


class CouncilLinks(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.href: str | None = None
        self.parts: list[str] = []
        self.links: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.parts = []

    def handle_data(self, data: str) -> None:
        if self.href:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.href:
            name = " ".join(" ".join(self.parts).split())
            special = {
                "Auckland Council",
                "Rotorua Lakes Council",
                "Chatham Islands Council",
                "Environment Canterbury",
                "Environment Southland",
            }
            if re.fullmatch(r"/organisations/[a-z0-9-]+/", self.href) and (
                re.search(r"(?:City|District|Regional) Council$", name)
                or name in special
            ):
                if self.href in self.links and self.links[self.href] != name:
                    raise ValueError(
                        "Conflicting council names for the same official profile"
                    )
                self.links[self.href] = name
            self.href = None


def govt_nz_url(value: str) -> str:
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or not parsed.hostname.endswith(".govt.nz")
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
    ):
        raise ValueError("Profile URL requires review before use")
    return value


def profile_links(html: str) -> dict[str, str]:
    class Profiles(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.links: dict[str, str] = {}

        def handle_starttag(
            self, tag: str, attrs: list[tuple[str, str | None]]
        ) -> None:
            attributes = dict(attrs)
            field = attributes.get("data-type")
            if tag == "a" and field is not None and field in ("website", "contactpage"):
                self.links[field] = govt_nz_url(attributes.get("href") or "")

    parser = Profiles()
    parser.feed(html)
    return parser.links


def nz_records(
    html: str, profiles: dict[str, Any] | None = None
) -> list[AdministrativeRecord]:
    parser = CouncilLinks()
    parser.feed(html)
    records = [unit("nz", "NZ", "New Zealand", "country", None, "NZ", NZ)]
    for href, name in sorted(parser.links.items()):
        slug = href.strip("/").split("/")[-1]
        row = unit(
            f"nz-{slug}",
            "NZ",
            name,
            "council",
            "nz",
            slug,
            f"https://www.govt.nz{href}",
            unitType="regional_council"
            if "Regional Council" in name or name.startswith("Environment ")
            else "local_council",
            hierarchyStatus="regional_and_territorial_overlap_not_inferred",
        )
        row["officialUrl"] = f"https://www.govt.nz{href}"
        profile = (profiles or {}).get(href, {})
        links = profile.get("links", {})
        if links.get("website"):
            row["officialUrl"] = govt_nz_url(links["website"])
        if links.get("contactpage"):
            row["details"]["contactUrl"] = govt_nz_url(links["contactpage"])
        if profile.get("sha256"):
            row["details"]["sourceProfileSha256"] = profile["sha256"]
        records.append(row)
    validate_hierarchy(records)
    return records


def validate_hierarchy(records: list[AdministrativeRecord]) -> None:
    if not records or len({r["countryCode"] for r in records}) != 1:
        raise ValueError("A reference snapshot must contain one country")
    by_id = {r["id"]: r for r in records}
    if len(by_id) != len(records):
        raise ValueError("Duplicate administrative code")
    roots = [r for r in records if r["details"]["parentId"] is None]
    if len(roots) != 1 or roots[0]["details"]["adminLevel"] != "country":
        raise ValueError("Exactly one country root is required")
    for row in records:
        current, seen = row, set[str]()
        while current["details"]["parentId"] is not None:
            if current["id"] in seen or len(seen) > 8:
                raise ValueError("Cyclic administrative hierarchy")
            seen.add(current["id"])
            parent = by_id.get(current["details"]["parentId"])
            if not parent or parent["countryCode"] != row["countryCode"]:
                raise ValueError("Missing or cross-country parent")
            allowed = {
                "state": {"country"},
                "province": {"country"},
                "region": {"country"},
                "district": {"country", "state", "province", "region"},
                "municipality": {"country", "state", "province", "region", "district"},
                "council": {"country", "region"},
                "protected_area": {
                    "country",
                    "state",
                    "province",
                    "region",
                    "district",
                },
            }
            if parent["details"]["adminLevel"] not in allowed.get(
                current["details"]["adminLevel"], set()
            ):
                raise ValueError("Invalid administrative parent level")
            current = parent


def source_csv(directory: Path, prefix: str) -> list[SourceRow]:
    paths = sorted(Path(directory).glob(f"{prefix}.*.csv"))
    if len(paths) != 1:
        raise ValueError(f"Provide exactly one dated {prefix} source CSV")
    with paths[0].open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def workbook_rows(path: Path, sheet: str) -> list[SourceRow]:
    import openpyxl

    book = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        rows = book[sheet].iter_rows(values_only=True)
        keys = next(rows)
        return [dict(zip((str(key) for key in keys), row)) for row in rows]
    finally:
        book.close()


def snapshot(
    source_id: str,
    source_url: str,
    licence: str,
    attribution: str,
    records: list[AdministrativeRecord],
    inputs: list[Path],
    retrieved: str,
) -> dict[str, Any]:
    validate_hierarchy(records)
    manifest = [
        {
            "file": Path(path).name,
            "sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(),
        }
        for path in inputs
    ]
    records[0]["details"]["sourceManifest"] = manifest
    records[0]["details"]["coverage"] = dict(
        Counter(r["details"]["adminLevel"] for r in records)
    )
    upstream = hashlib.sha256(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return {
        "sourceId": source_id,
        "sourceUrl": source_url,
        "licenceUrl": licence,
        "attribution": attribution,
        "retrievedAt": retrieved,
        "upstreamSha256": upstream,
        "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--india-dir", type=Path, required=True)
    parser.add_argument("--nepal-xlsx", type=Path, required=True)
    parser.add_argument("--nz-html", type=Path, required=True)
    parser.add_argument("--nz-profiles", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--retrieved-at", default=datetime.now(UTC).isoformat())
    parser.add_argument("--india-districts", type=int, default=784)
    parser.add_argument("--india-urban-bodies", type=int, default=5050)
    args = parser.parse_args()
    india = india_records(
        *(
            source_csv(args.india_dir, p)
            for p in [
                "states",
                "districts",
                "urban_local_bodies",
                "statewise_ulbs_coverage",
            ]
        )
    )
    nepal = nepal_records(
        *(workbook_rows(args.nepal_xlsx, f"npl_admin{n}") for n in [1, 2, 3])
    )
    profiles = (
        json.loads(args.nz_profiles.read_text())["entries"] if args.nz_profiles else {}
    )
    nz = nz_records(args.nz_html.read_text(), profiles)
    nz[0]["details"]["contactCoverage"] = {
        "councils": len(nz) - 1,
        "profiles": len(profiles),
        "websites": sum(
            bool(p.get("links", {}).get("website")) for p in profiles.values()
        ),
        "contactPages": sum(
            bool(p.get("links", {}).get("contactpage")) for p in profiles.values()
        ),
    }
    expected = [
        (
            india,
            {
                "state": 36,
                "district": args.india_districts,
                "municipality": args.india_urban_bodies,
            },
        ),
        (
            nepal,
            {"province": 7, "district": 77, "municipality": 753, "protected_area": 22},
        ),
        (nz, {"council": 78}),
    ]
    for records, counts in expected:
        actual = Counter(r["details"]["adminLevel"] for r in records)
        if any(actual[level] != count for level, count in counts.items()):
            raise ValueError(
                f"Source counts changed; review before importing: {dict(actual)}"
            )
    sources = [
        snapshot(
            "in-lgd-administrative",
            INDIA,
            "https://lgdirectory.gov.in/copyRightPolicy.do",
            "Ministry of Panchayati Raj, LGD; public 24 Oct 2026 CSV snapshot mirrored by ramSeraph/opendata. Reference identities and coverage only; no routing verification.",
            india,
            sorted(args.india_dir.glob("*.csv")),
            args.retrieved_at,
        ),
        snapshot(
            "np-hdx-administrative",
            NEPAL,
            "https://creativecommons.org/licenses/by/3.0/igo/",
            "OCHA FIS / HDX Nepal COD-AB v02, government-derived administrative references, reviewed 30 Oct 2025, published 14 Aug 2026. CC BY-IGO. Type-5 other areas are not municipalities. No boundary or responsibility verification granted.",
            nepal,
            [args.nepal_xlsx],
            args.retrieved_at,
        ),
        snapshot(
            "nz-govt-councils",
            NZ,
            "https://www.govt.nz/about/the-govt-nz-website/using-this-website/copyright-and-attribution/",
            "New Zealand Crown / Public Service Commission, Govt.nz organisation directory. 78 council identities and official-profile contact links, CC BY 4.0; overlapping jurisdiction and complaint routing require separate verification.",
            nz,
            [args.nz_html] + ([args.nz_profiles] if args.nz_profiles else []),
            args.retrieved_at,
        ),
    ]
    args.output.mkdir(parents=True, exist_ok=True)
    for source in sources:
        path = args.output / f"{source['sourceId']}.json"
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(source, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(path)
        print(
            json.dumps(
                {
                    "sourceId": source["sourceId"],
                    "records": len(source["records"]),
                    "counts": source["records"][0]["details"]["coverage"],
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                }
            )
        )


if __name__ == "__main__":
    main()
