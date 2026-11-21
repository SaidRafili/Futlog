// The public address of the site, used as `metadataBase` so that relative image / canonical links in <meta> tags become absolute
// (link previews on X, Facebook, Slack, WhatsApp... need absolute URLs).
// Set NEXT_PUBLIC_SITE_URL (e.g. https://futlog.com) for a custom domain. On Vercel the production / deployment host is used automatically.
export function siteUrl() {
  const e = process.env;
  const raw = e.NEXT_PUBLIC_SITE_URL || (e.VERCEL_ENV === 'production' && e.VERCEL_PROJECT_PRODUCTION_URL) || e.VERCEL_URL || 'localhost:3000';
  const withProto = /^https?:\/\//i.test(raw) ? raw : (/^localhost|^127\./.test(raw) ? 'http://' : 'https://') + raw;
  try { return new URL(withProto); } catch { return new URL('http://localhost:3000'); }
}
