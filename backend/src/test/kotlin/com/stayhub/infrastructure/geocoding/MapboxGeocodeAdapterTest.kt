package com.stayhub.infrastructure.geocoding

import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class MapboxGeocodeAdapterTest {
    private val adapter = MapboxGeocodeAdapter(apiKey = "test-valid-token")

    @Test
    fun `throws NotImplementedError until real Mapbox API is implemented`() = runBlocking {
        val exception = assertThrows<NotImplementedError> {
            runBlocking {
                adapter.geocode("Barcelona")
            }
        }

        assert(exception.message?.contains("Mapbox API") == true) { "Message should mention Mapbox API" }
        assert(exception.message?.contains("not yet implemented") == true) { "Message should indicate not implemented" }
    }

    @Test
    fun `returns empty list for blank query`() = runBlocking {
        val result = adapter.geocode("   ")

        assert(result.isEmpty()) { "Result should be empty for blank query" }
    }

    @Test
    fun `returns empty list for query exceeding max length`() = runBlocking {
        val longQuery = "a".repeat(257)

        val result = adapter.geocode(longQuery)

        assert(result.isEmpty()) { "Result should be empty for query exceeding max length" }
    }

    @Test
    fun `throws IllegalStateException when API key is default token during validation`() {
        val adapter = MapboxGeocodeAdapter(apiKey = "default-token")
        assertThrows<IllegalStateException> {
            adapter.validateConfiguration()
        }
    }

    @Test
    fun `throws IllegalStateException when API key is blank during validation`() {
        val adapter = MapboxGeocodeAdapter(apiKey = "")
        assertThrows<IllegalStateException> {
            adapter.validateConfiguration()
        }
    }
}
