import PostView from '@/components/views/PostView';
import { postMeta } from '@/lib/meta';

export async function generateMetadata({ params }) {
  return postMeta((await params).id);
}

export default function Page() {
  return <PostView />;
}
