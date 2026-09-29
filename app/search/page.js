import { Suspense } from 'react';
import SearchView from '@/components/views/SearchView';

export default function Page() {
  return <Suspense><SearchView /></Suspense>;
}
