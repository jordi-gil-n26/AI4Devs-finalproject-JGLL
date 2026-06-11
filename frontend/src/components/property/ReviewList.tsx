'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { usePropertyReviews } from '@/services/propertyService';
import type { Review } from '@/types';

interface ReviewListProps {
  propertyId: string;
  avgRating: number | null;
  reviewCount: number;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const iconClass = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${iconClass} ${
            star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-gray-100'
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-2" data-testid="review-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {review.guest_avatar_url ? (
            <img
              src={review.guest_avatar_url}
              alt={`${review.guest_name} avatar`}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm">
              {review.guest_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">{review.guest_name}</p>
            <p className="text-xs text-gray-500">{date}</p>
          </div>
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>

      {review.comment && (
        <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
      )}
    </div>
  );
}

/**
 * ReviewList Component (T047)
 *
 * Displays aggregate rating and paginated review cards.
 * - Shows large star aggregate rating + total count
 * - Individual review cards with guest name, date, comment, stars
 * - "Load more" button for pagination
 * - Empty state "No reviews yet" when total_reviews === 0
 */
export function ReviewList({ propertyId, avgRating, reviewCount }: ReviewListProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, error } = usePropertyReviews(propertyId, page, pageSize);

  // Aggregate header
  const showRating = avgRating !== null && avgRating !== undefined && reviewCount > 0;

  if (isLoading && page === 1) {
    return (
      <div data-testid="review-list-loading" aria-busy="true" aria-label="Loading reviews">
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="review-list-error"
        role="alert"
        className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4"
      >
        Failed to load reviews. Please refresh the page.
      </div>
    );
  }

  const totalReviews = data?.total_reviews ?? reviewCount;
  const reviews: Review[] = data?.reviews ?? [];
  const totalPages = data?.pagination.total_pages ?? 0;
  const hasMore = page < totalPages;
  const isEmpty = totalReviews === 0;

  return (
    <div data-testid="review-list">
      {/* Aggregate rating header */}
      <div className="mb-4 flex items-center gap-3">
        {showRating ? (
          <>
            <StarRating rating={Math.round(avgRating)} size="lg" />
            <span className="text-2xl font-bold text-gray-900">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-gray-500">
              ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-500">No rating yet</span>
        )}
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <p className="text-gray-500 text-sm py-4" data-testid="review-list-empty">
          No reviews yet
        </p>
      ) : (
        <>
          {/* Review cards */}
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading}
              className="mt-4 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              data-testid="review-load-more"
            >
              {isLoading ? 'Loading…' : 'Load more reviews'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
