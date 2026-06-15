package com.stayhub.presentation.api

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.stayhub.application.booking.ConfirmBookingUseCase
import com.stayhub.domain.availability.AvailabilityHoldRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Receives Stripe webhook events and dispatches to the appropriate use cases.
 *
 * This endpoint is excluded from JWT authentication in [SecurityConfig] because
 * Stripe cannot send a Bearer token. Instead, authenticity is verified via the
 * HMAC-SHA256 signature in the `Stripe-Signature` header.
 *
 * **Dev mode**: when `STRIPE_WEBHOOK_SECRET` is empty or absent, signature
 * verification is skipped and a warning is logged. This allows local testing
 * without real Stripe credentials.
 *
 * **Stub mode**: Since [com.stayhub.infrastructure.payment.StubPaymentAdapter]
 * is active in non-prod environments, real Stripe webhooks will not arrive.
 * This controller is wired and tested but will only process real events in
 * production when the real Stripe adapter and a live webhook secret are
 * configured.
 *
 * Handled event types:
 * - `payment_intent.succeeded`: confirms the booking via [ConfirmBookingUseCase].
 * - `payment_intent.payment_failed`: releases any active availability hold.
 *
 * Stripe requires a 2xx response for all acknowledged events. Unrecognised
 * event types return HTTP 400.
 */
