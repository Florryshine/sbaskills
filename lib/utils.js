export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export function calculateProgress(totalLessons, completedLessons) {
  if (!totalLessons) {
    return 0;
  }

  return Math.round((completedLessons / totalLessons) * 100);
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}


// Shared class-name helper used by the Musical Learning Studio UI.
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
