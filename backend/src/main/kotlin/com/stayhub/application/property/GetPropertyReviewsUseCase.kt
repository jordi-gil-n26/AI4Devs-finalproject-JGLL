package com.stayhub.application.property

import com.stayhub.domain.review.Review
import com.stayhub.domain.review.ReviewRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class GetPropertyReviewsUseCase(
    private val reviewRepository: ReviewRepository,
) {
    suspend fun execute(
        propertyId: UUID,
        page: Int = 1,
        size: Int = 10,
    ): Page<Review> {
        val pageable = PageRequest.of(page - 1, size)
        return reviewRepository.findByPropertyId(propertyId, pageable)
    }
}
