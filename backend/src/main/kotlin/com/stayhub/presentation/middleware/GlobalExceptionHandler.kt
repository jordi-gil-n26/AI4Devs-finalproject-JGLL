package com.stayhub.presentation.middleware

import com.stayhub.presentation.error.ApiException
import com.stayhub.presentation.error.ErrorBody
import com.stayhub.presentation.error.ErrorCode
import com.stayhub.presentation.error.ErrorDetail
import com.stayhub.presentation.error.ErrorResponse
import com.stayhub.presentation.error.ValidationException
import org.slf4j.LoggerFactory
import org.slf4j.MDC
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.bind.support.WebExchangeBindException
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.server.ServerWebInputException

/**
 * Renders all uncaught exceptions as the shared ErrorResponse envelope
 * (contracts/error-responses.yml). The trace_id is read from MDC, which is
 * populated by TraceIdFilter under the "traceId" key.
 */
@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(ApiException::class)
    fun handleApiException(ex: ApiException): ResponseEntity<ErrorResponse> =
        build(ex.code, ex.message, ex.details)

    @ExceptionHandler(ValidationException::class)
    fun handleValidationException(ex: ValidationException): ResponseEntity<ErrorResponse> {
        log.warn("Validation error: {}", ex.message)
        return build(ex.code, ex.message, ex.details)
    }

    @ExceptionHandler(WebExchangeBindException::class)
    fun handleBindException(ex: WebExchangeBindException): ResponseEntity<ErrorResponse> {
        val details = ex.fieldErrors.map {
            ErrorDetail(field = it.field, reason = it.defaultMessage ?: "Invalid value")
        }
        return build(ErrorCode.VALIDATION_ERROR, "Invalid request parameters", details)
    }

    @ExceptionHandler(ServerWebInputException::class)
    fun handleInputException(ex: ServerWebInputException): ResponseEntity<ErrorResponse> =
        build(ErrorCode.VALIDATION_ERROR, ex.reason ?: "Invalid request")

    @ExceptionHandler(ResponseStatusException::class)
    fun handleResponseStatus(ex: ResponseStatusException): ResponseEntity<ErrorResponse> {
        val code = when (ex.statusCode) {
            HttpStatus.NOT_FOUND -> ErrorCode.NOT_FOUND
            HttpStatus.UNAUTHORIZED -> ErrorCode.UNAUTHORIZED
            HttpStatus.FORBIDDEN -> ErrorCode.FORBIDDEN
            HttpStatus.CONFLICT -> ErrorCode.DATES_UNAVAILABLE
            else -> ErrorCode.INTERNAL_ERROR
        }
        return build(code, ex.reason ?: ex.statusCode.toString())
    }

    @ExceptionHandler(Exception::class)
    fun handleUnexpected(ex: Exception): ResponseEntity<ErrorResponse> {
        log.error("Unhandled exception", ex)
        return build(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred")
    }

    private fun build(
        code: ErrorCode,
        message: String,
        details: List<ErrorDetail>? = null,
    ): ResponseEntity<ErrorResponse> {
        val body = ErrorResponse(
            ErrorBody(
                code = code.name,
                message = message,
                details = details?.takeIf { it.isNotEmpty() },
                traceId = MDC.get("traceId"),
            ),
        )
        return ResponseEntity.status(code.status).body(body)
    }
}
