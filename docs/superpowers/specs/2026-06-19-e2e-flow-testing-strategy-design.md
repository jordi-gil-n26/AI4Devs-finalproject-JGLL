# Design: E2E & Flow Testing Strategy

**Date:** 2026-06-19
**Status:** Approved (brainstorming) — pending implementation plan
**Supersedes/absorbs:** issue #134 (API integration-test layer)

## Context & motivation

Three production defects reached `main` this cycle with green CI:

- **#130** — CORS preflight (`OPTIONS`) rejected with 401, so the browser could never call the public search endpoints.
- **#132** — a bare `@Bean ObjectMapper` in a `@Repository` overrode Spring Boot's mapper app-wide, dropping the JSR-310 module and breaking `LocalDate` (de)serialization on `POST /api/v1/bookings`.

Both were **wiring/config bugs**. The existing tests could not catch them because of *how* they are written, not gaps in effort:

- Backend controller tests use `WebTestClient.bindToController(...)` with **mocked use cases and no Spring context**, so they build their own codecs and never load the real security / CORS / `ObjectMapper` wiring.
- Frontend tests are **Vitest with mocked service hooks** — no real network, no real backend.
- The one full-context test that did `POST /bookings` only asserted `status != 401`, so a `500` codec error slipped by.
- The plan promised **Playwright E2E** and a `frontend/tests/e2e/` directory; neither was ever built.

The lesson: **no test exercised a real user journey through the real stack.** This design adds that coverage and makes it a standing requirement so it cannot be silently skipped again.

## Goals

