'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { getMyAffiliate } from '@/lib/api/affiliate';

const tabs = [
  { href: '/affiliate', label: 'Dashboard' },
  { href: '/affiliate/codes', label: 'Codes' },
  { href: '/affiliate/referrals', label: 'Referrals' },
  { href: '/affiliate/earnings', label: 'Earnings' },
];

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Allow /affiliate/apply without redirect
    if (pathname === '/affiliate/apply') {
      setChecked(true);
      return;
    }
    getMyAffiliate().then((res) => {
      if (!res || res.status !== 'APPROVED') {
        router.replace('/affiliate/apply');
      } else {
        setChecked(true);
      }
    }).catch(() => router.replace('/affiliate/apply'));
  }, [pathname, router]);

  if (pathname === '/affiliate/apply') {
    return <>{children}</>;
  }

  if (!checked) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/affiliate' && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-400 text-[#042820] font-bold'
                  : 'text-white font-bold hover:text-white hover:bg-white/5'
              }`}
            >
              {(t as any).affiliate?.[tab.label.toLowerCase()] || tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
