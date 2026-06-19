package com.stayhub.flow

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
 * Base class for backend flow tests — multi-step user journeys exercised
 * against the full Spring context over real HTTP.
 *
 * Binds a [WebTestClient] to the actually-running server (`bindToServer` +
 * [LocalServerPort]) so requests cross a real socket through the real WebFlux
 * filter chain, Jackson codecs, and security — the layer that catches
 * wiring/codec/CORS bugs that mocked slice tests cannot (see issues #130, #132).
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
abstract class AbstractFlowTest {

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

    /**
     * Registers a brand-new guest and returns the issued JWT. Email is
     * uniquified per call so journeys don't collide on the unique-email
     * constraint within the shared Testcontainers database.
     */
    protected fun registerGuest(
        email: String = "flow-${System.nanoTime()}@example.com",
        password: String = "pass1234",
    ): String =
        http.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"$email","password":"$password","first_name":"Flow","last_name":"Test"}"""
            )
            .exchange()
            .expectStatus().isCreated
            .expectBody(Map::class.java)
            .returnResult()
            .responseBody?.get("token") as? String
            ?: error("register did not return a token")
}
