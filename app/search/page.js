import { Suspense } from 'react';
import SearchView from '@/components/views/SearchView';
import { searchMeta } from '@/lib/meta';

export async function generateMetadata({ searchParams }) {
  return searchMeta((await searchParams).q);
}

export default function Page() {
  return <Suspense><SearchView /></Suspense>;
}
