package com.stayhub.infrastructure.persistence

import com.stayhub.domain.availability.AvailabilityRepository
import com.stayhub.domain.availability.UnavailableDate
import io.r2dbc.spi.Row
import kotlinx.coroutines.reactive.awaitSingle
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.stereotype.Repository
import java.time.LocalDate
import java.util.UUID

@Repository
class AvailabilityRepositoryAdapter(
    private val databaseClient: DatabaseClient,
) : AvailabilityRepository {

    override suspend fun findUnavailableDates(
        propertyId: UUID,
        from: LocalDate,
        to: LocalDate,
    ): List<UnavailableDate> {
        // Query explicit blocked/booked dates from availability table
        val availabilityQuery = """
            SELECT date, status as reason
            FROM availability
            WHERE property_id = :propertyId
              AND date >= :from
              AND date <= :to
              AND status IN ('booked', 'blocked')
        """.trimIndent()

        val availabilityDates = databaseClient.sql(availabilityQuery)
            .bind("propertyId", propertyId)
            .bind("from", from)
            .bind("to", to)
            .map { row, _ ->
                UnavailableDate(
                    date = row.get("date", LocalDate::class.java)!!,
                    reason = row.get("reason", String::class.java)!!,
                )
            }
            .all()
            .collectList()
            .awaitSingle()

        // Query active holds (held_until > NOW()) that overlap with the range
        // A hold covers dates from check_in (inclusive) to check_out (exclusive)
        val holdsQuery = """
            SELECT generate_series(check_in, check_out - INTERVAL '1 day', INTERVAL '1 day')::date as date,
                   'held' as reason
            FROM availability_hold
            WHERE property_id = :propertyId
              AND held_until > NOW()
              AND check_in <= :to
              AND check_out > :from
        """.trimIndent()

        val heldDates = databaseClient.sql(holdsQuery)
            .bind("propertyId", propertyId)
            .bind("from", from)
            .bind("to", to)
            .map { row, _ ->
                UnavailableDate(
                    date = row.get("date", LocalDate::class.java)!!,
                    reason = "held",
                )
            }
            .all()
            .collectList()
            .awaitSingle()

        // Merge: availability_table dates + held dates, deduplicate by date (booked/blocked takes priority over held)
        val allDates = (availabilityDates + heldDates)
            .groupBy { it.date }
            .map { (_, dates) ->
                // Prefer booked/blocked over held
                dates.firstOrNull { it.reason != "held" } ?: dates.first()
            }
            .sortedBy { it.date }

        return allDates
    }
}
