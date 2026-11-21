import MatchView from '@/components/views/MatchView';
import { matchMeta } from '@/lib/meta';
import { canonicalMatch } from '@/lib/canonical';

export async function generateMetadata({ params }) {
  return matchMeta((await params).id);
}

export default async function Page({ params }) {
  await canonicalMatch((await params).id);       // /match/12345 -> /match/12345-arsenal-vs-chelsea-2026
  return <MatchView />;
}