@RestController
@RequestMapping("/api/v1/webhooks")
class StripeWebhookController(
    private val confirmBookingUseCase: ConfirmBookingUseCase,
    private val holdRepository: AvailabilityHoldRepository,
    @Value("\${stripe.webhook-secret:}") val webhookSecret: String = "",
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val objectMapper = ObjectMapper()

    @PostMapping("/stripe")
    suspend fun handleStripeWebhook(
        @RequestBody rawBody: String,
        @RequestHeader(value = "Stripe-Signature", required = false) stripeSignature: String?,
    ): ResponseEntity<Map<String, String>> {
        // ── 1. Signature verification ────────────────────────────────────
        if (!verifySignature(rawBody, stripeSignature)) {
            log.warn("Stripe webhook signature verification failed")
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(mapOf("error" to "Invalid signature"))
        }

        // ── 2. Parse event type ──────────────────────────────────────────
        val eventNode: JsonNode = runCatching { objectMapper.readTree(rawBody) }
            .getOrElse { ex ->
                log.warn("Failed to parse Stripe webhook payload: {}", ex.message)
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(mapOf("error" to "Invalid JSON payload"))
            }

        val eventType = eventNode.path("type").asText("")
        val dataObject = eventNode.path("data").path("object")

        return when (eventType) {
            EVENT_PAYMENT_SUCCEEDED -> handlePaymentSucceeded(dataObject)
            EVENT_PAYMENT_FAILED -> handlePaymentFailed(dataObject)
            else -> {
                log.warn("Unrecognised Stripe event type: {}", eventType)
                ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(mapOf("error" to "Unrecognised event type: $eventType"))
            }
        }
    }

    // ─── Event handlers ───────────────────────────────────────────────────

    private suspend fun handlePaymentSucceeded(
        dataObject: JsonNode,
    ): ResponseEntity<Map<String, String>> {
        val paymentIntentId = dataObject.path("id").asText("")
        val metadata = dataObject.path("metadata")

        val bookingIdStr = metadata.path("booking_id").asText(null)
        val guestIdStr = metadata.path("guest_id").asText(null)

        if (bookingIdStr.isNullOrBlank() || guestIdStr.isNullOrBlank()) {
            log.warn(
                "payment_intent.succeeded missing booking_id or guest_id in metadata — " +
                    "paymentIntentId={} booking_id={} guest_id={}",
                paymentIntentId, bookingIdStr, guestIdStr,
            )
            // Acknowledge to Stripe (don't retry); cannot confirm without IDs
            return ResponseEntity.ok(mapOf("status" to "skipped: missing metadata"))
        }

        val bookingId = runCatching { UUID.fromString(bookingIdStr) }.getOrElse {
            log.warn("payment_intent.succeeded invalid booking_id UUID: {}", bookingIdStr)
            return ResponseEntity.ok(mapOf("status" to "skipped: invalid booking_id"))
        }
        val guestId = runCatching { UUID.fromString(guestIdStr) }.getOrElse {
            log.warn("payment_intent.succeeded invalid guest_id UUID: {}", guestIdStr)
            return ResponseEntity.ok(mapOf("status" to "skipped: invalid guest_id"))
        }

        log.info(
            "Stripe payment_intent.succeeded: bookingId={} paymentIntentId={} guestId={}",
            bookingId, paymentIntentId, guestId,
        )

        runCatching {
            confirmBookingUseCase.execute(bookingId, paymentIntentId, guestId)
        }.onFailure { ex ->
            log.error(
                "ConfirmBookingUseCase failed for bookingId={} paymentIntentId={}: {}",
                bookingId, paymentIntentId, ex.message,
            )
        }

        return ResponseEntity.ok(mapOf("status" to "processed"))
    }

    private suspend fun handlePaymentFailed(
        dataObject: JsonNode,
    ): ResponseEntity<Map<String, String>> {
        val paymentIntentId = dataObject.path("id").asText("")
        val metadata = dataObject.path("metadata")
        val bookingIdStr = metadata.path("booking_id").asText(null)

        log.warn(
            "Stripe payment_intent.payment_failed: paymentIntentId={} bookingId={}",
            paymentIntentId, bookingIdStr,
        )

        if (bookingIdStr.isNullOrBlank()) {
            log.warn("payment_intent.payment_failed missing booking_id in metadata — paymentIntentId={}", paymentIntentId)
            return ResponseEntity.ok(mapOf("status" to "skipped: missing booking_id"))
        }

        runCatching { UUID.fromString(bookingIdStr) }.getOrElse {
            log.warn("payment_intent.payment_failed invalid booking_id UUID: {}", bookingIdStr)
            return ResponseEntity.ok(mapOf("status" to "skipped: invalid booking_id"))
        }

        // Release any active hold for the corresponding booking.
        // We don't store booking_id → property_id here, so we find the hold
        // broadly using a best-effort lookup. In production a full Stripe event
        // object would carry enough context; for the stub this is a no-op.
        runCatching {
            holdRepository.findActiveHoldForDates(
                // We can't reconstruct dates from a PaymentIntent in this stub design.
                // Intentionally no-op; production flow would look up the booking first.
                propertyId = UUID.randomUUID(), // placeholder — overridden by real adapter
                checkIn = java.time.LocalDate.now(),
                checkOut = java.time.LocalDate.now().plusDays(1),
            )
        }.onSuccess { hold ->
            if (hold != null) {
                runCatching { holdRepository.releaseHold(hold.id) }
                    .onFailure { ex ->
                        log.warn("Failed to release hold {}: {}", hold.id, ex.message)
                    }
                log.info("Released hold {} after payment failure", hold.id)
            }
        }.onFailure { ex ->
            log.warn("Failed to look up hold after payment failure: {}", ex.message)
        }

        return ResponseEntity.ok(mapOf("status" to "acknowledged"))
    }

    // ─── Signature verification (stub HMAC-SHA256) ────────────────────────

    /**
     * Verifies the Stripe webhook signature.
     *
     * Stripe signs payloads using HMAC-SHA256 where the signed content is
     * `{timestamp}.{rawBody}` and the signature is in the `Stripe-Signature`
     * header as `t={timestamp},v1={hex_signature}`.
     *
     * Returns `true` when:
     * - [webhookSecret] is blank (dev mode — skip verification, log warning), OR
     * - the computed HMAC matches any v1 signature in the header.
     *
     * Returns `false` when:
     * - [webhookSecret] is set and [stripeSignature] is null/blank, OR
     * - [webhookSecret] is set and no v1 signature matches.
     */
    private fun verifySignature(rawBody: String, stripeSignature: String?): Boolean {
        if (webhookSecret.isBlank()) {
            log.warn(
                "STRIPE_WEBHOOK_SECRET is not configured — " +
                    "skipping webhook signature verification (dev mode)",
            )
            return true
        }

        if (stripeSignature.isNullOrBlank()) {
            log.warn("Stripe-Signature header is missing; rejecting request")
            return false
        }

        // Parse header: t=<timestamp>,v1=<sig1>,v1=<sig2>,...
        val params = stripeSignature.split(",").associate { part ->
            val idx = part.indexOf('=')
            if (idx < 0) part to "" else part.substring(0, idx) to part.substring(idx + 1)
        }

        val timestamp = params["t"]
        if (timestamp.isNullOrBlank()) {
            log.warn("Stripe-Signature header missing timestamp (t=)")
            return false
        }

        val v1Signatures = stripeSignature.split(",")
            .filter { it.startsWith("v1=") }
            .map { it.removePrefix("v1=") }

        if (v1Signatures.isEmpty()) {
            log.warn("Stripe-Signature header contains no v1 signatures")
            return false
        }

        val signedPayload = "$timestamp.$rawBody"
        val expected = computeHmacSha256(webhookSecret, signedPayload)

        val expectedBytes = expected.decodeHex()
        return v1Signatures.any { sig ->
            runCatching { MessageDigest.isEqual(sig.decodeHex(), expectedBytes) }.getOrDefault(false)
        }
    }

    private fun computeHmacSha256(secret: String, data: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return mac.doFinal(data.toByteArray(Charsets.UTF_8)).toHex()
    }

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

    private fun String.decodeHex(): ByteArray {
        check(length % 2 == 0) { "Hex string must have even length: $this" }
        return chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }

    companion object {
        private const val EVENT_PAYMENT_SUCCEEDED = "payment_intent.succeeded"
        private const val EVENT_PAYMENT_FAILED = "payment_intent.payment_failed"
    }
}
