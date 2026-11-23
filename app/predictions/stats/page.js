import PredictionStatsView from '@/components/views/PredictionStatsView';
import { pageMeta } from '@/lib/meta';

export const metadata = pageMeta('Prediction statistics', 'The all-time Futlog prediction leaderboard: points, accuracy, streaks and form for every predictor.');

export default function Page() {
  return <PredictionStatsView />;
}
