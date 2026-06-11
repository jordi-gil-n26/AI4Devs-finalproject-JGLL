---
name: backend-kotlin-spring
description: Use when implementing or modifying StayHub backend code (Kotlin + Spring Boot 4 + WebFlux + R2DBC + PostgreSQL/PostGIS). Encodes Clean Architecture layering, project conventions, and pitfalls observed in Phase 3+4 (e.g. @Service stereotype required, @JsonProperty for is_-prefixed Booleans, PostGIS cast direction, no @ConditionalOnBean, prices rounded to 2 decimals). Reference for use cases, repositories, controllers, DTOs, and tests in this codebase.
---

# StayHub Backend (Kotlin + Spring) Skill

## Stack

- Kotlin 2.0+ on JVM 21
- Spring Boot 4.x with **WebFlux + coroutines** (NOT MVC). All controllers use `suspend fun`.
- Spring Data **R2DBC** with `DatabaseClient`. PostgreSQL 16 + PostGIS 3.4. NamedParameter style queries only.
- Flyway migrations under `backend/src/main/resources/db/migration/`.
- Tests: JUnit 5, Kotest assertions, MockK, springmockk, TestContainers.

## Architecture (Clean / Hexagonal)

```
presentation  ──►  application  ──►  domain
infrastructure ──►  application  ──►  domain
```

Enforced by ArchUnit at `backend/src/test/kotlin/com/stayhub/architecture/CleanArchitectureTest.kt`. The build fails if any rule is violated. **If you find yourself wanting to import "the wrong way", move the type DOWN a layer instead of relaxing the rule.**

| Package | Contents | Notes |
|---|---|---|
| `domain/` | Entities, value objects, repository INTERFACES (ports), domain exceptions | Pure Kotlin. NO `org.springframework.*`, NO `jakarta.*`, NO Spring stereotypes. |
| `application/` | Use cases, application errors (`ApiException` + subtypes, `ErrorCode`, `ErrorDetail`) | Depends only on domain. Use cases are `@Service` annotated. Throw exceptions from `application/error/` ONLY — never `presentation/error/`. |
| `infrastructure/` | Repository adapters (implement domain ports), external API adapters (Mapbox), Spring config | `@Repository` / `@Service` here, not in domain. |
| `presentation/` | REST controllers, request/response DTOs, error response wire shape, middleware (`GlobalExceptionHandler`, `JwtAuthFilter`) | Depends on application. Controllers are humble — validate input, call use case, map response. |

## Reference Files (Copy Patterns From These)

| Want to write… | Read this first |
|---|---|
| Use case | `application/property/CalculatePriceUseCase.kt` (validation + use of repo + `@Service`) |
| Use case test | `test/.../application/property/CalculatePriceUseCaseTest.kt` (Kotest + MockK) |
| Repository adapter | `infrastructure/persistence/PropertyRepositoryAdapter.kt` (R2DBC `DatabaseClient`, NamedParameters, JSON column parsing) |
| Domain port | `domain/availability/AvailabilityRepository.kt` (interface, no Spring) |
| Controller | `presentation/api/PropertyController.kt` (`@RestController`, `suspend fun`, `@RequestParam` validation) |
| Controller test | `test/.../presentation/api/PropertyControllerTest.kt` (`@WebFluxTest` + `@MockkBean`) |
| DTO | `presentation/dto/property/PropertyDetailsResponse.kt` (snake_case JSON, `@JsonProperty` where needed) |
| Flyway migration | `resources/db/migration/V*.sql` (incrementing version, descriptive name) |

## Project Conventions

