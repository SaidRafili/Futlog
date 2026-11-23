'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Navigation inside the Predictions area: the games you can pick, and the all-time statistics leaderboard.
const TABS = [['/predictions', 'Games'], ['/predictions/stats', 'Statistics']];

export default function PredictionTabs() {
  const path = (usePathname() || '').replace(/\/$/, '');
  return (
    <nav className="pr-tabs" aria-label="Predictions sections">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'on' : ''} aria-current={path === href ? 'page' : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
