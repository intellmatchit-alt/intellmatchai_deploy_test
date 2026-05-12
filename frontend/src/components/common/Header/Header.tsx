/**
 * Header Component
 *
 * Top header bar for the main app.
 * Dark navy theme with teal accents.
 *
 * @module components/common/Header
 */

'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { ChevronLeft24Regular, Wallet24Regular } from '@fluentui/react-icons';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { useI18n } from '@/lib/i18n';
import { ContextSwitcher } from '@/components/common/ContextSwitcher';
import { useOrganizationStore } from '@/stores/organizationStore';
import { useWalletStore } from '@/stores/walletStore';
import { useEffect } from 'react';

/**
 * Language Switcher Component
 */
function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'ar' : 'en');
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-th-surface-h transition-colors cursor-pointer font-medium text-sm"
      aria-label="Change language"
    >
      <span className={lang === 'en' ? 'text-th-text' : 'text-th-text-m'}>EN</span>
      <span className="text-th-text-m">/</span>
      <span className={lang === 'ar' ? 'text-th-text' : 'text-th-text-m'}>AR</span>
    </button>
  );
}

export interface HeaderProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
  className?: string;
}

export function Header({
  title,
  showBack = false,
  backHref,
  rightContent,
  className,
}: HeaderProps) {
  const { user } = useAuth();
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId);
  const { balance, fetchBalance } = useWalletStore();

  useEffect(() => {
    if (user) fetchBalance();
  }, [user, fetchBalance]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-th-nav-header backdrop-blur-xl border-b border-th-border',
        className
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="page-container flex items-center justify-between h-16">
        {/* Left side */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <Link
              href={backHref || '/dashboard'}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-th-surface-h transition-colors text-th-text-t hover:text-th-text"
              aria-label="Back"
            >
              <ChevronLeft24Regular className="w-6 h-6" />
            </Link>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/intelllogo.png" alt="IntellMatch" className="h-9 w-auto" />
            </Link>
          )}

          <ContextSwitcher />

          {title && (
            <h1 className="text-lg font-semibold text-th-text truncate">
              {title}
            </h1>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {rightContent}

          <LanguageSwitcher />

          {!rightContent && (
            <>
              <Link
                href="/wallet"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-th-surface-h active:scale-[0.97] transition-all duration-150 text-th-text-t hover:text-th-text"
                aria-label="Wallet"
              >
                <Wallet24Regular className="w-5 h-5" />
                <span className="text-sm font-medium leading-none">
                  {Number.isInteger(balance) ? balance : balance.toFixed(2)}
                </span>
              </Link>

              <NotificationDropdown />

              <Link
                href="/profile"
                className="ms-1 rounded-full active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d084]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-th-bg"
                aria-label="Profile"
              >
                <Avatar
                  src={user?.avatarUrl}
                  name={
                    user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.firstName || user?.lastName || user?.name || 'User'
                  }
                  size="header"
                  intent="header"
                />
              </Link>
            </>
          )}
        </div>
      </div>
      {activeOrgId && (
        <div className="h-0.5 bg-gradient-to-r from-[#00d084] via-[#00e896] to-[#00d084]" />
      )}
    </header>
  );
}
