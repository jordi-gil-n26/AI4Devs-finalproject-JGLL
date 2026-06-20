package com.stayhub.domain.booking

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.time.LocalDate
import java.util.UUID

/**
 * Domain port for Booking persistence.
 *
 * Implementations live in the infrastructure layer and must carry the
 * Spring @Repository annotation there — this interface intentionally has
 * no Spring stereotypes so the domain remains framework-free.
 *
 * Note: Page/Pageable from Spring Data are an accepted pragmatic leak
 * into the domain for this project (documented in the backend skill).
 */
interface BookingRepository {
    suspend fun save(booking: Booking): Booking
    suspend fun findById(id: UUID): Booking?
    suspend fun findByGuestId(guestId: UUID, pageable: Pageable): Page<Booking>
    suspend fun findByGuestIdAndCategory(
        guestId: UUID,
        category: TripCategory,
        today: LocalDate,
        pageable: Pageable,
    ): Page<Booking>
    suspend fun findByPropertyAndDates(propertyId: UUID, checkIn: LocalDate, checkOut: LocalDate): List<Booking>
}
