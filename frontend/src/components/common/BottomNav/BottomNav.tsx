/**
 * Bottom Navigation
 *
 * Clean 5-tab bottom bar with elevated center scan button.
 * Dark navy theme with teal accents.
 *
 * @module components/common/BottomNav
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  Home24Regular,
  Home24Filled,
  People24Regular,
  People24Filled,
  Camera24Filled,
  Sparkle24Regular,
  Sparkle24Filled,
  Apps24Regular,
  Apps24Filled,
} from '@fluentui/react-icons';
import { useMessageStore } from '@/stores/messageStore';
import { useNotificationStore } from '@/stores/notificationStore';

/**
 * Navigation Item Component
 */
function NavItem({
  href,
  label,
  IconRegular,
  IconFilled,
  isActive,
  badge,
}: {
  href: string;
  label: string;
  IconRegular: any;
  IconFilled: any;
  isActive: boolean;
  badge?: number;
}) {
  const Icon = isActive ? IconFilled : IconRegular;

  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 group"
    >
      <div
        className={cn(
          'relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200',
          isActive
            ? 'bg-[#00d084]/15'
            : 'group-active:scale-90'
        )}
      >
        <Icon
          className={cn(
            'w-[22px] h-[22px] transition-colors duration-200',
            isActive
              ? 'text-[#00d084]'
              : 'text-white/50 group-hover:text-white/70'
          )}
        />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none ring-2 ring-[#060b18]">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          'text-[10px] font-medium whitespace-nowrap transition-colors duration-200 mt-0.5',
          isActive
            ? 'text-[#00d084]'
            : 'text-white/50 group-hover:text-white/70'
        )}
      >
        {label}
      </span>
    </Link>
  );
}

/**
 * Routes grouped under hubs
 */
const MATCHING_ROUTES = ['/matching', '/matches', '/projects', '/pitch', '/deals', '/opportunities'];
const ACTIONS_ROUTES = ['/actions', '/explorer', '/calendar', '/messages', '/events', '/collaborations', '/map', '/profile', '/tasks', '/wallet', '/affiliate'];

/**
 * BottomNav component
 */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const unreadCount = useMessageStore((s) => s.unreadCount);
  const notifUnreadCount = useNotificationStore((s) => s.unreadCount);
  const totalBadge = unreadCount + notifUnreadCount;

  const isMatchingActive = MATCHING_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`)
  );
  const isActionsActive = ACTIONS_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`)
  );

  const isActive = (href: string) => {
    if (href === '/matching') return isMatchingActive;
    if (href === '/actions') return isActionsActive;
    return pathname === href || pathname?.startsWith(`${href}/`);
  };
  const isScanActive = isActive('/scan');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[#060b18]/95 backdrop-blur-xl border-t border-white/[0.06]" />

      <div className="relative flex items-end h-[68px] max-w-md mx-auto px-1">
        {/* Home */}
        <NavItem
          href="/dashboard"
          label={t.bottomNav.home}
          IconRegular={Home24Regular}
          IconFilled={Home24Filled}
          isActive={isActive('/dashboard')}
        />

        {/* Contacts */}
        <NavItem
          href="/contacts"
          label={t.bottomNav.contacts}
          IconRegular={People24Regular}
          IconFilled={People24Filled}
          isActive={isActive('/contacts')}
        />

        {/* Center Scan Button */}
        <div className="flex-1 flex justify-center -mt-4 pb-0.5">
          <Link
            href="/scan"
            className="flex flex-col items-center group"
          >
            <div className="relative">
              {/* Outer glow */}
              <div
                className={cn(
                  'absolute -inset-1 rounded-full bg-gradient-to-r from-[#00d084] to-[#00b870] transition-opacity duration-300',
                  isScanActive ? 'opacity-40 blur-md' : 'opacity-20 blur-md group-hover:opacity-30'
                )}
              />
              {/* Button */}
              <div
                className={cn(
                  'relative flex items-center justify-center w-[52px] h-[52px] rounded-full',
                  'bg-gradient-to-br from-[#00d084] to-[#00b870] text-[#060b18]',
                  'shadow-lg shadow-[#00d084]/20',
                  'transition-all duration-200',
                  'group-hover:scale-105 group-active:scale-95',
                  'ring-[3px] ring-[#060b18]'
                )}
              >
                <Camera24Filled className="w-6 h-6" />
              </div>
            </div>
            <span
              className={cn(
                'mt-1 text-[10px] font-semibold transition-colors duration-200',
                isScanActive
                  ? 'text-[#00d084]'
                  : 'text-[#00d084]/70'
              )}
            >
              {t.bottomNav.scan}
            </span>
          </Link>
        </div>

        {/* Matching */}
        <NavItem
          href="/matching"
          label={t.bottomNav?.matching || 'Matching'}
          IconRegular={Sparkle24Regular}
          IconFilled={Sparkle24Filled}
          isActive={isMatchingActive}
        />

        {/* Actions */}
        <NavItem
          href="/actions"
          label={t.bottomNav?.actions || 'Actions'}
          IconRegular={Apps24Regular}
          IconFilled={Apps24Filled}
          isActive={isActionsActive}
          badge={totalBadge}
        />
      </div>
    </nav>
  );
}
