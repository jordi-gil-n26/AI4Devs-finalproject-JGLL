package com.stayhub.domain.review

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.util.UUID

interface ReviewRepository {
    suspend fun findByPropertyId(
        propertyId: UUID,
        pageable: Pageable,
    ): Page<Review>
}
