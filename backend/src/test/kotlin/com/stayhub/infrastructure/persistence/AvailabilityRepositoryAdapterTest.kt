package com.stayhub.infrastructure.persistence

import com.stayhub.infrastructure.config.TestContainersConfiguration
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import java.time.LocalDate
import java.util.UUID

/**
 * Integration test for AvailabilityRepositoryAdapter (TEST-1).
 *
 * Uses the shared TestContainersConfiguration singleton (real PostgreSQL).
 * Flyway runs all migrations including seed data before the Spring context starts.
 *
 * Each test method inserts its own rows and tears them down so tests are isolated.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Import(TestContainersConfiguration::class)
@TestPropertySource(properties = ["spring.flyway.enabled=true"])
class AvailabilityRepositoryAdapterTest {

    @Autowired
    lateinit var databaseClient: DatabaseClient

    @Autowired
    lateinit var adapter: AvailabilityRepositoryAdapter

    // Use a seeded property so FK constraints are satisfied.
    private val propertyId = UUID.fromString("cccccccc-cccc-cccc-cccc-000000001001")

    // Test dates well outside the 90-day seed window so we don't clash with seed data.
    private val testFrom = LocalDate.of(2030, 1, 1)
    private val testTo   = LocalDate.of(2030, 1, 31)

    @BeforeEach
    fun cleanTestRows() = runTest {
        // Remove any availability / hold rows we inserted in previous test runs.
        databaseClient.sql(
            "DELETE FROM availability_hold WHERE property_id = :pid AND check_in >= :from",
        )
            .bind("pid", propertyId)
            .bind("from", testFrom)
            .then()
            .block()

        databaseClient.sql(
            "DELETE FROM availability WHERE property_id = :pid AND date >= :from",
        )
            .bind("pid", propertyId)
            .bind("from", testFrom)
            .then()
            .block()
    }

    // ------------------------------------------------------------------
    // Helper to insert an availability row (booked / blocked)
    // ------------------------------------------------------------------
    private fun insertAvailability(date: LocalDate, status: String) {
        databaseClient.sql(
            """
            INSERT INTO availability (id, property_id, date, is_available, status)
            VALUES (uuid_generate_v4(), :pid, :date, false, :status)
            """.trimIndent(),
        )
            .bind("pid", propertyId)
            .bind("date", date)
            .bind("status", status)
            .then()
            .block()
    }

    // ------------------------------------------------------------------
    // Helper to insert a hold row
    // ------------------------------------------------------------------
    private fun insertHold(
        checkIn: LocalDate,
        checkOut: LocalDate,
        heldUntil: String,       // SQL expression, e.g. "NOW() + INTERVAL '10 minutes'"
    ) {
        // Use a seeded guest so the FK on guest_id is satisfied.
        val guestId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-000000000001")
        databaseClient.sql(
            """
            INSERT INTO availability_hold
                (id, property_id, guest_id, check_in, check_out, held_until, created_at)
            VALUES
                (uuid_generate_v4(), :pid, :gid, :checkIn, :checkOut, $heldUntil, NOW())
            """.trimIndent(),
        )
            .bind("pid", propertyId)
            .bind("gid", guestId)
            .bind("checkIn", checkIn)
            .bind("checkOut", checkOut)
            .then()
            .block()
    }

    // ------------------------------------------------------------------
    // Test: no data → empty result
    // ------------------------------------------------------------------
    @Test
    fun `returns empty list when no unavailable dates exist in range`() = runTest {
        val result = adapter.findUnavailableDates(propertyId, testFrom, testTo)
        result.shouldBeEmpty()
    }

    // ------------------------------------------------------------------
    // Test: booked date returned
    // ------------------------------------------------------------------
    @Test
    fun `returns booked dates from availability table`() = runTest {
        insertAvailability(LocalDate.of(2030, 1, 10), "booked")
        insertAvailability(LocalDate.of(2030, 1, 15), "booked")

        val result = adapter.findUnavailableDates(propertyId, testFrom, testTo)

        result shouldHaveSize 2
        result.map { it.date } shouldBe listOf(
            LocalDate.of(2030, 1, 10),
            LocalDate.of(2030, 1, 15),
        )
        result.all { it.reason == "booked" } shouldBe true
    }

    // ------------------------------------------------------------------
    // Test: blocked date returned
    // ------------------------------------------------------------------
    @Test
    fun `returns blocked dates from availability table`() = runTest {
        insertAvailability(LocalDate.of(2030, 1, 5), "blocked")

        val result = adapter.findUnavailableDates(propertyId, testFrom, testTo)

        result shouldHaveSize 1
        result[0].date shouldBe LocalDate.of(2030, 1, 5)
        result[0].reason shouldBe "blocked"
    }

    // ------------------------------------------------------------------
    // Test: available status rows are NOT returned
    // ------------------------------------------------------------------
    @Test
    fun `does NOT return available status rows`() = runTest {
        // Insert an explicit 'available' row (should be filtered out).
        databaseClient.sql(
            """
            INSERT INTO availability (id, property_id, date, is_available, status)
            VALUES (uuid_generate_v4(), :pid, :date, true, 'available')
            """.trimIndent(),
        )
            .bind("pid", propertyId)
            .bind("date", LocalDate.of(2030, 1, 20))
            .then()
            .block()

        val result = adapter.findUnavailableDates(propertyId, testFrom, testTo)
        result.shouldBeEmpty()
    }

    // ------------------------------------------------------------------
    // Test: held dates from active hold are returned
    // ------------------------------------------------------------------
    @Test
    fun `returns held dates from active availability_hold records`() = runTest {
        // Hold covers Jan 5–7 (check_in inclusive, check_out exclusive → Jan 5 and 6)
        insertHold(
            LocalDate.of(2030, 1, 5),
            LocalDate.of(2030, 1, 7),
            "NOW() + INTERVAL '10 minutes'",
        )

        val result = adapter.findUnavailableDates(propertyId, testFrom, testTo)

        result shouldHaveSize 2
        result.map { it.date } shouldBe listOf(
            LocalDate.of(2030, 1, 5),
            LocalDate.of(2030, 1, 6),
        )
        result.all { it.reason == "held" } shouldBe true
    }

    // ------------------------------------------------------------------
    // Test: expired holds are NOT returned
    // ------------------------------------------------------------------
    @Test
    fun `does NOT return dates from expired holds`() = runTest {
        insertHold(
            LocalDate.of(2030, 1, 10),
            LocalDate.of(2030, 1, 12),
            "NOW() - INTERVAL '1 minute'", // already expired
        )

        val result = adapter.findUnavailableDates(propertyId, testFrom, testTo)
        result.shouldBeEmpty()
    }

    // ------------------------------------------------------------------
    // Test: booked wins over held on the same date
    // ------------------------------------------------------------------
    @Test
    fun `prefers booked over held when same date has both`() = runTest {
        // Insert a "booked" availability row for Jan 10.
        insertAvailability(LocalDate.of(2030, 1, 10), "booked")

        // Also create an active hold that covers Jan 10–11.
        insertHold(
            LocalDate.of(2030, 1, 10),
            LocalDate.of(2030, 1, 12),
            "NOW() + INTERVAL '10 minutes'",
        )

        val result = adapter.findUnavailableDates(propertyId, testFrom, testTo)

        // Jan 10 → booked (priority), Jan 11 → held (only hold covers it)
        result shouldHaveSize 2
        val jan10 = result.first { it.date == LocalDate.of(2030, 1, 10) }
        val jan11 = result.first { it.date == LocalDate.of(2030, 1, 11) }
        jan10.reason shouldBe "booked"
        jan11.reason shouldBe "held"
    }
}
