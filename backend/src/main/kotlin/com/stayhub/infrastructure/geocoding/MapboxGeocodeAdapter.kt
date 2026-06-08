package com.stayhub.infrastructure.geocoding

import com.stayhub.domain.property.GeocodeResult
import com.stayhub.domain.property.GeocodeService
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

@Service
class MapboxGeocodeAdapter(
    @Value("\${mapbox.api-key:default-token}")
    private val apiKey: String,
) : GeocodeService {
    override suspend fun geocode(query: String): List<GeocodeResult> {
        // Mock implementation returning Barcelona coordinates
        // Real implementation would call: https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={token}
        return listOf(
            GeocodeResult(
                name = "Barcelona",
                lat = 41.3851,
                lng = 2.1734,
                bbox = GeocodeResult.BoundingBox(
                    swLat = 41.3300,
                    swLng = 1.9500,
                    neLat = 41.4500,
                    neLng = 2.2000
                )
            )
        )
    }
}
