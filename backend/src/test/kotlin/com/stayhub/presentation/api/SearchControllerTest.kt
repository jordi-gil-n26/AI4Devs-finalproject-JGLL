package com.stayhub.presentation.api

import com.stayhub.application.search.SearchPropertiesUseCase
import com.stayhub.domain.property.GeocodeService
import com.stayhub.domain.property.Property
import com.stayhub.domain.property.PropertySearchFilters
import io.mockk.coEvery
import io.mockk.mockk
import org.junit.jupiter.api.Test
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.test.web.reactive.server.WebTestClient
import java.util.*

class SearchControllerTest {
    private val searchUseCase = mockk<SearchPropertiesUseCase>()
    private val geocodeService = mockk<GeocodeService>()
    private val controller = SearchController(searchUseCase, geocodeService)
    private val client = WebTestClient.bindToController(controller).build()

    @Test
    fun `GET search returns paginated properties`() {
        val mockProperty = Property(
            id = UUID.randomUUID(),
            title = "Barcelona Apt",
            description = "Nice",
            propertyType = "apartment",
            location = Property.Location(41.4, 2.16, "Barcelona", null, "Spain", "Main St"),
            maxGuests = 4,
            bedrooms = 2,
            bathrooms = 1,
            nightlyRateEur = 120.0,
            cleaningFeeEur = 50.0,
            amenities = listOf("WiFi"),
            houseRules = emptyList(),
            photos = emptyList(),
            hostId = UUID.randomUUID(),
            avgRating = 4.8,
            reviewCount = 10
        )
        val page = PageImpl(listOf(mockProperty), PageRequest.of(0, 20), 1)

        coEvery {
            searchUseCase.search(
                swLat = 41.35,
                swLng = 2.10,
                neLat = 41.45,
                neLng = 2.20,
                checkIn = "2025-06-01",
                checkOut = "2025-06-05",
                filters = any(),
                page = 1,
                size = 20
            )
        } returns page

        client.get()
            .uri("/api/v1/properties/search?sw_lat=41.35&sw_lng=2.10&ne_lat=41.45&ne_lng=2.20&check_in=2025-06-01&check_out=2025-06-05")
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.results[0].title").isEqualTo("Barcelona Apt")
            .jsonPath("$.pagination.total_results").isEqualTo(1)
    }
}
