
# Pingou → Sui Migration Plan

> ## 🔒 BUILD STATUS (2026-06-10) — scope narrowed & decisions locked
>
> The user narrowed scope to **three features**: (1) zkLogin auth, (2) Walrus profile
> storage, (3) encrypted contact exchange. **Dropped for now:** Ping Token economy,
> sybil work, indexer. The token sections below (§5.1, §7, parts of §6) are out of scope.
>
> **Locked decisions:** privacy via **Seal** ("Option A — full stack"): profiles are
> Seal-encrypted, ciphertext on Walrus, access enforced by an on-chain allowlist →
> each connection is a **sponsored** `add` tx → needs a Move package + Enoki gas-station
> backend. zkLogin via **Enoki HTTP API** (SDKs don't run on Hermes; Seal does).
> Target **testnet** first.
>
> **Done:** ✅ `move/pingou` package (`profile.move` + `seal_approve` allowlist policy),
> `sui move test` green (3/3). ✅ **Deployed to testnet** — package
> `0xe9e00a0f790fd1ec16fa122cb85978e5667db20178e866e3c1b930c0e0d8960d` (module
> `profile`); verified live (`create_and_keep` → shared `Profile` + owner `OwnerCap`).
> ✅ `.env.example`/`.env.local` Sui vars + `src/lib/sui/config.ts` (feature-flagged) +
> deps installed + `crypto.getRandomValues` polyfill in `_layout.tsx`.
> ✅ **Storage layer built & verified** — `src/lib/sui/{walrus,seal,profile,profileStore}.ts`;
> `scripts/sui-smoke.ts` proves Walrus round-trip + Seal encrypt→Walrus→decrypt gated by
> the live `seal_approve` policy (all green on testnet).
> ✅ **zkLogin client built** (typecheck-clean) — `enoki.ts` (HTTP, mirrors EnokiClient),
> `oauth.ts` (Google id_token via WebBrowser), `zkLogin.ts` (ZkLoginSigner + session
> persistence). `app.json` has the reverse-client-id URL scheme. Enoki public key +
> Google iOS client id in `.env.local`.
> ✅ **Sponsorship backend built & boot-tested** — `server/` (Enoki gas station,
> `/sponsor` + `/execute`, targets restricted to `profile::*`) + client `sponsor.ts`.
> ✅ **UI wired behind `SUI_ENABLED`** — signin (zkLogin), editProfile (Seal+Walrus+
> sponsored), home (decrypted profile + QR), scanner exchange (grant + decrypt peer),
> connectionDetail, connections list. Exchange access-control **verified on testnet**
> (`scripts/sui-exchange-smoke.ts`: gas-less reader denied→granted→decrypts).
> **Remaining (Task 6 final):** verify the full UI on a dev client (Google OAuth + a
> real sponsored tx, backend running w/ `ENOKI_PRIVATE_KEY`), decide existing-user
> migration, flip the flag + retire Supabase per feature.
> Gotchas recorded in memory: `SuiJsonRpcClient` (not `SuiClient`); Seal `Hmac256Ctr` +
> `getRandomValues` polyfill; `@mysten/enoki` SDK can't run on Hermes (we replicate it).
> See `~/.claude` memory `sui-migration-scope` and the session task list.

> **Status:** Draft / discussion. Decisions in §3 must be locked before Phase 1.
> **Goal:** Re-platform Pingou onto the Sui stack (Enoki, Walrus, Seal, a Move-based
> Ping Token) while keeping a thin backend for indexing/reads. Decentralize where it
> matters; centralize plumbing.
>
> ⚠️ The Sui ecosystem moves fast and parts of this doc are written from knowledge that
> may lag. Treat every version, SDK capability, and price as **"verify before building"**
> (see §11).

---

## 1. Why we're doing this

- **Auth pain today:** social login (Google/Apple) on Expo + Supabase has been a slog
  (redirect schemes, Apple's $99 gate, Expo Go limitations). Enoki **zkLogin** gives
  seedless social login that derives a Sui address, and **sponsored transactions** mean
  users never hold SUI or pay gas.
- **Tokens that mean something:** today "Ping Tokens" are a derived integer
  (`connections × 10`). On-chain they become a real, ownable, verifiable asset.
- **User-owned data:** private notes via **Seal** (encrypted, on-chain access policy),
  profile media via **Walrus** (decentralized blobs), social graph as Sui objects.

**Non-goals (for now):** full read-path decentralization (we keep an indexer), removing
all backends, on-chain messaging.

---

## 2. Current architecture (what we're migrating from)

**Client:** Expo (`expo-router`), React Native 0.81, NativeWind, Reanimated/Skia.

**Backend:** Supabase (Postgres + Auth + Storage).

| Concern | Today | Key files |
|---|---|---|
| Auth/session | Supabase Auth (email/pw, Apple native, Google OAuth WIP) | `src/lib/supabase.ts`, `src/context/AuthProvider.tsx`, `src/utils/signInUtils.ts` |
| Profiles | `profiles` table | `src/types/ProfileTypes.ts`, `supabase-migrations.sql` |
| Connections | `connections` table (`owner_id`, `connected_to`, `folder`, `note`) | `src/app/(tabs)/scanner.tsx`, `src/app/(tabs)/(connections)/index.tsx`, `src/app/connectionDetail.tsx` |
| Ping Tokens | derived `connections × 10` (UI only) | `src/app/(tabs)/index.tsx`, `src/components/profile/StatsRow.tsx` |
| Folders / events | `folders`, `event_participants` tables | `src/utils/events.ts`, `sql/event_folders.sql` |
| Media | Supabase Storage bucket `pfp` | profile edit flow |
| Feedback | haptics + ping sound | `src/utils/Feedback.ts`, `assets/sounds/ping.wav` |

---

## 3. Decisions to LOCK before Phase 1

These cascade through everything. Don't start coding until they're answered.

1. **Ping Token model — transferable economy vs. soulbound reputation?**
   - *Soulbound (recommended default):* earned, on-chain, verifiable, **non-transferable**.
     Few sybil/legal headaches. Implement with Sui **Closed-Loop Token** (`sui::token`)
     and a `TokenPolicy` that disallows `transfer`/`spend` (or allows only app-defined
     actions). Reads as "reputation."
   - *Transferable:* real economy, but inherits sybil farming + token economics + possible
     regulatory questions. Only choose if a tradable token is explicitly the product.
2. **Network target:** Testnet first (default), then mainnet. All addresses/package IDs
   are per-network — keep them in env config from day one.
3. **Mint authority:** who can mint Ping Tokens?
   - *App-gated (recommended):* backend holds a `MinterCap`; mints only after off-chain
     sybil checks pass. On-chain ownership, off-chain anti-fraud. Pragmatic.
   - *Fully on-chain:* mutual-attestation contract mints with no backend. Purer, but sybil
     resistance must live entirely in Move — much harder.
4. **Identity mapping:** a user = one zkLogin-derived Sui address. Do we keep an
   email↔address record for recovery/support, and where (backend vs none)?
5. **How decentralized, how fast?** Solo vs. team and timeline decide how aggressive each
   phase is.

---

## 4. Target architecture

```
┌──────────────────────────── Expo app (client) ─────────────────────────────┐
│  Enoki SDK (zkLogin + sponsored tx)   Sui TS SDK   Seal SDK   Walrus client │
└───────┬───────────────────┬────────────────┬───────────────────┬───────────┘
        │ login/proof        │ build tx        │ encrypt/decrypt    │ blobs
        ▼                    ▼                 ▼                    ▼
   ┌─────────┐         ┌───────────┐     ┌───────────┐       ┌───────────┐
   │  Enoki  │         │  Sui L1   │     │   Seal    │       │  Walrus   │
   │ (OAuth, │         │  (Move:   │     │ key servs │       │ (blob     │
   │  gas    │◄────────│ ping_token│     │ + on-chain│       │  storage) │
   │ station)│ sponsor │ connection│     │ policies) │       │           │
   └─────────┘         └─────┬─────┘     └───────────┘       └───────────┘
                             │ events
                             ▼
                  ┌──────────────────────┐
                  │ Indexer + thin API    │  ← keeps fast reads, sybil checks,
                  │ (Postgres cache)      │     mint authority (MinterCap)
                  └──────────────────────┘
```

**Component mapping (current → target):**

| Today | Target |
|---|---|
| Supabase Auth | **Enoki zkLogin** → Sui address; ephemeral key + ZK proof |
| `supabase.auth` session | Sui keypair/session via Enoki; `AuthProvider` exposes `address` |
| `connections` table (source of truth) | **`Connection` Move objects** on Sui; Postgres becomes a read cache (indexer) |
| Ping Tokens (derived int) | **`ping_token` Move module** (Closed-Loop Token) |
| `profiles` table | Public profile fields on-chain or in indexer; media on **Walrus** |
| `connections.note` (private) | **Seal-encrypted** blob, access policy = owner only |
| Storage bucket `pfp` | **Walrus** blob; URL/blob-id referenced on-chain or in indexer |
| Gas | **Enoki sponsored transactions** (app pays) |

---

## 5. Smart contracts (illustrative — not yet compile-checked)

A Move package `pingou` with two modules. **These are sketches to anchor the design.**

### 5.1 `ping_token` — Closed-Loop Token (soulbound-capable)

```move
module pingou::ping_token {
    use sui::coin::{Self, TreasuryCap};
    use sui::token::{Self, TokenPolicy, TokenPolicyCap};

    /// One-time witness.
    public struct PING_TOKEN has drop {}

    /// Held by the app/backend; gates minting (sybil enforcement off-chain).
    public struct MinterCap has key, store { id: UID }

    fun init(witness: PING_TOKEN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness, 0, b"PING", b"Ping Token",
            b"Earned by making real connections on Pingou",
            option::none(), ctx,
        );
        // Closed-loop policy: by default NO transfer/spend => effectively soulbound.
        let (policy, policy_cap) = token::new_policy(&treasury, ctx);
        token::share_policy(policy);

        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, ctx.sender());       // TreasuryCap → admin
        transfer::public_transfer(policy_cap, ctx.sender());     // PolicyCap   → admin
        transfer::transfer(MinterCap { id: object::new(ctx) }, ctx.sender());
    }

    /// Mint `amount` PING to `recipient`. App-gated via MinterCap.
    public fun mint(
        _cap: &MinterCap,
        treasury: &mut TreasuryCap<PING_TOKEN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let token = token::mint(treasury, amount, ctx);
        let req = token::transfer(token, recipient, ctx);
        token::confirm_with_treasury_cap(treasury, req, ctx);
    }
}
```

> If you go **transferable**, add a `TokenPolicy` rule allowing `transfer`/`spend`. If
> **soulbound**, leave those actions disallowed (default above).

### 5.2 `connection` — records a connection + triggers reward

```move
module pingou::connection {
    use sui::event;
    use pingou::ping_token::{MinterCap, mint};
    use sui::coin::TreasuryCap;

    const TOKENS_PER_CONNECTION: u64 = 10;

    /// Owned by the initiator; portable, user-owned edge in the social graph.
    public struct Connection has key, store {
        id: UID,
        owner: address,
        peer: address,
        created_at_ms: u64,
    }

    public struct Connected has copy, drop {
        owner: address, peer: address,
    }

    /// Called in a sponsored tx after the backend verifies the scan is legit.
    public fun connect(
        minter: &MinterCap,
        treasury: &mut TreasuryCap<...>,
        peer: address,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext,
    ) {
        let owner = ctx.sender();
        let c = Connection { id: object::new(ctx), owner, peer, created_at_ms: clock.timestamp_ms() };
        transfer::transfer(c, owner);
        mint(minter, treasury, TOKENS_PER_CONNECTION, owner, ctx);
        event::emit(Connected { owner, peer });
    }
}
```

**Sybil note:** because `connect` mints, it must be **gated** — either by `MinterCap`
co-signed by the backend after off-chain checks (recommended), or by an on-chain
mutual-attestation scheme (both parties submit signed intents). See §7.

---

## 6. Phased migration plan

### Phase 0 — Foundations (no user-visible change)
- [ ] Lock §3 decisions.
- [ ] Stand up Sui package skeleton (`pingou` Move package) + `sui move test`.
- [ ] Create Enoki app + API key; wire env config (`EXPO_PUBLIC_*`, network id, package id).
- [ ] Add a `sui/` workspace and a `services/` (indexer + thin API) workspace.
- [ ] Decide identity mapping + recovery story.

### Phase 1 — Auth + Ping Token (headline value)
- [ ] Deploy `ping_token` + `connection` to **testnet**.
- [ ] Integrate **Enoki zkLogin** in the client; `AuthProvider` exposes `{ address, ... }`
      instead of `{ session }`.
- [ ] Replace `signInUtils.ts` flows with zkLogin; keep email fallback only if needed.
- [ ] Connection flow (`scanner.tsx`): on successful scan → backend verifies → sponsored
      `connection::connect` tx → mints 10 PING. Keep the existing ping sound + toast UX.
- [ ] `StatsRow` reads **on-chain PING balance** (via indexer) instead of `connections × 10`.
- [ ] Backend: gas-sponsorship endpoint, `MinterCap` custody, sybil checks, event indexer
      → Postgres cache for fast reads.
- **Affected files:** `src/lib/supabase.ts` (→ `sui.ts`), `AuthProvider.tsx`,
  `signInUtils.ts`, `scanner.tsx`, `index.tsx`, `StatsRow.tsx`.

### Phase 2 — Storage (Walrus + Seal)
- [ ] Profile media (`pfp`) → **Walrus**; store blob id in indexer/on-chain.
- [ ] Private `note` → **Seal**-encrypted; access policy = connection owner only.
- [ ] Migrate existing media/notes (see §9).
- **Affected files:** profile edit flow, `connectionDetail.tsx` (note save/load).

### Phase 3 — Social graph on-chain + reduce backend
- [ ] `Connection` objects become source of truth; Postgres is pure cache.
- [ ] Folders/events model decision (on-chain vs indexer-only).
- [ ] Harden indexer; consider a managed Sui indexing service.

---

## 7. Sybil resistance (the hard part)

If tokens have *any* value, "scan to mint" is a money printer. Layers to combine:

- **App-gated minting:** only the backend `MinterCap` mints; it enforces rules first.
- **Rate limits / diminishing returns:** N connections/day; decreasing reward after a cap.
- **Mutual confirmation:** reward only when *both* parties act (scan + accept), not a
  one-sided scan of a public ID.
- **Uniqueness signals:** zkLogin ties an account to a real OAuth identity (raises cost of
  fakes); optionally proof-of-personhood later.
- **Anomaly detection:** cluster/graph analysis on the indexer (rings of mutual scans).

> Decide this **before** tokens are live. Retrofitting anti-fraud after a token has value
> is painful.

---

## 8. Cost / economics model (estimate before building)

"Decentralized" ≠ free — the cost model just shifts. Model these:

- **Sponsored gas:** you pay gas for every connection/mint. At scale this is a real line
  item and an abuse vector — rate-limit and budget it.
- **Walrus storage:** pay (in WAL) per blob + storage epochs. Profile images add up.
- **Seal:** key-server usage / threshold decryption costs.
- **Enoki:** tiered pricing for zkLogin + gas station.
- **Indexer/API hosting:** unchanged-ish from today.

Build a simple spreadsheet: cost-per-active-user/month across the four above.

---

## 9. Data migration (existing Supabase users) — DECIDED: clean break (2026-06-12)

**Decision: clean break.** New Sui accounts; the social graph is NOT migrated. Optional
profile pre-fill only if a real user base warrants it.

**Why connections can't be migrated (the deciding factor):** old connections were *public*
bookmarks (RLS `using (true)` — anyone could read any profile). New profiles are
Seal-encrypted; reading one requires the owner's on-chain **grant** (`add`, owner's
`OwnerCap` + a tx). So an edge A→B can't be data-copied — it only exists once **both**
parties have migrated *and* each re-grants the other. That's a re-handshake gated on mutual
migration, requiring an indexer + cap custody to automate — far more than a re-scan costs.
Combined with early stage (testnet, solo) and the fact that importing public profiles +
faking grants undercuts the whole trust model, clean break wins.

**What this means concretely:**
- Sui-mode code already starts every user fresh — **no migration code to write**.
- `connections`, `folders`, `event_participants`, `pfp` bucket: **not migrated**. Re-scan
  to rebuild connections.
- **Profile pre-fill: NOT building it** (confirmed 2026-06-12 — no real users). The
  email-match pre-fill was only justified by an existing user base; with none, it's dead
  weight. New users just fill the form once.

**Supabase retirement (after `EXPO_PUBLIC_SUI_ENABLED=true`):** keep it read-only briefly
as a safety net, then drop per feature: profiles → connections → storage → auth. Folders/
events screens are still Supabase-only (outside the 3-feature scope) — leave or rebuild later.

---

## 10. Security considerations

- **Key custody:** `TreasuryCap`/`MinterCap`/`PolicyCap` are bearer authority. Store in a
  KMS/HSM, never in client or repo. Rotate plan.
- **zkLogin ephemeral keys & nonces:** handle the OAuth nonce/ephemeral-key lifecycle
  correctly on React Native (this is the fiddly bit — see §11).
- **Sponsorship endpoint:** authenticate it; it can spend your gas. Rate-limit + validate
  the exact tx shape it will sponsor.
- **Seal policies:** get the access policy right — a wrong policy leaks private notes.
- **Replay/abuse:** idempotency on the mint path; one reward per unique connection pair.

---

## 11. Verify before building (fast-moving / RN gotchas)

- [ ] **Enoki React Native / Expo support** — zkLogin flow on mobile (OAuth redirect +
      ephemeral keys + proving). Confirm current SDK story; we may proxy via backend.
      (Note: this overlaps the Expo redirect-scheme work we already did — dev client, not
      Expo Go, custom scheme registration.)
- [ ] **Walrus** mainnet status, client SDK, blob lifetime/pricing.
- [ ] **Seal** maturity (beta?), key-server options, mobile client support.
- [ ] **Sui Closed-Loop Token (`sui::token`)** API specifics for soulbound policies.
- [ ] **Indexer** options (custom vs managed) + current GraphQL/RPC capabilities.
- [ ] Move `connect` mint pattern — confirm `TreasuryCap` + closed-loop `confirm` flow.

> I can pull the current state of each of these on request and update this doc.

---

## 12. Rough effort (very approximate, solo dev)

| Phase | Scope | Ballpark |
|---|---|---|
| 0 | Foundations, decisions, skeletons | ~1 week |
| 1 | Enoki auth + token + sponsored connect + indexer | ~3–5 weeks |
| 2 | Walrus media + Seal notes | ~2–3 weeks |
| 3 | On-chain graph + backend reduction | ~2–4 weeks |

Biggest unknowns/risk: RN zkLogin integration, sybil design, Walrus/Seal maturity.

---

## 13. Open questions

1. Ping Token: **soulbound or transferable?**
2. Testnet → mainnet timeline?
3. App-gated mint or fully on-chain attestation?
4. Migrate existing users (email-link) or clean break?
5. Solo or team, and what's the target ship date?

---

*Next step: answer §3, then I can scaffold the `pingou` Move package and the Enoki auth
integration behind a feature flag so the current Supabase app keeps working during migration.*
