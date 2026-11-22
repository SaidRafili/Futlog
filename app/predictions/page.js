import PredictionsView from '@/components/views/PredictionsView';
import { pageMeta } from '@/lib/meta';

export const metadata = pageMeta('Predictions', 'Pick the winner of this week’s football games on Futlog and see last week’s best predictors.');

export default function Page() {
  return <PredictionsView />;
}
