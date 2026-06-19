package com.stayhub.presentation.api.integration

import com.stayhub.infrastructure.config.TestContainersConfiguration
import org.junit.jupiter.api.BeforeEach
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import java.time.Duration

/**
 * Base for per-endpoint API integration tests — each test verifies one endpoint
 * against the full Spring context over real HTTP (`bindToServer` +
 * [LocalServerPort]), so requests cross a real socket through the real WebFlux
 * filter chain, Jackson codecs, and security. This is the layer that catches
 * the wiring/codec/CORS bugs mocked slice tests miss (issues #130, #132).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestContainersConfiguration::class)
@TestPropertySource(
    properties = [
        "spring.flyway.enabled=true",
        "stayhub.jwt.secret=test-secret-key-for-integration-tests-minimum-32-chars",
        "stayhub.jwt.issuer=stayhub",
    ]
)
abstract class AbstractApiIntegrationTest {

    @LocalServerPort
    private var port: Int = 0

    protected lateinit var http: WebTestClient

    @BeforeEach
    fun initWebTestClient() {
        http = WebTestClient.bindToServer()
            .baseUrl("http://localhost:$port")
            .responseTimeout(Duration.ofSeconds(30))
            .build()
    }

    /** Registers a brand-new guest (unique email) and returns the issued JWT. */
    protected fun registerGuest(
        email: String = "it-${System.nanoTime()}@example.com",
        password: String = "pass1234",
    ): String =
        http.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"$email","password":"$password","first_name":"Itest","last_name":"User"}"""
            )
            .exchange()
            .expectStatus().isCreated
            .expectBody(Map::class.java)
            .returnResult()
            .responseBody?.get("token") as? String
            ?: error("register did not return a token")
}
