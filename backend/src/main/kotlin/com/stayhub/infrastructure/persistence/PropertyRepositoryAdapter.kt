package com.stayhub.infrastructure.persistence

import com.fasterxml.jackson.databind.ObjectMapper
import com.stayhub.domain.property.Property
import com.stayhub.domain.property.PropertyRepository
import com.stayhub.domain.property.PropertySearchFilters
import io.r2dbc.spi.Row
import kotlinx.coroutines.reactive.awaitFirstOrNull
import kotlinx.coroutines.reactive.awaitSingle
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.stereotype.Repository
import java.math.BigDecimal
import java.util.*

@Repository
class PropertyRepositoryAdapter(
    private val databaseClient: DatabaseClient,
    private val objectMapper: ObjectMapper,
) : PropertyRepository {
    override suspend fun searchByBoundingBox(
        swLat: Double,
        swLng: Double,
        neLat: Double,
        neLng: Double,
        filters: PropertySearchFilters,
        pageable: Pageable,
    ): Page<Property> {
        // Build parameterized query with window function to get count in single query
        // ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326) creates geography polygon
        val query = """
            SELECT p.id, p.host_id, p.title, p.description, p.property_type,
                   ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lng,
                   p.city, p.region, p.country, p.address,
                   p.max_guests, p.bedrooms, p.bathrooms,
                   p.nightly_rate_eur, p.cleaning_fee_eur,
                   p.amenities, p.house_rules, p.photos,
                   p.avg_rating, p.review_count,
                   COUNT(*) OVER() as total_count
            FROM property p
            WHERE ST_Contains(
                ST_MakeEnvelope(:swLng, :swLat, :neLng, :neLat, 4326),
                p.location::geometry
            )
            AND p.is_active = true
        """.trimIndent() + buildString {
            // Add price filters with parameterized queries
            if (filters.minPrice != null) {
                append(" AND p.nightly_rate_eur >= :minPrice")
            }
            if (filters.maxPrice != null) {
                append(" AND p.nightly_rate_eur <= :maxPrice")
            }
            if (filters.propertyType != null) {
                append(" AND p.property_type = :propertyType")
            }
            if (filters.bedrooms != null) {
                append(" AND p.bedrooms >= :bedrooms")
            }
            if (filters.minGuests != null) {
                append(" AND p.max_guests >= :minGuests")
            }

            // Sort
            when (filters.sortBy) {
                "price_asc" -> append(" ORDER BY p.nightly_rate_eur ASC")
                "price_desc" -> append(" ORDER BY p.nightly_rate_eur DESC")
                "rating" -> append(" ORDER BY p.avg_rating DESC NULLS LAST")
                else -> append(" ORDER BY p.id") // relevance
            }

            append(" LIMIT :pageSize OFFSET :offset")
        }

        // Build parameterized query
        var sqlSpec = databaseClient.sql(query)
            .bind("swLng", swLng)
            .bind("swLat", swLat)
            .bind("neLng", neLng)
            .bind("neLat", neLat)
            .bind("pageSize", pageable.pageSize)
            .bind("offset", pageable.offset)

        // Bind filter parameters
        if (filters.minPrice != null) {
            sqlSpec = sqlSpec.bind("minPrice", filters.minPrice)
        }
        if (filters.maxPrice != null) {
            sqlSpec = sqlSpec.bind("maxPrice", filters.maxPrice)
        }
        if (filters.propertyType != null) {
            sqlSpec = sqlSpec.bind("propertyType", filters.propertyType)
        }
        if (filters.bedrooms != null) {
            sqlSpec = sqlSpec.bind("bedrooms", filters.bedrooms)
        }
        if (filters.minGuests != null) {
            sqlSpec = sqlSpec.bind("minGuests", filters.minGuests)
        }

        // Execute query and map results
        val results = sqlSpec
            .map { row, _ ->
                Pair(mapRowToProperty(row), row.get("total_count", Long::class.java) ?: 0L)
            }
            .all()
            .collectList()
            .awaitSingle()

        val properties = results.map { it.first }
        val count = results.firstOrNull()?.second ?: 0L

        return PageImpl(properties, pageable, count)
    }

    override suspend fun findById(id: UUID): Property? {
        val query = """
            SELECT p.id, p.host_id, p.title, p.description, p.property_type,
                   ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lng,
                   p.city, p.region, p.country, p.address,
                   p.max_guests, p.bedrooms, p.bathrooms,
                   p.nightly_rate_eur, p.cleaning_fee_eur,
                   p.amenities, p.house_rules, p.photos,
                   p.avg_rating, p.review_count
            FROM property p
            WHERE p.id = :id
        """.trimIndent()

        return databaseClient
            .sql(query)
            .bind("id", id)
            .map { row, _ -> mapRowToProperty(row) }
            .one()
            .awaitFirstOrNull()
    }

    private fun mapRowToProperty(row: Row): Property {
        // Parse JSON arrays from JSONB columns
        val amenitiesJson = row.get("amenities", String::class.java) ?: "[]"
        val amenities = try {
            objectMapper.readValue(amenitiesJson, List::class.java) as List<String>
        } catch (e: Exception) {
            emptyList()
        }

        val houseRulesJson = row.get("house_rules", String::class.java) ?: "[]"
        val houseRules = try {
            objectMapper.readValue(houseRulesJson, List::class.java) as List<String>
        } catch (e: Exception) {
            emptyList()
        }

        val photosJson = row.get("photos", String::class.java) ?: "[]"
        val photos = try {
            @Suppress("UNCHECKED_CAST")
            val photosList = objectMapper.readValue(photosJson, List::class.java) as List<Map<String, String>>
            photosList.map { photo ->
                Property.Photo(
                    url = photo["url"] ?: "",
                    caption = photo["caption"] ?: ""
                )
            }
        } catch (e: Exception) {
            emptyList()
        }

        return Property(
            id = row.get("id", UUID::class.java)!!,
            hostId = row.get("host_id", UUID::class.java)!!,
            title = row.get("title", String::class.java)!!,
            description = row.get("description", String::class.java)!!,
            propertyType = row.get("property_type", String::class.java)!!,
            location = Property.Location(
                lat = row.get("lat", Double::class.java)!!,
                lng = row.get("lng", Double::class.java)!!,
                city = row.get("city", String::class.java)!!,
                region = row.get("region", String::class.java),
                country = row.get("country", String::class.java)!!,
                address = row.get("address", String::class.java)!!,
            ),
            maxGuests = row.get("max_guests", Int::class.java)!!,
            bedrooms = row.get("bedrooms", Int::class.java)!!,
            bathrooms = row.get("bathrooms", Int::class.java)!!,
            nightlyRateEur = row.get("nightly_rate_eur", BigDecimal::class.java)?.toDouble() ?: 0.0,
            cleaningFeeEur = row.get("cleaning_fee_eur", BigDecimal::class.java)?.toDouble() ?: 0.0,
            amenities = amenities,
            houseRules = houseRules,
            photos = photos,
            avgRating = row.get("avg_rating", BigDecimal::class.java)?.toDouble(),
            reviewCount = row.get("review_count", Int::class.java) ?: 0,
        )
    }
}
