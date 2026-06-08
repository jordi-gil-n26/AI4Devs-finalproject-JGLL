'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function EmptyState() {
  const [faqOpen, setFaqOpen] = useState(false);

  const suggestions = [
    'Expand your date range',
    'Try a different location',
    'Remove some filters',
  ];

  const faqs = [
    {
      question: 'What if no dates work?',
      answer: 'Contact a host directly to discuss alternative dates or flexible booking options.',
    },
    {
      question: 'Why are there no results?',
      answer: 'Properties may be fully booked, or your filters might be too restrictive. Try adjusting your criteria.',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-96 px-6 py-12">
      {/* Main Message */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">No properties found</h2>
        <p className="text-lg text-gray-600">Try adjusting your search to find available properties</p>
      </div>

      {/* Suggestions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md w-full mb-8">
        <h3 className="font-semibold text-gray-900 mb-3">Try these tips:</h3>
        <ul className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="text-blue-600 font-bold mt-0.5">•</span>
              <span className="text-gray-700">{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Expandable FAQ */}
      <button
        onClick={() => setFaqOpen(!faqOpen)}
        className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        aria-expanded={faqOpen}
      >
        <span className="font-semibold">Frequently Asked Questions</span>
        {faqOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* FAQ Content */}
      {faqOpen && (
        <div className="mt-6 max-w-md w-full space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">{faq.question}</h4>
              <p className="text-gray-700">{faq.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
