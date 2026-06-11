package com.stayhub.application.property

import com.stayhub.domain.availability.AvailabilityRepository
import com.stayhub.domain.availability.UnavailableDate
import com.stayhub.presentation.error.ValidationException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.util.UUID

class GetPropertyAvailabilityUseCaseTest {

    private val availabilityRepository = mockk<AvailabilityRepository>()
    private val useCase = GetPropertyAvailabilityUseCase(availabilityRepository)

    @Test
    fun `returns unavailable dates for a valid date range`() {
        runBlocking {
            val propertyId = UUID.randomUUID()
            val from = LocalDate.of(2027, 7, 1)
            val to = LocalDate.of(2027, 7, 31)
            val unavailable = listOf(
                UnavailableDate(date = LocalDate.of(2027, 7, 10), reason = "booked"),
                UnavailableDate(date = LocalDate.of(2027, 7, 11), reason = "booked"),
                UnavailableDate(date = LocalDate.of(2027, 7, 20), reason = "blocked"),
            )

            coEvery { availabilityRepository.findUnavailableDates(propertyId, from, to) } returns unavailable

            val result = useCase.execute(propertyId, from, to)

            result shouldHaveSize 3
            result[0].reason shouldBe "booked"
        }
    }

    @Test
    fun `throws ValidationException when from is after to`() {
        runBlocking {
            val propertyId = UUID.randomUUID()
            val from = LocalDate.of(2027, 8, 1)
            val to = LocalDate.of(2027, 7, 1)

            shouldThrow<ValidationException> {
                useCase.execute(propertyId, from, to)
            }
        }
    }

    @Test
    fun `throws ValidationException when from equals to`() {
        runBlocking {
            val propertyId = UUID.randomUUID()
            val date = LocalDate.of(2027, 7, 1)

            shouldThrow<ValidationException> {
                useCase.execute(propertyId, date, date)
            }
        }
    }

    @Test
    fun `returns empty list when no unavailable dates in range`() {
        runBlocking {
            val propertyId = UUID.randomUUID()
            val from = LocalDate.of(2027, 7, 1)
            val to = LocalDate.of(2027, 7, 31)

            coEvery { availabilityRepository.findUnavailableDates(propertyId, from, to) } returns emptyList()

            val result = useCase.execute(propertyId, from, to)

            result shouldHaveSize 0
        }
    }
}
