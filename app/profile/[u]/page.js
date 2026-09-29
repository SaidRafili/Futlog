import { Suspense } from 'react';
import ProfileView from '@/components/views/ProfileView';

export default function Page() {
  return <Suspense><ProfileView /></Suspense>;
}
