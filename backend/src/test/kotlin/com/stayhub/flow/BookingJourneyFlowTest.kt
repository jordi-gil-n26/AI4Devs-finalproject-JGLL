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
