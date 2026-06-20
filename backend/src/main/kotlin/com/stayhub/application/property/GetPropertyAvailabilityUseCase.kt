package com.stayhub.application.property

import com.stayhub.domain.availability.AvailabilityRepository
import com.stayhub.domain.availability.UnavailableDate
import com.stayhub.domain.property.PropertyRepository
import com.stayhub.application.error.NotFoundException
import com.stayhub.application.error.ValidationException
import org.springframework.stereotype.Service
import java.time.LocalDate
import java.util.UUID

@Service
class GetPropertyAvailabilityUseCase(
    private val availabilityRepository: AvailabilityRepository,
    private val propertyRepository: PropertyRepository,
) {
    suspend fun execute(
        propertyId: UUID,
        from: LocalDate,
        to: LocalDate,
    ): List<UnavailableDate> {
        if (!from.isBefore(to)) {
            throw ValidationException("'from' date must be before 'to' date")
        }
        propertyRepository.findById(propertyId)
            ?: throw NotFoundException("Property not found: $propertyId")
        return availabilityRepository.findUnavailableDates(propertyId, from, to)
    }
}
