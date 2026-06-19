package com.stayhub.presentation.api.integration

import org.junit.jupiter.api.Test
import org.springframework.http.MediaType

/**
 * StripeWebhookController validation paths. Both an unrecognised event type and
 * a malformed body return 400 (regardless of whether the signature secret is
 * configured in the test profile), so these are deterministic.
 */
class WebhookApiIntegrationTest : AbstractApiIntegrationTest() {

    @Test
    fun `webhook returns 400 for an unrecognised event type`() {
        http.post().uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue("""{"type":"charge.refunded","data":{"object":{"id":"pi_x"}}}""")
            .exchange()
            .expectStatus().isBadRequest
    }

    @Test
    fun `webhook returns 400 for a malformed payload`() {
        http.post().uri("/api/v1/webhooks/stripe")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue("not-json")
            .exchange()
            .expectStatus().isBadRequest
    }
}
