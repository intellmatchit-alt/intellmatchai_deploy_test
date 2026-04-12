'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  Search24Regular,
  Calendar24Regular,
  Chat24Regular,
  ArrowRight24Regular,
  Apps24Regular,
  Target24Regular,
  PeopleTeam24Regular,
  Person24Regular,
  Building24Regular,
  TaskListSquareLtr24Regular,
  Wallet24Regular,
  ReceiptMoney24Regular,
  PeopleAudience24Regular,
} from '@fluentui/react-icons';
import { useMessageStore } from '@/stores/messageStore';
import { useOrganizationStore } from '@/stores/organizationStore';
import { useWalletStore } from '@/stores/walletStore';
import { useAffiliateStore } from '@/stores/affiliateStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { listReceivedRequests } from '@/lib/api/collaboration';

const actionItems = [
  {
    href: '/messages',
    labelKey: 'messages' as const,
    descKey: 'messages' as const,
    fallback: 'Messages',
    description: 'Chat with your connections in real-time.',
    Icon: Chat24Regular,
    gradient: 'from-green-500 to-emerald-400',
    bgGlow: 'bg-green-500/[0.08]',
    borderColor: 'border-green-500/20',
    hoverBorder: 'hover:border-green-400/40',
    hoverGlow: 'group-hover:shadow-green-500/20',
    badgeKey: 'messages' as const,
  },
  {
    href: '/tasks',
    labelKey: 'tasks' as const,
    descKey: 'tasks' as const,
    fallback: 'Tasks',
    description: 'Manage your tasks with list, kanban, and calendar views.',
    Icon: TaskListSquareLtr24Regular,
    gradient: 'from-emerald-500 to-teal-400',
    bgGlow: 'bg-emerald-500/[0.08]',
    borderColor: 'border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-400/40',
    hoverGlow: 'group-hover:shadow-emerald-500/20',
  },
  {
    href: '/wallet',
    labelKey: 'wallet' as const,
    descKey: 'wallet' as const,
    fallback: 'Wallet',
    description: 'View your points balance, transaction history, and buy points.',
    Icon: Wallet24Regular,
    gradient: 'from-emerald-500 to-teal-400',
    bgGlow: 'bg-emerald-500/[0.08]',
    borderColor: 'border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-400/40',
    hoverGlow: 'group-hover:shadow-emerald-500/20',
    badgeKey: 'wallet' as const,
  },
  {
    href: '/payments',
    labelKey: 'payments' as const,
    descKey: 'payments' as const,
    fallback: 'Payments',
    description: 'View your subscription, billing history, and point purchases.',
    Icon: ReceiptMoney24Regular,
    gradient: 'from-indigo-500 to-blue-400',
    bgGlow: 'bg-indigo-500/[0.08]',
    borderColor: 'border-indigo-500/20',
    hoverBorder: 'hover:border-indigo-400/40',
    hoverGlow: 'group-hover:shadow-indigo-500/20',
  },
  {
    href: '/explorer',
    labelKey: 'explorer' as const,
    descKey: 'explorer' as const,
    fallback: 'Explorer',
    description: 'Search and discover professionals across industries.',
    Icon: Search24Regular,
    gradient: 'from-amber-500 to-yellow-400',
    bgGlow: 'bg-amber-500/[0.08]',
    borderColor: 'border-amber-500/20',
    hoverBorder: 'hover:border-amber-400/40',
    hoverGlow: 'group-hover:shadow-amber-500/20',
  },
  {
    href: '/collaborations',
    labelKey: 'collaborations' as const,
    descKey: 'collaborations' as const,
    fallback: 'Collaboration Requests',
    description: 'Manage collaboration requests and work with partners.',
    Icon: Target24Regular,
    gradient: 'from-violet-500 to-purple-400',
    bgGlow: 'bg-violet-500/[0.08]',
    borderColor: 'border-violet-500/20',
    hoverBorder: 'hover:border-violet-400/40',
    hoverGlow: 'group-hover:shadow-violet-500/20',
    badgeKey: 'collaborations' as const,
  },
  {
    href: '/map',
    labelKey: 'network' as const,
    descKey: 'network' as const,
    fallback: 'Network',
    description: 'Visualize and explore your professional network graph.',
    Icon: PeopleTeam24Regular,
    gradient: 'from-cyan-500 to-sky-400',
    bgGlow: 'bg-cyan-500/[0.08]',
    borderColor: 'border-cyan-500/20',
    hoverBorder: 'hover:border-cyan-400/40',
    hoverGlow: 'group-hover:shadow-cyan-500/20',
  },
  {
    href: '/calendar',
    labelKey: 'calendar' as const,
    descKey: 'calendar' as const,
    fallback: 'Calendar',
    description: 'Manage your meetings, reminders, and follow-ups.',
    Icon: Calendar24Regular,
    gradient: 'from-blue-500 to-indigo-400',
    bgGlow: 'bg-blue-500/[0.08]',
    borderColor: 'border-blue-500/20',
    hoverBorder: 'hover:border-blue-400/40',
    hoverGlow: 'group-hover:shadow-blue-500/20',
  },
  {
    href: '/profile',
    labelKey: 'profile' as const,
    descKey: 'profile' as const,
    fallback: 'Profile',
    description: 'View and edit your professional profile and settings.',
    Icon: Person24Regular,
    gradient: 'from-slate-400 to-zinc-400',
    bgGlow: 'bg-slate-500/[0.08]',
    borderColor: 'border-slate-500/20',
    hoverBorder: 'hover:border-slate-400/40',
    hoverGlow: 'group-hover:shadow-slate-500/20',
  },
];

