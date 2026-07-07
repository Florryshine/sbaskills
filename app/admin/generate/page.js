'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

// Inner component that uses useSearchParams
function GenerateContent() {
  const searchParams = useSearchParams();
  const assetIdFromUrl = searchParams.get('assetId');

  // ... rest of the logic (same as before)
  // Return the JSX
}

// Main page with Suspense boundary
export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <GenerateContent />
    </Suspense>
  );
}