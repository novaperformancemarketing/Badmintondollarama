import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { moneyTone, signedMoney } from '@/lib/money';

type IconProps = { size?: number };
const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const Icon = {
  Back: ({ size = 22 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.4} {...stroke} aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  More: ({ size = 22 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.6} {...stroke} aria-hidden>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  ),
  Home: ({ size = 22 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...stroke} aria-hidden>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  Session: ({ size = 22 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...stroke} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16M3 12h18" />
    </svg>
  ),
  Bars: ({ size = 22 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...stroke} aria-hidden>
      <path d="M6 20V10M12 20V4M18 20v-7" />
    </svg>
  ),
  Users: ({ size = 22 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...stroke} aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2" />
    </svg>
  ),
  Plus: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={3} {...stroke} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Share: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.6} {...stroke} aria-hidden>
      <path d="M12 15V3" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  ),
  Bench: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...stroke} aria-hidden>
      <path d="M4 18v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" />
      <path d="M4 14h16" />
      <path d="M6 10V6" />
    </svg>
  ),
};

export function Badge() {
  return <Image src="/brand/badge.png" alt="Smash Champs" width={46} height={46} className="badge-img" priority unoptimized />;
}

export function Logo({ width = 358 }: { width?: number }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Smash Champs Dollarama"
      width={width}
      height={Math.round((width * 218) / 1000)}
      priority
      unoptimized
      className="logo"
      style={{ display: 'block', width: '100%', height: 'auto' }}
    />
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="icon-btn left">
      <Icon.Back />
    </Link>
  );
}

export function Money({ cents, className = '', style }: { cents: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`num ${moneyTone(cents)} ${className}`} style={style}>
      {signedMoney(cents)}
    </span>
  );
}

type NavKey = 'home' | 'session' | 'leaders' | 'players';

export function BottomNav({ active }: { active: NavKey }) {
  const items: { key: NavKey; href: string; label: string; icon: ReactNode }[] = [
    { key: 'home', href: '/', label: 'Home', icon: <Icon.Home /> },
    { key: 'session', href: '/sessions/live', label: 'Session', icon: <Icon.Session /> },
    { key: 'leaders', href: '/leaderboard', label: 'Leaders', icon: <Icon.Bars /> },
    { key: 'players', href: '/players', label: 'Players', icon: <Icon.Users /> },
  ];
  return (
    <>
      <div className="nav-spacer" />
      <nav aria-label="Main" className="nav-glass">
        {items.map((i) => (
          <Link key={i.key} href={i.href} aria-current={i.key === active ? 'page' : undefined}>
            {i.icon}
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', opts);
}