export default function ActionsPage() {
  const { t } = useI18n();
  const unreadCount = useMessageStore((s) => s.unreadCount);
  const { balance, fetchBalance } = useWalletStore();
  const organization = useOrganizationStore((s) => s.organization);
  const { isAffiliate, checked: affiliateChecked, checkIsAffiliate } = useAffiliateStore();
  const notifUnreadCount = useNotificationStore((s) => s.unreadCount);
  const [pendingCollabCount, setPendingCollabCount] = useState(0);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  useEffect(() => { if (!affiliateChecked) checkIsAffiliate(); }, [affiliateChecked, checkIsAffiliate]);
  useEffect(() => {
    listReceivedRequests({ status: 'PENDING', limit: 1 })
      .then((res) => setPendingCollabCount(res.total))
      .catch(() => {});
  }, [notifUnreadCount]);

  const allItems: Array<{
    href: string;
    labelKey: string;
    descKey: string;
    fallback: string;
    description: string;
    Icon: any;
    gradient: string;
    bgGlow: string;
    borderColor: string;
    hoverBorder: string;
    hoverGlow: string;
    badgeKey?: string;
  }> = [...actionItems];

  if (organization) {
    allItems.push({
      href: '/settings/organization',
      labelKey: 'team',
      descKey: 'team',
      fallback: organization.name || 'Team',
      description: 'Manage your team members, billing, and organization settings.',
      Icon: Building24Regular,
      gradient: 'from-teal-500 to-cyan-400',
      bgGlow: 'bg-teal-500/[0.08]',
      borderColor: 'border-teal-500/20',
      hoverBorder: 'hover:border-teal-400/40',
      hoverGlow: 'group-hover:shadow-teal-500/20',
    });
  }

  // Show affiliate program card - different link based on status
  allItems.push({
    href: isAffiliate ? '/affiliate' : '/affiliate/apply',
    labelKey: 'affiliate',
    descKey: isAffiliate ? 'affiliate' : 'becomeAffiliate',
    fallback: isAffiliate ? 'Affiliate Program' : 'Become an Affiliate',
    description: isAffiliate
      ? 'Manage your affiliate codes, referrals, and earnings.'
      : 'Join our affiliate program and start earning commissions.',
    Icon: PeopleAudience24Regular,
    gradient: 'from-rose-500 to-pink-400',
    bgGlow: 'bg-rose-500/[0.08]',
    borderColor: 'border-rose-500/20',
    hoverBorder: 'hover:border-rose-400/40',
    hoverGlow: 'group-hover:shadow-rose-500/20',
  });

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 mb-3">
          <Apps24Regular className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          {t.bottomNav?.actions || 'Actions'}
        </h1>
        <p className="text-white font-bold mt-1 max-w-sm mx-auto text-sm text-center">
          {(t.actionsHub as any)?.subtitle || 'Tools to connect, communicate, and manage your network'}
        </p>
      </div>

      {/* Grid of options */}
      <div className="grid grid-cols-2 gap-4 px-1">
        {allItems.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="group h-full"
          >
            <div
              className={`relative overflow-hidden rounded-2xl border ${option.borderColor} ${option.bgGlow} p-5 h-full flex flex-col transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group-hover:shadow-lg ${option.hoverGlow} ${option.hoverBorder}`}
            >
              {/* Background gradient accent */}
              <div
                className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${option.gradient} opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.22]`}
              />

              {/* Icon */}
              <div
                className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${option.gradient} flex items-center justify-center mb-4 shadow-lg shadow-black/20`}
              >
                <option.Icon className="w-7 h-7 text-white" />
                {'badgeKey' in option && option.badgeKey === 'messages' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-lg">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {'badgeKey' in option && option.badgeKey === 'collaborations' && pendingCollabCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-violet-500 text-white text-[10px] font-bold leading-none shadow-lg">
                    {pendingCollabCount > 99 ? '99+' : pendingCollabCount}
                  </span>
                )}
                {'badgeKey' in option && option.badgeKey === 'wallet' && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none shadow-lg">
                    {balance}
                  </span>
                )}
              </div>

              {/* Label */}
              <h3 className="font-bold text-white text-lg mb-1.5">
                {(t.bottomNav as any)?.[option.labelKey] || option.fallback}
              </h3>

              {/* Description */}
              <p className="text-sm text-white font-bold leading-relaxed line-clamp-2 flex-1">
                {(t.actionsHub as any)?.cards?.[option.descKey] || option.description}
              </p>

              {/* Arrow */}
              <div className="relative mt-3 flex items-center gap-2 text-sm">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-400 text-[#042820] font-bold text-xs">{t.matchingHub?.open || 'Open'}</span>
                <ArrowRight24Regular className="w-4 h-4 group-hover:translate-x-0.5 transition-transform rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
