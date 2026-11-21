import PostView from '@/components/views/PostView';
import { postMeta } from '@/lib/meta';
import { canonicalPost } from '@/lib/canonical';

export async function generateMetadata({ params }) {
  return postMeta((await params).id);
}

export default async function Page({ params }) {
  await canonicalPost((await params).id);        // /post/55 -> /post/55-first-words-of-the-post
  return <PostView />;
}
