import FeedView from '@/components/views/FeedView';
import { pageMeta } from '@/lib/meta';

export const metadata = pageMeta('Feed', 'Short posts from the football fans you follow on Futlog: match reactions, ratings and pictures.');

export default function Page() {
  return <FeedView />;
}
