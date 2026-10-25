# Authority coverage and source review

Coordinates work worldwide; verified routing coverage is deliberately incremental.
The shipped directory currently covers **City of Melbourne, Australia, waste and
litter only**. This is the municipality, not metropolitan Melbourne. India and
other countries currently return `country_not_covered`. No office is invented
when coverage is missing. A report can still enter private moderation.

## Melbourne pilot — reviewed 24 October 2026

- Authority: City of Melbourne (`au-vic-melbourne`).
- Boundary: [Municipal boundary, City of Melbourne Open Data](https://data.melbourne.vic.gov.au/explore/dataset/municipal-boundary/).
- [Source API](https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/municipal-boundary/records?limit=1).
  The `results[0].geo_shape.geometry` is copied without coordinate simplification
  into `api/data/authorities.json`; JSON formatting alone is changed.
- Attribution: Municipal boundary © City of Melbourne, licensed under
  [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
  Dataset metadata modified 26 February 2023; retrieved 24 October 2026.
  Download SHA-256: `70dfd432e4e07f180e81db7bba92e0eab37c78f3d0026468c90bc0ba5292e649`.
- Responsibility and social-account evidence:
  [Street cleaning and maintenance](https://www.melbourne.vic.gov.au/street-cleaning-and-maintenance).
  The page explicitly accepts litter, public bins and illegally dumped rubbish
  reports. Its footer links Facebook and Instagram `cityofmelbourne`.
- Scope: ordinary waste/litter reports in council public spaces. A moderator must
  still check the actual asset/land manager and issue before approving any post.
  Private land, hazardous spills, emergencies and non-council assets must not be
  treated as automatically assigned to the council. Other categories are held.
- Review expires 22 January 2027 (90 days). Verification means the listed sources
  were checked, not council endorsement or a guarantee of response.

For the audited Australian reference register, source coverage and maintenance
commands, see [Australian authority register](australia.md). Reference imports do
not change the verified routing scope above.

## Australia and India expansion

Seed government identities and boundaries first, then review responsibility and
social links separately. A boundary or a model-generated name alone is not enough.

Australia: start from ABS Local Government Areas / state government spatial data
and each council's own directory and service pages. Preserve LGA identifiers,
source vintage, licence, attribution and boundary history. Municipalities differ
from suburbs and metropolitan areas. Roads, water, pollution and public safety
may belong to state agencies or asset owners rather than the local council.

India: use the [Government of India Local Government Directory](https://lgdirectory.gov.in/)
for administrative identities/codes and current urban local bodies, with state or
municipal GIS/notifications for legally effective boundaries. LGD's homepage was
reachable during this review; no licensed, current municipal boundary for the
proposed Bengaluru pilot was verified. The Greater Bengaluru authority site did
not respond during research. Do not seed an old BBMP outline or guessed municipal
handles as current verified data. Bengaluru remains pending boundary, successor
body, responsibility, licence and official-account review.

For each additional municipality, submit a data PR with official identity,
boundary source/version/licence, service evidence per category, official website
links proving each social account, retrieval date, review expiry, and tests for
inside/outside/wrong-country/unsupported-category/expiry cases. Null handles are
valid; invented handles are not. Keep unreviewed candidates in documentation,
outside the runtime directory. Review every 90 days and immediately after a
boundary, responsibility or account change. Expired records fail closed.

The responsible maintainer reviews the data PR; moderators independently review
each report. AI may help discover candidates but cannot promote them into verified
routing data. Add countries incrementally using the same GeoJSON/ISO country
contract. Do not infer nationwide coverage from one pilot entry.

## QA

Use simulator GPS inside Melbourne municipality (for example -37.814, 144.9633)
with `AU` and waste. San Francisco's default simulator GPS should show US coverage
missing. Editing a town/country label never moves the coordinate. St Kilda is
outside the City of Melbourne municipality and must not match this seed.

The new India/Nepal/NZ reference inventory, source hashes, complaint-channel review
and explicit coverage gaps are recorded in
[multicountry-2026-10-25.md](multicountry-2026-10-25.md). These new local imports do
not change the released API's verified Melbourne-only responsibility coverage.

## India crime integration tracker

Use the [India crime reporting tracker](../india-crime/README.md) to work through
all 36 states/UTs and the pinned 784-district administrative baseline one scope at
a time. Each state file records official-source discovery, API/media/access gaps
and district mapping/resolution checkboxes. Tamil Nadu is the first API candidate;
no state or district crime integration is marked resolved. The
[initial API feasibility audit](india-crime-api-feasibility-2026-10-25.md) retains
the inspected Tamil Nadu and Madhya Pradesh contracts and their limitations.
