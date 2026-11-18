import { Suspense } from 'react';
import ProfileView from '@/components/views/ProfileView';
import { profileMeta } from '@/lib/meta';

export async function generateMetadata({ params }) {
  return profileMeta((await params).u);
}

export default function Page() {
  return <Suspense><ProfileView /></Suspense>;
}
