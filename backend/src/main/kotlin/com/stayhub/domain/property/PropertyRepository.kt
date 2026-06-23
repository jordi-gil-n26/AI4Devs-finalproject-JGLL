package com.stayhub.domain.property

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.time.LocalDate
import java.util.*

interface PropertyRepository {
    suspend fun searchByBoundingBox(
        swLat: Double,
        swLng: Double,
        neLat: Double,
        neLng: Double,
        checkIn: LocalDate,
        checkOut: LocalDate,
        filters: PropertySearchFilters,
        pageable: Pageable,
    ): Page<Property>

    suspend fun findById(id: UUID): Property?
}

data class PropertySearchFilters(
    val minPrice: Double? = null,
    val maxPrice: Double? = null,
    val propertyType: String? = null,
    val bedrooms: Int? = null,
    val minGuests: Int? = null,
    val amenities: List<String> = emptyList(),
    val sortBy: String = "relevance",
)
