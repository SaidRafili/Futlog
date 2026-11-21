import Link from 'next/link';

export const metadata = { title: 'Page not found · Futlog', robots: { index: false, follow: true } };

// Shown, with HTTP status 404, for unknown URLs and whenever a page calls notFound()
// (a match, article, post or profile that does not exist, or a draft that is not yours).
export default function NotFound() {
  return (
    <main className="nf" id="notFound">
      <p className="nf-code" aria-hidden="true">404</p>
      <h1>We couldn’t find that page</h1>
      <p className="nf-text">The match, article, post or profile you’re looking for doesn’t exist, was deleted, or the link is wrong.</p>
      <div className="nf-links">
        <Link className="btn" href="/">Back to home</Link>
        <Link href="/matches">Browse matches</Link>
        <Link href="/feed">Open the feed</Link>
        <Link href="/search">Search Futlog</Link>
      </div>
    </main>
  );
}
