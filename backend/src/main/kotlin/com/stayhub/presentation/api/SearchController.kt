package com.stayhub.presentation.api

import com.stayhub.application.search.SearchPropertiesUseCase
import com.stayhub.domain.property.GeocodeService
import com.stayhub.domain.property.PropertySearchFilters
import com.stayhub.presentation.dto.search.*
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/properties")
class SearchController(
    private val searchUseCase: SearchPropertiesUseCase,
    private val geocodeService: GeocodeService,
) {
    @GetMapping("/search")
    suspend fun search(
        @RequestParam sw_lat: Double,
        @RequestParam sw_lng: Double,
        @RequestParam ne_lat: Double,
        @RequestParam ne_lng: Double,
        @RequestParam check_in: String,
        @RequestParam check_out: String,
        @RequestParam(required = false) min_price: Double?,
        @RequestParam(required = false) max_price: Double?,
        @RequestParam(required = false) property_type: String?,
        @RequestParam(required = false) bedrooms: Int?,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): SearchResultsResponse {
        val filters = PropertySearchFilters(
            minPrice = min_price,
            maxPrice = max_price,
            propertyType = property_type,
            bedrooms = bedrooms,
        )
        val result = searchUseCase.search(sw_lat, sw_lng, ne_lat, ne_lng, check_in, check_out, filters, page, size)

        return SearchResultsResponse(
            results = result.content.map {
                PropertySummaryDto(
                    id = it.id.toString(),
                    title = it.title,
                    photo_url = it.photos.firstOrNull()?.url ?: "",
                    nightly_rate_eur = it.nightlyRateEur,
                    cleaning_fee_eur = it.cleaningFeeEur,
                    location = LocationDto(it.location.lat, it.location.lng, it.location.city, it.location.country),
                    avg_rating = it.avgRating,
                    review_count = it.reviewCount,
                    property_type = it.propertyType,
                    max_guests = it.maxGuests,
                    bedrooms = it.bedrooms,
                )
            },
            pagination = PaginationDto(
                page = result.number + 1,
                size = result.size,
                total_results = result.totalElements,
                total_pages = result.totalPages,
            ),
        )
    }

    @GetMapping("/geocode")
    suspend fun geocode(@RequestParam q: String): GeocodeResponse {
        val results = geocodeService.geocode(q)
        return GeocodeResponse(results.map { result ->
            mapOf(
                "name" to result.name as Any,
                "lat" to result.lat as Any,
                "lng" to result.lng as Any,
                "bbox" to result.bbox as Any
            )
        })
    }
}
