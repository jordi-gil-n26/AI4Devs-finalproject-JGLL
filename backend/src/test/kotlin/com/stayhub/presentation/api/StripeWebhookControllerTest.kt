package com.stayhub.presentation.api

import com.stayhub.application.booking.ConfirmBookingUseCase
import com.stayhub.domain.availability.AvailabilityHold
import com.stayhub.domain.availability.AvailabilityHoldRepository
import com.stayhub.domain.booking.Booking
import com.stayhub.domain.booking.BookingStatus
import com.stayhub.presentation.middleware.GlobalExceptionHandler
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.reactive.server.WebTestClient
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * WebFlux controller slice test for [StripeWebhookController].
 *
 * Tests use bindToController (no Spring context). The controller is wired
 * with mocked use case and hold repository. Signature verification can be
 * bypassed by leaving webhookSecret blank (dev mode).
 */
class StripeWebhookControllerTest {

    private val confirmBookingUseCase = mockk<ConfirmBookingUseCase>(relaxed = true)
    private val holdRepository = mockk<AvailabilityHoldRepository>(relaxed = true)

    private fun controller(secret: String = ""): StripeWebhookController =
        StripeWebhookController(confirmBookingUseCase, holdRepository, secret)

    private fun client(secret: String = ""): WebTestClient =
        WebTestClient.bindToController(controller(secret))
            .controllerAdvice(GlobalExceptionHandler::class.java)
            .build()

    private val bookingId = UUID.fromString("11111111-2222-3333-4444-555555555555")
    private val guestId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    private val propertyId = UUID.fromString("cccccccc-cccc-cccc-cccc-000000001001")

    private val sampleHold = AvailabilityHold(
        id = UUID.randomUUID(),
        propertyId = propertyId,
        guestId = guestId,
        checkIn = LocalDate.of(2030, 6, 1),
        checkOut = LocalDate.of(2030, 6, 4),
        heldUntil = Instant.parse("2030-06-01T10:00:00Z"),
        createdAt = Instant.parse("2030-06-01T09:50:00Z"),
    )

    private val sampleConfirmedBooking = Booking(
        id = bookingId,
        propertyId = propertyId,
        guestId = guestId,
        referenceNumber = "BK-20300601-ABC123",
        checkIn = LocalDate.of(2030, 6, 1),
        checkOut = LocalDate.of(2030, 6, 4),
        guestCount = 2,
        nights = 3,
        nightlyRateEur = BigDecimal("100.00"),
        cleaningFeeEur = BigDecimal("50.00"),
        serviceFeeEur = BigDecimal("36.00"),
        taxEur = BigDecimal("0.00"),
        totalEur = BigDecimal("386.00"),
        status = BookingStatus.CONFIRMED,
        stripePaymentIntentId = "pi_test_abc123",
        cancellationReason = null,
        cancelledAt = null,
        createdAt = Instant.now(),
        updatedAt = Instant.now(),
    )

    // ─── payment_intent.succeeded ─────────────────────────────────────────

    @Test
    fun `payment_intent_succeeded with guestId metadata calls ConfirmBookingUseCase and returns 200`() {
        val paymentIntentId = "pi_test_abc123"
        val body = """
            {
              "type": "payment_intent.succeeded",
              "data": {
                "object": {
                  "id": "$paymentIntentId",
                  "metadata": {
                    "booking_id": "$bookingId",
                    "guest_id": "$guestId"
                  }
                }
              }
            }
        """.trimIndent()

        coEvery {
            confirmBookingUseCase.execute(bookingId, paymentIntentId, guestId)
        } returns sampleConfirmedBooking

        client()
            .post()
            .uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .exchange()
            .expectStatus().isOk

        coVerify(exactly = 1) {
            confirmBookingUseCase.execute(bookingId, paymentIntentId, guestId)
        }
    }

    @Test
    fun `payment_intent_succeeded with missing metadata logs warning and returns 200 without calling use case`() {
        val body = """
            {
              "type": "payment_intent.succeeded",
              "data": {
                "object": {
                  "id": "pi_test_no_meta",
                  "metadata": {}
                }
              }
            }
        """.trimIndent()

        client()
            .post()
            .uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .exchange()
            .expectStatus().isOk

        coVerify(exactly = 0) {
            confirmBookingUseCase.execute(any(), any(), any())
        }
    }

    // ─── payment_intent.payment_failed ───────────────────────────────────

    @Test
    fun `payment_intent_payment_failed releases hold and returns 200`() {
        val body = """
            {
              "type": "payment_intent.payment_failed",
              "data": {
                "object": {
                  "id": "pi_test_failed",
                  "metadata": {
                    "booking_id": "$bookingId"
                  }
                }
              }
            }
        """.trimIndent()

        coEvery {
            holdRepository.findActiveHoldForDates(any(), any(), any())
        } returns null

        client()
            .post()
            .uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .exchange()
            .expectStatus().isOk
    }

    @Test
    fun `payment_intent_payment_failed with no booking_id in metadata returns 200 without crashing`() {
        val body = """
            {
              "type": "payment_intent.payment_failed",
              "data": {
                "object": {
                  "id": "pi_test_failed_no_meta",
                  "metadata": {}
                }
              }
            }
        """.trimIndent()

        client()
            .post()
            .uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .exchange()
            .expectStatus().isOk
    }

    // ─── Unknown event type ───────────────────────────────────────────────

    @Test
    fun `unknown event type returns 400`() {
        val body = """{"type":"charge.succeeded","data":{"object":{}}}"""

        client()
            .post()
            .uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .exchange()
            .expectStatus().isBadRequest
    }

    // ─── Signature verification ───────────────────────────────────────────

    @Test
    fun `missing Stripe-Signature header with no webhook secret returns 200 (dev mode)`() {
        val body = """{"type":"payment_intent.succeeded","data":{"object":{"id":"pi_x","metadata":{}}}}"""

        // No secret configured → dev mode, skip signature check
        client(secret = "")
            .post()
            .uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .exchange()
            .expectStatus().isOk
    }

    @Test
    fun `missing Stripe-Signature header with webhook secret set returns 400`() {
        val body = """{"type":"payment_intent.succeeded","data":{"object":{"id":"pi_x","metadata":{}}}}"""

        // Secret is configured → missing signature must be rejected
        client(secret = "whsec_test_secret")
            .post()
            .uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            // Deliberately NO Stripe-Signature header
            .exchange()
            .expectStatus().isBadRequest
    }

    @Test
    fun `invalid Stripe-Signature header with webhook secret set returns 400`() {
        val body = """{"type":"payment_intent.succeeded","data":{"object":{"id":"pi_x","metadata":{}}}}"""

        client(secret = "whsec_test_secret")
            .post()
            .uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Stripe-Signature", "t=fake,v1=badhash")
            .bodyValue(body)
            .exchange()
            .expectStatus().isBadRequest
    }
}
