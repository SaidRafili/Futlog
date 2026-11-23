/** @type {import('next').NextConfig} */
module.exports = {
  async headers() {
    // Optimised stadium photos (scripts/optimize-venue-photos.mjs) have a content hash in their name, so they never change: cache them for a year.
    return [{ source: '/venues/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  }
};
