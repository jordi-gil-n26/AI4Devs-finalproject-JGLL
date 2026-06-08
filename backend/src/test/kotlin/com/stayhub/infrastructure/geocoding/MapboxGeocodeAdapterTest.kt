package com.stayhub.infrastructure.geocoding

import com.stayhub.domain.property.GeocodeService
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test

class MapboxGeocodeAdapterTest {
    private val adapter = MapboxGeocodeAdapter(apiKey = "fake-token")

    @Test
    fun `geocodes location query to coordinates`() = runBlocking {
        val result = adapter.geocode("Barcelona")

        result.shouldNotBeEmpty()
        result[0].name shouldBe "Barcelona"
        (result[0].lat in 41.3..41.5) shouldBe true
        (result[0].lng in 1.9..2.2) shouldBe true
    }
}
