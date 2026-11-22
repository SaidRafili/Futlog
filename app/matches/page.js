import { Suspense } from 'react';
import MatchesView from '@/components/views/MatchesView';

export const metadata = { title: 'Matches · Futlog' };

// useSearchParams (the filters) needs a Suspense boundary
export default function Page() {
  return <Suspense fallback={null}><MatchesView /></Suspense>;
}