1. Catch wiring/codec/security/flow bugs (the #130/#132 class) before merge.
2. Cover every user journey at a layer that uses the real Spring context, real HTTP codecs, real security, and a real database.
3. Add one high-fidelity browser test for the core revenue journey.
4. Make flow-test coverage a **mandatory, enforced** part of implementing any feature.

## Non-goals

- Replacing the existing fast unit/slice tests (they stay — they're valuable for branch-heavy logic).
- Browser E2E for every screen (against the test pyramid).
- Introducing RestAssured (WebFlux-native `WebTestClient` is preferred) or WireMock/MockServer now (there are currently **no real outbound HTTP calls** — Mapbox returns hardcoded demo data, Stripe is a `StubPaymentAdapter`, email is SMTP→MailHog; add WireMock when a real outbound integration lands, e.g. T026 Mapbox).

## Decisions (locked in brainstorming)

| Decision | Choice |
|---|---|
| Test layers | **Both**: backend flow tests (broad) + thin browser E2E |
| Browser-E2E scope | **Core booking journey only**: register/login → search → property → checkout → confirmation |
| Enforcement | **Docs + CI gate** |
| Browser-E2E CI orchestration | **(a) docker-compose the whole stack** — includes writing the (currently missing) backend + frontend Dockerfiles |

## Layer A — Backend flow tests (the workhorse)

Multi-step user journeys against the **full Spring context** + Testcontainers, via `WebTestClient` bound to a real server (`@SpringBootTest(RANDOM_PORT)` + `bindToServer` / `@LocalServerPort`).

- **Location:** `backend/src/test/kotlin/com/stayhub/flow/`
- **Shared base:** `AbstractFlowTest` — Testcontainers Postgres/PostGIS singleton (reuse existing `TestContainersConfiguration`), standard `@TestPropertySource` (flyway, jwt), and helpers (`registerGuest()`, `token()`, JSON builders).
- **Journeys (one test class each):**
  - Auth: register → login → token grants access to a protected endpoint.
  - Search: bbox + dates (+ filters) → results; geocode.
  - Property detail: details + availability + reviews + price calculation.
  - Booking happy path: create (201, hold + client secret) → confirm → appears in my-trips. *(create already added in #133 as `BookingIntegrationTest`; fold in here.)*
  - Booking error paths: 409 dates-unavailable, 404 missing property, 401 unauthenticated, 400 validation.
  - Stripe webhook: signature-verified event confirms a booking.
- **Why this catches the bugs:** real codecs (→ would catch #132), real security chain incl. CORS preflight (→ would catch #130), real DB.
- **CI:** **no new infra** — these are plain Gradle tests in the existing required **Backend (Gradle)** job (which already runs Testcontainers).

## Layer B — Browser E2E (thin, critical-path)

Playwright driving the real Next.js UI against the real backend + DB.

- **Location:** `frontend/tests/e2e/` + `@playwright/test` dev dependency + `test:e2e` script.
- **The one journey:** register/login → search → open a property → checkout → confirmation, asserting real rendered content at each step.
- **External-dependency handling (explicit):**
  - **Map:** navigate via the **search results list, not the Mapbox map** — the Mapbox token is a dummy, so tiles won't render. The E2E must not depend on the map.
  - **Payments:** checkout completes through the **`StubPaymentAdapter`** path (no real Stripe; frontend Stripe key is dummy). The test asserts the confirmation page renders from the stubbed payment flow.
- **CI orchestration — option (a), the whole stack via docker-compose:**
  - Write **`backend/Dockerfile`** and **`frontend/Dockerfile`** (these double as the deployment artifacts the plan calls for but never created).
  - Add a compose layer (e.g. `docker-compose.e2e.yml`) that builds/runs backend + frontend alongside the existing Postgres/PostGIS + MailHog services.
  - A new CI job: `docker compose ... up --build`, wait for health, run Playwright against the composed stack, upload the Playwright report.
  - **local == CI:** the same compose command runs the E2E locally.

## Relationship to issue #134

Issue #134 (API integration-test layer) is **absorbed into Layer A** — Layer A is the matured form of it. #134 will be closed/relabelled as part of the implementation plan so there is one coherent flow-testing effort, not two competing ones.

## Enforcement (docs + CI)

**Skills**
- `backend-kotlin-spring`: add a "Flow coverage required" rule — *a new/changed endpoint requires a Layer-A flow test in `com/stayhub/flow/`*. Add a pitfall note: *`@WebFluxTest` / `bindToController` slices with mocked use cases do not exercise the real context/codecs/security and cannot catch wiring bugs (see #130, #132) — a full-context flow test is mandatory.*
- `frontend-nextjs-react`: add a rule — *a new/changed user journey requires extending the Playwright E2E; Vitest-with-mocked-hooks is not sufficient for journey coverage.*

**Process**
- `implement-issue` "Verify before completion": add a hard checklist item — *flow/E2E coverage exists and is green for the touched journey; the task is not done until it is.*
- PR template: add a checkbox — *"Flow/E2E coverage added or updated for the touched journey (or N/A with reason)."*

**CI gating policy**
- Layer A: in the existing **Backend (Gradle)** required gate.
- Layer B: a new job, **non-blocking until the suite is stable**, then promoted to a **required** status check (avoids early browser-E2E flakiness blocking unrelated PRs).

## Rollout (slices — each its own issue + PR)

1. **Slice 1 — pattern:** `AbstractFlowTest` + the booking-journey backend flow test (fold in the existing `BookingIntegrationTest`). Proves the Layer-A pattern.
2. **Slice 2 — breadth:** remaining backend flow tests (auth, search, property, booking errors, webhook). Strengthen the weak `!= 401` assertion in `AuthIntegrationTest`.
3. **Slice 3 — browser E2E + containers:** backend + frontend Dockerfiles, `docker-compose.e2e.yml`, Playwright harness + the one journey, the new CI job (non-blocking).
4. **Slice 4 — enforcement:** skills edits, `implement-issue` DoD item, PR-template checkbox; promote the Layer-B job to required once green-stable.

## Risks & mitigations

- **Browser-E2E flakiness** → start the CI job non-blocking; use Playwright auto-waiting + stable selectors (`data-testid`); keep to one journey.
- **CI time from image builds (option a)** → cache Docker layers; the E2E job runs in parallel with the existing backend/frontend jobs.
- **Dockerfile drift vs. runtime** → the same images are used locally for E2E, so drift surfaces immediately.
- **Stub vs. real Stripe/Mapbox divergence** → acceptable now (no real integrations); revisit with WireMock when real outbound HTTP lands.
