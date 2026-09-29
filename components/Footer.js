import Link from 'next/link';

const social = [
  ['X / Twitter', 'https://x.com/futlog'],
  ['Instagram', 'https://instagram.com/futlog'],
  ['YouTube', 'https://youtube.com/@futlog'],
  ['Discord', 'https://discord.gg/futlog']
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="ft-in">
        <div className="ft-brand">
          <Link className="logo" href="/">Futlog</Link>
          <p>Log, rate and talk about the football matches you watch.</p>
        </div>
        <nav className="ft-col" aria-label="Footer navigation">
          <h2>Explore</h2>
          <Link href="/#matches">Matches</Link><Link href="/feed">Feed</Link><Link href="/article/1">Articles</Link><Link href="/profile/saidrafili">Profile</Link>
        </nav>
        <nav className="ft-col" aria-label="Footer info links">
          <h2>Futlog</h2>
          <Link href="/info">About</Link><Link href="/info#faq">FAQ</Link><Link href="/info#contact">Contact</Link><Link href="/info#privacy">Privacy</Link>
        </nav>
        <div className="ft-col">
          <h2>Follow us</h2>
          {social.map(([name, href]) => (
            <a key={name} href={href} target="_blank" rel="noopener noreferrer">{name} ↗</a>
          ))}
        </div>
      </div>
      <div className="ft-bot"><span>© 2026 Futlog. All rights reserved.</span><Link href="/info#privacy">Privacy &amp; terms</Link></div>
    </footer>
  );
}
