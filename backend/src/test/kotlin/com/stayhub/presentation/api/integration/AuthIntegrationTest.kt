package com.stayhub.presentation.api.integration

import com.stayhub.infrastructure.config.TestContainersConfiguration
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.reactive.server.WebTestClient

/**
 * Full-stack integration test for auth routes.
 *
 * Uses real PostgreSQL (TestContainers + Flyway migrations) and a full Spring
 * context. Verifies the register → login round-trip and that the issued JWT
 * grants access to a protected endpoint.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@ActiveProfiles("test")
@Import(TestContainersConfiguration::class)
@TestPropertySource(
    properties = [
        "spring.flyway.enabled=true",
        // Provide a known JWT secret so tokens are verifiable within the test.
        "stayhub.jwt.secret=test-secret-key-for-integration-tests-minimum-32-chars",
        "stayhub.jwt.issuer=stayhub",
    ]
)
class AuthIntegrationTest {

    @Autowired
    lateinit var webClient: WebTestClient

    @Autowired
    lateinit var databaseClient: DatabaseClient

    @Test
    fun `register - login round trip returns token and protected endpoint accepts it`() {
        val email = "integrationtest-${System.nanoTime()}@example.com"

        // Step 1: Register
        val registerBody = webClient.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"$email","password":"pass1234","first_name":"Integration","last_name":"Test"}"""
            )
            .exchange()
            .expectStatus().isCreated
            .expectBody()
            .jsonPath("$.token").exists()
            .jsonPath("$.user_id").exists()
            .jsonPath("$.first_name").isEqualTo("Integration")
            .returnResult()

        // Extract token from register response
        val registerToken = webClient.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"${email}2","password":"pass1234","first_name":"Integration2","last_name":"Test2"}"""
            )
            .exchange()
            .expectStatus().isCreated
            .expectBody(Map::class.java)
            .returnResult()
            .responseBody?.get("token") as? String

        // Step 2: Login with same credentials
        val loginToken = webClient.post()
            .uri("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue("""{"email":"$email","password":"pass1234"}""")
            .exchange()
            .expectStatus().isOk
            .expectBody(Map::class.java)
            .returnResult()
            .responseBody?.get("token") as? String

        // Step 3: Use the login token on a protected endpoint (create booking — will fail with
        // 400/not-found since we have no real property, but NOT 401, proving auth works)
        webClient.post()
            .uri("/api/v1/bookings")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer $loginToken")
            .bodyValue(
                """{"property_id":"cccccccc-cccc-cccc-cccc-000000001001","check_in":"2030-09-01","check_out":"2030-09-04","guest_count":2}"""
            )
            .exchange()
            .expectStatus().value { status ->
                // Any non-401 response means the JWT was accepted by JwtAuthFilter
                assert(status != 401) { "Expected JWT to be accepted but got 401" }
            }
    }

    @Test
    fun `duplicate email registration returns 409`() {
        val email = "duplicate-${System.nanoTime()}@example.com"

        // First registration
        webClient.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"$email","password":"pass1234","first_name":"Alice","last_name":"Smith"}"""
            )
            .exchange()
            .expectStatus().isCreated

        // Second registration with same email
        webClient.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"$email","password":"different","first_name":"Bob","last_name":"Jones"}"""
            )
            .exchange()
            .expectStatus().isEqualTo(409)
            .expectBody()
            .jsonPath("$.error.code").isEqualTo("CONFLICT")
    }

    @Test
    fun `login with wrong password returns 401`() {
        val email = "wrongpass-${System.nanoTime()}@example.com"

        webClient.post()
            .uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                """{"email":"$email","password":"correct-pass","first_name":"Test","last_name":"User"}"""
            )
            .exchange()
            .expectStatus().isCreated

        webClient.post()
            .uri("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue("""{"email":"$email","password":"wrong-pass"}""")
            .exchange()
            .expectStatus().isUnauthorized
            .expectBody()
            .jsonPath("$.error.code").isEqualTo("UNAUTHORIZED")
    }
}
