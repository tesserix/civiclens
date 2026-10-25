# ADR 0011: Simple community discovery and participation

Focus CivicLens community development on discoverable questions, civic requests,
private Yes/No/Don't know responses, respectful discussion and closing results.
Reuse the existing Axum/Postgres/Expo participation implementation. No money,
trading, odds, wallets or betting settlement is introduced. Existing police work
is paused and preserved; no live migration or rollout is part of this work.

Add six curated topics, bounded full-text search, open/closed filters, newest and
closing-soon ordering, private saved cards and a My votes view. These are the core
discovery tools; do not rank open polls by private response counts or expose live
percentages. Approved-discussion counts can appear because those opinions are
already publicly visible. New cards/opinions still require independent moderation.

Migration 0011 adds a general topic default, indexed search and an account/card
watch table. Topic is optional in input and omitted when absent, preserving hashes
for old idempotency keys. New response fields are optional to support old servers.
A capability flag gates new client query fields and watch actions. Older servers
retain basic discovery/participation without unsupported queries.

Newest ordering retains UUID cursors. Closing-soon ordering uses a bounded encoded
deadline/ID cursor, validating the selected sort and deterministic tie ordering.
All queries preserve owner/moderator visibility and the stable statement timestamp
used by closed flags and aggregate results. Filters never bypass those rules.

Saving is a private, idempotent desired-state operation. Derive the account from
the session, enforce a database primary key and per-account cap under an advisory
lock. Saving requires an approved card. Removing a save is always allowed for the
account's own bookmark without disclosing the current card's existence or text.
Saved discovery excludes hidden/pending cards even when saved by their author.
No follower counts, notifications or private response lists are published.

The app gets a simple card feed, topic/search discovery and contextual voting with
explicit consent. Reuse the same vote panel in the feed and detail view. Save/vote
callbacks are scoped to the active account/card/token generation so late requests
cannot repopulate private caches after account changes. Offline failures retain
the choice for retry; stale deadlines and hidden cards are rechecked by the server.
Use native iOS choices and wrapping accessible controls; no Android emulator QA.

Sessions, saved interests and political opinions are sensitive assets. Unauthenticated
clients, another account and abusive creators cross the API trust boundary. Bound
queries, use parameterized SQL, expose nicknames only and audit state changes
without logging bodies or ballot choices. Update privacy/export/erasure inventory.

Keep the prior 10,000-account/10,000-ballot-per-day assumptions. One thousand saves
per account bounds bookmark storage at 10 million rows worst case; no broadcast
fan-out or new service is needed. Built-in Postgres full-text indexing avoids a
new search dependency. Verify expiry, privacy, cursor ties, filtering, watch quotas,
concurrent votes/saves and moderation against isolated Postgres. Measure realistic
feed/search query plans. Verify native creation, discovery, consent, voting,
discussion, saving and final results on Apple before delivery. Deployment still
requires the existing separately approved migration/release workflow.
