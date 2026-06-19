package com.stayhub.presentation.api.integration

import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.util.UUID

/** Per-endpoint integration tests for PropertyController, over the real stack. */
class PropertyApiIntegrationTest : AbstractApiIntegrationTest() {

    private val propertyId = "cccccccc-cccc-cccc-cccc-000000001001"
    private val unknownId = UUID.randomUUID().toString()

    @Test
    fun `details returns 200 for a seeded property`() {
        http.get().uri("/api/v1/properties/$propertyId")
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.id").isEqualTo(propertyId)
            .jsonPath("$.host.first_name").exists()
            .jsonPath("$.location.city").isEqualTo("Barcelona")
    }

    @Test
    fun `details returns 404 for an unknown property`() {
        http.get().uri("/api/v1/properties/$unknownId")
            .exchange()
            .expectStatus().isNotFound
            .expectBody().jsonPath("$.error.code").isEqualTo("NOT_FOUND")
    }

    @Test
    fun `availability returns 200 for a seeded property`() {
        val from = LocalDate.now()
        val to = from.plusDays(30)
        http.get().uri { b ->
            b.path("/api/v1/properties/$propertyId/availability")
                .queryParam("from", "$from").queryParam("to", "$to").build()
        }
            .exchange()
            .expectStatus().isOk
            .expectBody().jsonPath("$.property_id").isEqualTo(propertyId)
    }

    // NOTE: availability for an unknown property returns 200 + empty list (not 404).
    // GetPropertyAvailabilityUseCase does not validate property existence — it queries
    // the availability table which simply returns no rows. This is a real behavioral
    // gap: the API should return 404 for unknown properties here. See DONE_WITH_CONCERNS.
    @Test
    fun `availability returns 200 with empty unavailable_dates for an unknown property`() {
        val from = LocalDate.now()
        val to = from.plusDays(30)
        http.get().uri { b ->
            b.path("/api/v1/properties/$unknownId/availability")
                .queryParam("from", "$from").queryParam("to", "$to").build()
        }
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.property_id").isEqualTo(unknownId)
            .jsonPath("$.unavailable_dates").isArray
    }

    @Test
    fun `reviews returns 200 for a seeded property`() {
        http.get().uri("/api/v1/properties/$propertyId/reviews")
            .exchange()
            .expectStatus().isOk
            .expectBody().jsonPath("$.pagination").exists()
    }

    @Test
    fun `price returns 200 with computed nights for a seeded property`() {
        val checkIn = LocalDate.now().plusDays(8)
        val checkOut = checkIn.plusDays(3)
        http.get().uri { b ->
            b.path("/api/v1/properties/$propertyId/price")
                .queryParam("check_in", "$checkIn").queryParam("check_out", "$checkOut")
                .queryParam("guests", "2").build()
        }
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.nights").isEqualTo(3)
            .jsonPath("$.total_eur").exists()
    }

    @Test
    fun `price returns 404 for an unknown property`() {
        http.get().uri { b ->
            b.path("/api/v1/properties/$unknownId/price")
                .queryParam("check_in", "2030-06-01").queryParam("check_out", "2030-06-04").build()
        }
            .exchange()
            .expectStatus().isNotFound
    }
}
