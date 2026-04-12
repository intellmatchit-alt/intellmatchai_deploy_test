'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Header } from '@/components/common/Header/Header';
import { useI18n } from '@/lib/i18n';

const adminTabs = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard' },
  { key: 'plans', href: '/admin/plans', label: 'Plans' },
  { key: 'settings', href: '/admin/settings', label: 'Settings' },
  { key: 'users', href: '/admin/users', label: 'Users' },
  { key: 'point-packs', href: '/admin/point-packs', label: 'Point Packs' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && !user?.isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Header title={t.admin?.title || 'Admin Panel'} showBack backHref="/dashboard" />
      {/* Tab Navigation */}
      <div className="border-b border-th-border overflow-x-auto">
        <div className="flex px-4 gap-1">
          {adminTabs.map((tab) => {
            const isActive = pathname === tab.href || (tab.href !== '/admin' && pathname.startsWith(tab.href));
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-th-text-s hover:text-th-text hover:border-th-border'
                }`}
              >
                {(t.admin as any)?.[tab.key] || tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="max-w-6xl mx-auto p-4">{children}</div>
    </>
  );
}
