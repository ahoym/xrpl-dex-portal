'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppState } from '@/lib/hooks/use-app-state';
import { NetworkSelector } from './network-selector';

const links = [
  { href: '/setup', label: 'Setup' },
  { href: '/trade', label: 'Trade' },
  { href: '/transact', label: 'Transact' },
];

export function NavBar() {
  const pathname = usePathname();
  const { state, setNetwork } = useAppState();

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-4 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white shadow-sm">
            X
          </div>
          <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            XRPL DEX
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`px-3 py-1.5 text-sm font-medium ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto">
          <NetworkSelector network={state.network} walletAddress={state.wallet?.address} onChange={setNetwork} />
        </div>
      </div>
    </nav>
  );
}
