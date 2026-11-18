import MatchView from '@/components/views/MatchView';
import { matchMeta } from '@/lib/meta';

export async function generateMetadata({ params }) {
  return matchMeta((await params).id);
}

export default function Page() {
  return <MatchView />;
}
