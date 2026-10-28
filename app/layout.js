import './globals.css';
import DataProvider from '@/components/DataProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import Analytics from "@vercel/analytics/next"

export const metadata = {
  title: 'Futlog',
  description: 'Log, rate and revisit the football matches you watch.',
  // Icons come from the file conventions in /app: icon.png, apple-icon.png and favicon.ico (Next adds the <link> tags itself),
  // plus app/manifest.js for "add to home screen".
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0b19' };


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Poppins:wght@600;700&family=Prompt:ital,wght@0,400;0,600;1,400&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        <DataProvider>
          <Header />
          {children}
          <Footer />
          <AuthModal />
        </DataProvider>
      </body>
    </html>
  );
}
