package com.stayhub.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * JWT validation settings.
 *
 * Values are bound from `stayhub.jwt.*` in application.yml, which are themselves
 * sourced from environment variables (`JWT_SECRET`, `JWT_ISSUER`). The secret is
 * NEVER hardcoded; an empty default lets the application context start without
 * auth configured, in which case every token fails validation.
 */
@ConfigurationProperties(prefix = "stayhub.jwt")
class JwtProperties {
    var secret: String = ""
    var issuer: String = "stayhub"
}
