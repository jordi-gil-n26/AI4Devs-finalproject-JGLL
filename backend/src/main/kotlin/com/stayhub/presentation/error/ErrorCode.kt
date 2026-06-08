package com.stayhub.presentation.error

import org.springframework.http.HttpStatus

/**
 * Machine-readable error codes and their HTTP status, per contracts/error-responses.yml.
 */
enum class ErrorCode(val status: HttpStatus) {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    DATES_UNAVAILABLE(HttpStatus.CONFLICT),
    PAYMENT_FAILED(HttpStatus.BAD_REQUEST),
    HOLD_EXPIRED(HttpStatus.CONFLICT),
    BOOKING_CANNOT_CANCEL(HttpStatus.UNPROCESSABLE_ENTITY),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR),
}
