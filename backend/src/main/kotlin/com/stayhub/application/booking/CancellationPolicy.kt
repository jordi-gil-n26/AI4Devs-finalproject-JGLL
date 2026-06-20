package com.stayhub.application.booking

import com.stayhub.domain.booking.Booking
import com.stayhub.domain.booking.BookingStatus
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

/**
 * Platform cancellation policy (spec FR-012), framework-free so both
 * GetBookingDetailsUseCase and CancelBookingUseCase can reuse it:
 *  - only CONFIRMED bookings are cancellable;
 *  - full refund if cancelled 48+ hours before check-in (measured against
 *    check-in at 00:00 UTC), otherwise no refund.
 */
object CancellationPolicy {

    val FREE_CANCELLATION_WINDOW: Duration = Duration.ofHours(48)

    fun canCancel(booking: Booking): Boolean =
        booking.status == BookingStatus.CONFIRMED

    fun isWithinFreeWindow(booking: Booking, now: Instant): Boolean {
        val checkInInstant = booking.checkIn.atStartOfDay(ZoneOffset.UTC).toInstant()
        return !now.isAfter(checkInInstant.minus(FREE_CANCELLATION_WINDOW))
    }

    /** Refund the guest would receive if the booking were cancelled at [now]. */
    fun refundAmountEur(booking: Booking, now: Instant): BigDecimal =
        if (isWithinFreeWindow(booking, now)) booking.totalEur else BigDecimal.ZERO.setScale(2)
}
