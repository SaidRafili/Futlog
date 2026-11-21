import { Suspense } from 'react';
import ProfileView from '@/components/views/ProfileView';
import { profileMeta } from '@/lib/meta';
import { canonicalProfile } from '@/lib/canonical';

export async function generateMetadata({ params }) {
  return profileMeta((await params).u);
}

export default async function Page({ params }) {
  await canonicalProfile((await params).u);      // unknown @handle -> real 404
  return <Suspense><ProfileView /></Suspense>;
}
