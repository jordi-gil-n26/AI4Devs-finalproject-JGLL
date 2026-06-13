package com.stayhub.presentation.api

import com.stayhub.application.booking.BookingPriceBreakdown
import com.stayhub.application.booking.ConfirmBookingUseCase
import com.stayhub.application.booking.CreateBookingCommand
import com.stayhub.application.booking.CreateBookingResult
import com.stayhub.application.booking.CreateBookingUseCase
import com.stayhub.application.error.UnauthorizedException
import com.stayhub.application.error.ValidationException
import com.stayhub.domain.booking.Booking
import com.stayhub.domain.property.PropertyRepository
import com.stayhub.presentation.dto.booking.BookingDetailResponse
import com.stayhub.presentation.dto.booking.ConfirmBookingRequest
import com.stayhub.presentation.dto.booking.CreateBookingRequest
import com.stayhub.presentation.dto.booking.CreateBookingResponse
import jakarta.validation.Valid
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.ReactiveSecurityContextHolder
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/**
 * POST /api/v1/bookings           — create a booking and Stripe PaymentIntent.
 * POST /api/v1/bookings/{id}/confirm — confirm after successful payment.
 *
 * Both routes require a Bearer JWT (enforced by SecurityConfig). The JWT
 * subject is treated as the guestId (UUID); a malformed subject yields 401.
 * Property repository is used only to enrich the confirm response — Slice A
 * does not yet have a dedicated GetBookingDetailsUseCase.
 */
@RestController
@RequestMapping("/api/v1/bookings")
class BookingController(
    private val createBookingUseCase: CreateBookingUseCase,
    private val confirmBookingUseCase: ConfirmBookingUseCase,
    private val propertyRepository: PropertyRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    suspend fun create(
        @Valid @RequestBody request: CreateBookingRequest,
    ): CreateBookingResponse {
        val guestId = currentGuestId()

        val propertyId = request.property_id ?: throw ValidationException("property_id is required")
        val checkIn = request.check_in ?: throw ValidationException("check_in is required")
        val checkOut = request.check_out ?: throw ValidationException("check_out is required")

        log.info(
            "Create booking: guestId={} propertyId={} checkIn={} checkOut={} guestCount={}",
            guestId, propertyId, checkIn, checkOut, request.guest_count,
        )

        val result = createBookingUseCase.execute(
            CreateBookingCommand(
                propertyId = propertyId,
                guestId = guestId,
                checkIn = checkIn,
                checkOut = checkOut,
                guestCount = request.guest_count,
            )
        )

        return result.toResponse()
    }

    @PostMapping("/{bookingId}/confirm")
    suspend fun confirm(
        @PathVariable bookingId: UUID,
        @Valid @RequestBody request: ConfirmBookingRequest,
    ): BookingDetailResponse {
        val guestId = currentGuestId()
        val paymentIntentId = request.payment_intent_id
            ?: throw ValidationException("payment_intent_id is required")

        log.info("Confirm booking: bookingId={} guestId={} paymentIntentId={}", bookingId, guestId, paymentIntentId)

        val confirmed = confirmBookingUseCase.execute(bookingId, paymentIntentId, guestId)
        return confirmed.toDetailResponse()
    }

    /**
     * Reads the JWT subject (set by [com.stayhub.infrastructure.config.JwtAuthFilter])
     * from the reactive security context and converts it to the guest UUID.
     *
     * Returns 401 if the context is empty or the subject is malformed.
     */
    private suspend fun currentGuestId(): UUID {
        val authentication = ReactiveSecurityContextHolder.getContext()
            .map { it.authentication }
            .awaitSingleOrNull()
            ?: throw UnauthorizedException()

        val raw = when (val principal = authentication.principal) {
            is String -> principal
            is org.springframework.security.core.userdetails.UserDetails -> principal.username
            else -> principal?.toString()
        } ?: throw UnauthorizedException()

        return runCatching { UUID.fromString(raw) }
            .getOrElse {
                throw UnauthorizedException("JWT subject is not a valid UUID: $raw")
            }
    }

    private fun CreateBookingResult.toResponse(): CreateBookingResponse =
        CreateBookingResponse(
            booking_id = bookingId.toString(),
            reference_number = referenceNumber,
            price_breakdown = priceBreakdown.toDto(),
            stripe_client_secret = stripeClientSecret,
            hold_expires_at = holdExpiresAt.toString(),
        )

    private fun BookingPriceBreakdown.toDto(): CreateBookingResponse.PriceBreakdownDto =
        CreateBookingResponse.PriceBreakdownDto(
            nights = nights,
            nightly_rate_eur = nightlyRateEur,
            subtotal_eur = subtotalEur,
            cleaning_fee_eur = cleaningFeeEur,
            service_fee_eur = serviceFeeEur,
            tax_eur = taxEur,
            total_eur = totalEur,
        )

    private suspend fun Booking.toDetailResponse(): BookingDetailResponse {
        val property = runCatching { propertyRepository.findById(propertyId) }.getOrNull()
        val subtotal = (nightlyRateEur.toDouble() * nights)
        return BookingDetailResponse(
            id = id.toString(),
            reference_number = referenceNumber,
            property = property?.let {
                BookingDetailResponse.PropertyDto(
                    id = it.id.toString(),
                    title = it.title,
                    photo_url = it.photos.firstOrNull()?.url ?: "",
                    city = it.location.city,
                    country = it.location.country,
                    address = it.location.address,
                )
            },
            check_in = checkIn.toString(),
            check_out = checkOut.toString(),
            guest_count = guestCount,
            status = status.name.lowercase(),
            price_breakdown = BookingDetailResponse.PriceBreakdownDto(
                nights = nights,
                nightly_rate_eur = nightlyRateEur.toDouble(),
                subtotal_eur = subtotal,
                cleaning_fee_eur = cleaningFeeEur.toDouble(),
                service_fee_eur = serviceFeeEur.toDouble(),
                tax_eur = taxEur.toDouble(),
                total_eur = totalEur.toDouble(),
            ),
            cancellation_policy = "Full refund if cancelled 48+ hours before check-in",
            can_cancel = true,
            refund_amount_eur = null,
            created_at = createdAt.toString(),
        )
    }
}
