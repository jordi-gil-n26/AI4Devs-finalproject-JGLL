package com.stayhub.infrastructure.config

import com.stayhub.application.search.SearchPropertiesUseCase
import com.stayhub.domain.property.GeocodeService
import com.stayhub.infrastructure.geocoding.MapboxGeocodeAdapter
import io.mockk.mockk
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName

@TestConfiguration
class TestContainersConfiguration {
    companion object {
        private val postgresImage = DockerImageName
            .parse("postgis/postgis:16-3.4")
            .asCompatibleSubstituteFor("postgres")

        private val postgresContainer = PostgreSQLContainer(postgresImage)
            .withDatabaseName("testdb")
            .withUsername("testuser")
            .withPassword("testpass")
            .apply {
                start()
            }

        init {
            System.setProperty("spring.r2dbc.url", "r2dbc:postgresql://${postgresContainer.host}:${postgresContainer.firstMappedPort}/testdb")
            System.setProperty("spring.r2dbc.username", "testuser")
            System.setProperty("spring.r2dbc.password", "testpass")
            System.setProperty("spring.flyway.enabled", "true")
            System.setProperty("spring.flyway.url", "jdbc:postgresql://${postgresContainer.host}:${postgresContainer.firstMappedPort}/testdb")
            System.setProperty("spring.flyway.user", "testuser")
            System.setProperty("spring.flyway.password", "testpass")
        }
    }

    @Bean
    fun postgresContainer() = postgresContainer

    // Mock beans for tests that need them
    @Bean
    fun searchPropertiesUseCase() = mockk<SearchPropertiesUseCase>()

    @Bean
    fun geocodeService(): GeocodeService = MapboxGeocodeAdapter("test-token")
}
