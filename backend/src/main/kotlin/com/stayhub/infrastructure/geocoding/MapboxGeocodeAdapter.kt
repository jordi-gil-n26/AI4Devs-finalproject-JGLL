package com.stayhub.infrastructure.geocoding

import com.stayhub.domain.property.GeocodeResult
import com.stayhub.domain.property.GeocodeService
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

@Service
class MapboxGeocodeAdapter(
    @Value("\${mapbox.api-key:default-token}")
    private val apiKey: String,
) : GeocodeService {
    private val logger = LoggerFactory.getLogger(javaClass)

    @PostConstruct
    fun validateConfiguration() {
        if (apiKey.isBlank() || apiKey == "default-token") {
            throw IllegalStateException(
                "Mapbox API key is not configured. " +
                "Please set 'mapbox.api-key' in application properties. " +
                "This is required for geocoding functionality."
            )
        }
    }

    override suspend fun geocode(query: String): List<GeocodeResult> {
        // Validate query parameter
        if (query.isBlank()) {
            logger.warn("Geocode query is blank")
            return emptyList()
        }

        if (query.length > 256) {
            logger.warn("Geocode query exceeds maximum length of 256 characters: length={}", query.length)
            return emptyList()
        }

        logger.info("Geocoding query: {}", query)

        // NOTE: This is a stub implementation awaiting real Mapbox API integration.
        // The real implementation would:
        // 1. Make HTTP call to https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={apiKey}
        // 2. Parse the Mapbox GeoJSON response
        // 3. Map features to GeocodeResult objects with bounding boxes
        // 4. Handle rate limiting, timeouts, and authentication errors
        //
        // Real implementation task: T026 (Phase 2 - add RestTemplate call with error handling)
        throw NotImplementedError(
            "Geocoding with Mapbox API is not yet implemented. " +
            "This adapter is in mock phase. To enable geocoding, implement real HTTP " +
            "integration with Mapbox Geocoding API v5. See T026 for implementation details."
        )
    }
}
