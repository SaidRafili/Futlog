export default function manifest() {
  return {
    name: 'Futlog',
    short_name: 'Futlog',
    description: 'Log, rate and revisit the football matches you watch.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0b19',
    theme_color: '#5b4fd6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
