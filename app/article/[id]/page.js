import ArticleView from '@/components/views/ArticleView';
import { articleMeta } from '@/lib/meta';
import { canonicalArticle } from '@/lib/canonical';

export async function generateMetadata({ params }) {
  return articleMeta((await params).id);
}

export default async function Page({ params }) {
  await canonicalArticle((await params).id);     // /article/987 -> /article/987-the-title
  return <ArticleView />;
}
