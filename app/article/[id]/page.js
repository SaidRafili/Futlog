import ArticleView from '@/components/views/ArticleView';
import { articleMeta } from '@/lib/meta';

export async function generateMetadata({ params }) {
  return articleMeta((await params).id);
}

export default function Page() {
  return <ArticleView />;
}
