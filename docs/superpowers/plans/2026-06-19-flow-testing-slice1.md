# Flow Testing — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the backend flow-test pattern — a shared `AbstractFlowTest` harness plus the canonical booking-journey flow test (register → create booking → confirm) that exercises the real Spring context, HTTP codecs, security chain, and database.

**Architecture:** Full-context `@SpringBootTest(RANDOM_PORT)` with a `WebTestClient` bound to the real server (`bindToServer` + `@LocalServerPort`) so requests cross a real socket through the real WebFlux filter chain and Jackson codecs. Postgres/PostGIS comes from the existing Testcontainers singleton (`TestContainersConfiguration`). Payments use the wired `StubPaymentAdapter` (auto-succeeds), so the journey reaches a confirmed booking without external Stripe. Tests live in a new `com.stayhub.flow` package.

**Tech Stack:** Kotlin, Spring WebFlux, JUnit 5, Spring `WebTestClient`, Testcontainers (Postgres/PostGIS), Flyway, Gradle.

**Scope:** This is **Slice 1 of 4** from the design spec (`docs/superpowers/specs/2026-06-19-e2e-flow-testing-strategy-design.md`). Slices 2 (remaining backend flow tests), 3 (Playwright browser E2E + Dockerfiles + compose + CI job), and 4 (skills/process/CI enforcement) each get their own plan after Slice 1 lands.

**Branch/PR:** Per project workflow, implement on a feature branch in an isolated worktree (`git worktree add .worktrees/issue-<n>-flow-slice1 -b issue-<n>-flow-slice1`) and open one PR. Create a tracking GitHub issue first (referenced as `#<n>` below).

---

### Task 1: Shared flow-test base class

**Files:**
- Create: `backend/src/test/kotlin/com/stayhub/flow/AbstractFlowTest.kt`

- [ ] **Step 1: Write the base class**

```kotlin
package com.stayhub.flow

import com.stayhub.infrastructure.config.TestContainersConfiguration
import org.junit.jupiter.api.BeforeEach
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import java.time.Duration

/**
 * Base class for backend flow tests — multi-step user journeys exercised
 * against the full Spring context over real HTTP.
 *
 * Binds a [WebTestClient] to the actually-running server (`bindToServer` +
 * [LocalServerPort]) so requests cross a real socket through the real WebFlux
 * filter chain, Jackson codecs, and security — the layer that catches
 * wiring/codec/CORS bugs that mocked slice tests cannot (see issues #130, #132).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestContainersConfiguration::class)
@TestPropertySource(
    properties = [
        "spring.flyway.enabled=true",
        "stayhub.jwt.secret=test-secret-key-for-integration-tests-minimum-32-chars",
        "stayhub.jwt.issuer=stayhub",
    ]
)
abstract class AbstractFlowTest {

    @LocalServerPort
    private var port: Int = 0

    protected lateinit var http: WebTestClient

    @BeforeEach
    fun initWebTestClient() {
        http = WebTestClient.bindToServer()
            .baseUrl("http://localhost:$port")
            .responseTimeout(Duration.ofSeconds(30))
            .build()
    }

    /**
     * Registers a brand-new guest and returns the issued JWT. Email is
     * uniquified per call so journeys don't collide on the unique-email
     * constraint within the shared Testcontainers database.
     */
    protected fun registerGuest(
        email: String = "flow-${System.nanoTime()}@example.com",
        password: String = "pass1234",
    ): String =
        http.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"$email","password":"$password","first_name":"Flow","last_name":"Test"}"""
            )
            .exchange()
            .expectStatus().isCreated
            .expectBody(Map::class.java)
            .returnResult()
            .responseBody?.get("token") as? String
            ?: error("register did not return a token")
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && ./gradlew compileTestKotlin`
Expected: `BUILD SUCCESSFUL` (an abstract class with no `@Test` methods is not executed).

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/kotlin/com/stayhub/flow/AbstractFlowTest.kt
git commit -m "test(flow): add AbstractFlowTest harness for full-context journey tests (#<n>)"
```

---

### Task 2: Booking-journey flow test (register → create → confirm)

**Files:**
- Create: `backend/src/test/kotlin/com/stayhub/flow/BookingJourneyFlowTest.kt`

- [ ] **Step 1: Write the flow test**

Notes on the mechanics this encodes:
- Seed availability (migration `V7`) runs `CURRENT_DATE .. +89 days`; seed bookings occupy `+10..14`, `+20..23`, `+40..45`. `+70..+73` is free and in-window, so create returns `201`.
- The create response's `stripe_client_secret` is `"pi_stub_secret_<paymentIntentId>"` (see `StubPaymentAdapter`); strip that prefix to get the id confirm needs. The stub stores the intent as `SUCCEEDED`, so confirm transitions the booking to `confirmed`.
- Posting `check_in`/`check_out` as ISO strings and getting `201` (not a Jackson `CodecException`) keeps the #132 regression covered.

```kotlin
package com.stayhub.flow

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import java.time.LocalDate