- **Package root:** `com.stayhub.<layer>.<bounded-context>` (e.g. `com.stayhub.application.property`).
- **JSON contract:** snake_case in JSON. Kotlin field can stay camelCase; Jackson converts automatically — EXCEPT for the cases below.
- **Booleans starting with `is`** (e.g. `is_verified`): Jackson strips the `is` prefix and renders as `_verified`. Annotate with `@get:JsonProperty("is_verified")` to fix. (Phase 4 bug.)
- **Pricing / money:** All Doubles representing money MUST be rounded to 2 decimals before serializing. Use a local `round2(value: Double): Double = Math.round(value * 100.0) / 100.0` helper. Storage is `DECIMAL(10,2)`. (Phase 4 bug: 34.199999...)
- **Validation:** Throw `application.error.ValidationException` (HTTP 400) or `application.error.NotFoundException` (HTTP 404) from use cases. `GlobalExceptionHandler` maps to error response.
- **Error codes:** `ErrorCode` is a pure enum in `application/error/`. The HTTP status mapping lives in `GlobalExceptionHandler` only.

## Spring / Framework Pitfalls (Phase 3+4 evidence)

| Mistake | Symptom | Rule |
|---|---|---|
| Forgot `@Service` on a use case | `UnsatisfiedDependencyException` at boot | All use cases need `@Service`; all repository adapters need `@Repository` |
| Used `@ConditionalOnBean` for ordering | Bean missing at startup | Don't use it. Just declare beans unconditionally. |
| `is_verified` in DTO | Jackson serialized as `_verified` | Add `@get:JsonProperty("is_verified")` |
| Money in `Double` no rounding | `34.199999...` in API response | Round to 2 decimals before returning |
| PostGIS `ST_Contains(geog, geog)` | `function st_contains(geography, geography) does not exist` | Cast `location::geometry` (column is `geography`); the envelope stays `geometry` |
| String interpolation in SQL | SQL injection / type errors | Always use NamedParameter (`:name`) bindings |
| Importing `presentation.*` from `application/` | ArchUnit fails build | Move the type to `application/error/` or `domain/`; never the other way |

## TDD Cycle (Mandatory)

For ANY testable change:

1. Write a failing test (RED). For use cases: assert validation rejection or repo call. For controllers: assert status + JSON shape.
2. Make it pass with the minimum implementation (GREEN).
3. Refactor with tests as safety net.
4. Commit. Tests must pass before push.

Use `./gradlew test` (clean: `./gradlew clean test`). Single test class: `./gradlew test --tests "com.stayhub.application.property.CalculatePriceUseCaseTest"`.

## Validation Before Marking Task Done

```bash
cd backend
./gradlew clean test          # all tests pass
./gradlew bootRun &            # app actually starts
sleep 30
curl http://localhost:8080/actuator/health   # {"status":"UP"}
# curl your new endpoint with a real seeded UUID, confirm 200 and contract shape
pkill -f bootRun
```

If the app fails to boot or curl returns 500 / wrong shape, the task is NOT done — even if `./gradlew test` is green. Unit tests mock dependencies; only the running app catches wiring/SQL/config bugs. (See `WAVE4-PHASE3-LEARNINGS.md`.)

## Seeded Data (for manual curl)

- Property IDs in `host` table: hosts have UUIDs `aaaaaaaa-aaaa-aaaa-aaaa-00000000000{N}` for N=1..3.
- Property IDs in `property` table: `cccccccc-cccc-cccc-cccc-00000000{Type}{N:03d}` — Barcelona = 1001..1005, Madrid = 2001..2004, Lisbon = 3001..3005, etc.
- 15 properties total, 0 reviews, 0 bookings (Phase 5 will seed bookings).

## Common Mistakes — Self-Check Before Commit

- ❌ Use case throws `presentation.error.ValidationException` → use `application.error.ValidationException`
- ❌ Domain interface imports `org.springframework.*` → keep domain framework-free (Page/Pageable from Spring Data is the one accepted leak as of June 2026)
- ❌ Controller does business logic → move to use case; controller stays humble
- ❌ Repository adapter uses string concat for SQL → NamedParameter only
- ❌ `bootRun` not actually tested → run it before reporting done
- ❌ Test passes with mocked DB → for repository changes, write integration test with TestContainers
