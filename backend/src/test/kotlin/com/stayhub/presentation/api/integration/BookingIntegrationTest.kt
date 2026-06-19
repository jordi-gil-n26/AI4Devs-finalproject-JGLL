package com.stayhub.presentation.api.integration

import com.stayhub.infrastructure.config.TestContainersConfiguration
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import java.time.LocalDate

/**
 * Full-stack integration test for the booking endpoint (issue #132).
 *
 * This exercises `POST /api/v1/bookings` through the **real** application
 * context and WebFlux JSON codecs — register a guest, obtain a JWT, then post a
 * booking with `java.time.LocalDate` `check_in`/`check_out` fields.
 *
 * Why this test exists: the existing `BookingControllerTest` uses
 * `WebTestClient.bindToController(...)` with mocked use cases and **no Spring
 * context**, so it builds its own (correct) Jackson codec and never loads the
 * application's `ObjectMapper` wiring. A misconfigured global `ObjectMapper`
 * (issue #132 — missing the JSR-310 module) therefore slipped past every
 * controller-slice test while breaking the endpoint in production. This test
 * loads the full context and asserts the booking is actually created, so a
 * regression in `java.time` (de)serialization fails here.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@ActiveProfiles("test")
@Import(TestContainersConfiguration::class)
@TestPropertySource(
    properties = [
        "spring.flyway.enabled=true",
        "stayhub.jwt.secret=test-secret-key-for-integration-tests-minimum-32-chars",
        "stayhub.jwt.issuer=stayhub",
    ]
)
class BookingIntegrationTest {

    @Autowired
    lateinit var webClient: WebTestClient

    // Seeded property (V7): "Cosy Eixample Apartment", Barcelona.
    private val propertyId = "cccccccc-cccc-cccc-cccc-000000001001"

    private fun registerAndGetToken(): String {
        val email = "booking-it-${System.nanoTime()}@example.com"
        return webClient.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"$email","password":"pass1234","first_name":"Book","last_name":"Test"}"""
            )
            .exchange()
            .expectStatus().isCreated
            .expectBody(Map::class.java)
            .returnResult()
            .responseBody?.get("token") as? String
            ?: error("register did not return a token")
    }

    @Test
    fun `POST bookings deserializes LocalDate fields and creates a booking`() {
        val token = registerAndGetToken()

        // Availability is seeded CURRENT_DATE..+89 days; seed bookings occupy
        // +10..14, +20..23, +40..45. +60..+63 is free and in-window.
        val checkIn = LocalDate.now().plusDays(60)
        val checkOut = checkIn.plusDays(3)

        webClient.post()
            .uri("/api/v1/bookings")
            .header("Authorization", "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"property_id":"$propertyId","check_in":"$checkIn","check_out":"$checkOut","guest_count":1}"""
            )
            .exchange()
            // Before the JSR-310 fix this returned a Jackson CodecException
            // (the request body could not be decoded), not 201.
            .expectStatus().isCreated
            .expectBody()
            .jsonPath("$.booking_id").exists()
            .jsonPath("$.reference_number").exists()
            .jsonPath("$.price_breakdown.nights").isEqualTo(3)
            .jsonPath("$.hold_expires_at").exists()
    }

    @Test
    fun `POST bookings echoes the parsed dates back through the confirmation detail`() {
        // A second guard that the dates survive the round-trip: the created
        // booking's nights must reflect the 4-night LocalDate range we sent.
        val token = registerAndGetToken()
        val checkIn = LocalDate.now().plusDays(65)
        val checkOut = checkIn.plusDays(4)

        webClient.post()
            .uri("/api/v1/bookings")
            .header("Authorization", "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"property_id":"$propertyId","check_in":"$checkIn","check_out":"$checkOut","guest_count":2}"""
            )
            .exchange()
            .expectStatus().isCreated
            .expectBody()
            .jsonPath("$.price_breakdown.nights").isEqualTo(4)
    }
}