/**
 * End-to-end booking journey at the API layer: a guest registers, creates a
 * booking (PENDING + Stripe PaymentIntent via the stub), then confirms it.
 *
 * Runs through the real WebFlux codecs (LocalDate (de)serialization — issue
 * #132), the real security chain (JWT-protected /api/v1/bookings — issue #130),
 * and the real database (Testcontainers + Flyway seed data).
 */
class BookingJourneyFlowTest : AbstractFlowTest() {

    // Seeded property (V7): "Cosy Eixample Apartment", Barcelona.
    private val propertyId = "cccccccc-cccc-cccc-cccc-000000001001"

    @Test
    fun `guest registers, books a property, and confirms payment`() {
        val token = registerGuest()

        // Free, in-window dates (clear of the +10..45 seed bookings).
        val checkIn = LocalDate.now().plusDays(70)
        val checkOut = checkIn.plusDays(3)

        // 1. Create booking — PENDING + PaymentIntent. Capture the response body
        //    as a Map (same pattern as registerGuest) to read the ids back.
        val created = http.post()
            .uri("/api/v1/bookings")
            .header("Authorization", "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"property_id":"$propertyId","check_in":"$checkIn","check_out":"$checkOut","guest_count":2}"""
            )
            .exchange()
            .expectStatus().isCreated
            .expectBody(Map::class.java)
            .returnResult()
            .responseBody!!

        val bookingId = created["booking_id"] as String
        val clientSecret = created["stripe_client_secret"] as String
        // #132 regression: dates round-tripped and pricing computed -> 3 nights.
        @Suppress("UNCHECKED_CAST")
        val priceBreakdown = created["price_breakdown"] as Map<String, Any?>
        assertThat((priceBreakdown["nights"] as Number).toInt()).isEqualTo(3)

        // Stub client secret is "pi_stub_secret_<paymentIntentId>".
        val paymentIntentId = clientSecret.removePrefix("pi_stub_secret_")

        // 2. Confirm booking after the (stubbed, auto-succeeded) payment.
        http.post()
            .uri("/api/v1/bookings/$bookingId/confirm")
            .header("Authorization", "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue("""{"payment_intent_id":"$paymentIntentId"}""")
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.id").isEqualTo(bookingId)
            .jsonPath("$.status").isEqualTo("confirmed")
            .jsonPath("$.guest_count").isEqualTo(2)
    }
}
```

- [ ] **Step 2: Run the flow test, expect PASS**

Run: `cd backend && ./gradlew test --tests "com.stayhub.flow.BookingJourneyFlowTest" --rerun-tasks`
Expected: `BUILD SUCCESSFUL`, 1 test passing. (The endpoints already work on `main`; this test proves the journey end-to-end. If it FAILS, stop — that is a real regression to investigate, not a test to weaken.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/kotlin/com/stayhub/flow/BookingJourneyFlowTest.kt
git commit -m "test(flow): booking journey create->confirm over real stack (#<n>)"
```

---

### Task 3: Fold in the redundant create-only integration test

The booking-journey flow test subsumes `BookingIntegrationTest` (create-only, added in #133) — including its #132 LocalDate regression coverage (it still posts ISO dates and asserts `201` + `nights`). Remove the duplicate so there is one canonical booking flow test.

**Files:**
- Delete: `backend/src/test/kotlin/com/stayhub/presentation/api/integration/BookingIntegrationTest.kt`

- [ ] **Step 1: Delete the redundant test**

```bash
git rm backend/src/test/kotlin/com/stayhub/presentation/api/integration/BookingIntegrationTest.kt
```

- [ ] **Step 2: Run the full suite, expect PASS**

Run: `cd backend && ./gradlew test --rerun-tasks`
Expected: `BUILD SUCCESSFUL`, 0 failures. (Net test count: prior total − 2 BookingIntegrationTest cases + 1 BookingJourneyFlowTest case.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(flow): fold create-only BookingIntegrationTest into BookingJourneyFlowTest (#<n>)"
```

---

### Task 4: Push and open the PR

- [ ] **Step 1: Push the branch**

Run: `git push -u origin issue-<n>-flow-slice1`

- [ ] **Step 2: Open the PR using the repo template**

Use `.github/pull_request_template.md` as the literal scaffold. Fill in:
- **What:** `AbstractFlowTest` harness + `BookingJourneyFlowTest` (register→create→confirm over the real stack); removed the redundant create-only `BookingIntegrationTest`.
- **Why:** Slice 1 of the flow-testing strategy (`docs/superpowers/specs/2026-06-19-e2e-flow-testing-strategy-design.md`); closes the flow-coverage gap behind #130/#132; absorbs the Layer-A portion of epic #134.
- **Impact:** Test-only; no production change; runs in the existing Backend (Gradle) CI gate, no new infra.
- **References:** issue `#<n>`, design spec, epic #134.
- Tick only genuinely-satisfied checklist items.

- [ ] **Step 3: Report** the PR URL and the test count delta. Do not close the tracking issue (leave that to the human).

---

## Roadmap (future plans — not part of this plan)

- **Slice 2 — breadth:** flow tests for auth, search, property-detail, booking error paths (409/404/401/validation), Stripe webhook; migrate `AuthIntegrationTest` + `CorsPreflightIntegrationTest` onto `AbstractFlowTest` and strengthen the weak `!= 401` assertion. Close epic #134.
- **Slice 3 — browser E2E:** `backend/Dockerfile` + `frontend/Dockerfile`, `docker-compose.e2e.yml`, Playwright harness + the single booking-journey browser spec (results-list navigation, stub-payment checkout), new non-blocking CI job.
- **Slice 4 — enforcement:** flow-coverage rules + slice-test pitfall note in `backend-kotlin-spring` and `frontend-nextjs-react` skills; `implement-issue` definition-of-done item; PR-template checkbox; promote the Layer-B CI job to a required check once stable.

## Self-review

- **Spec coverage (Slice 1 scope):** `AbstractFlowTest` harness ✓ (Task 1); booking-journey flow test over real context/codecs/security/DB ✓ (Task 2); fold in existing `BookingIntegrationTest` ✓ (Task 3); runs in existing Backend gate, no new infra ✓. Slices 2–4 explicitly deferred to their own plans ✓.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code; `#<n>` is the tracking-issue number filled at execution start (documented in Branch/PR), not a content placeholder.
- **Type/identifier consistency:** `AbstractFlowTest` exposes `http: WebTestClient` and `registerGuest(): String`; `BookingJourneyFlowTest` uses exactly those. Endpoint paths (`/api/v1/auth/register`, `/api/v1/bookings`, `/api/v1/bookings/{id}/confirm`), the `stripe_client_secret` → `pi_stub_secret_` derivation, and response fields (`booking_id`, `price_breakdown.nights`, `status`) match the controllers and `StubPaymentAdapter` verified in the codebase.
