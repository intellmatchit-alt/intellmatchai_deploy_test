'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/hooks/useOrganization';
import { organizationApi } from '@/lib/api/organization';
import {
  ArrowLeft24Regular,
  Building24Regular,
  People24Regular,
  Money24Regular,
  Shield24Regular,
  History24Regular,
  ChevronRight24Regular,
  Edit24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Handshake24Regular,
  Globe24Regular,
  Briefcase24Regular,
} from '@fluentui/react-icons';

export default function OrganizationSettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { organization, isLoading, fetchOrganization, isAdmin, isOwner } = useOrganization();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setWebsite(organization.website || '');
      setIndustry(organization.industry || '');
    }
  }, [organization]);

  const handleSave = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      await organizationApi.updateOrganization(organization.id, { name, website, industry });
      await fetchOrganization();
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
            <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
          </button>
          <h1 className="text-2xl font-bold text-th-text">{t.organization?.title || 'Organization'}</h1>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-8 text-center">
          <Building24Regular className="w-12 h-12 text-th-text-m mx-auto mb-3" />
          <p className="text-th-text-t mb-4">{t.organization?.noOrg || 'You are not part of any organization yet.'}</p>
          <p className="text-sm text-th-text-m">{t.organization?.noOrgDesc || 'Upgrade to the Team plan to create an organization and invite your team.'}</p>
          <Link href="/checkout?plan=TEAM" className="mt-4 inline-block px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
            {t.organization?.upgradeToPlan || 'Upgrade to Team'}
          </Link>
        </div>
      </div>
    );
  }

  const totalSeats = organization.subscription?.seats || 0;
  const usedSeats = organization.members?.length || 0;
  const seatPercent = totalSeats > 0 ? Math.round((usedSeats / totalSeats) * 100) : 0;

  const settingsLinks = [
    {
      href: '/settings/organization/members',
      icon: People24Regular,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      label: t.organization?.members || 'Members',
      desc: `${usedSeats} ${t.organization?.membersCount || 'members'} · ${totalSeats - usedSeats} ${t.organization?.seatsAvailable || 'seats available'}`,
      show: true,
    },
    {
      href: '/settings/organization/billing',
      icon: Money24Regular,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      label: t.organization?.teamBilling || 'Team Billing',
      desc: t.organization?.manageBilling || 'Manage seats and billing',
      show: isOwner,
    },
    {
      href: '/settings/organization/privacy',
      icon: Shield24Regular,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      label: t.organization?.privacySharing || 'Privacy & Sharing',
      desc: t.organization?.controlVisibility || 'Control what teammates see',
      show: true,
    },
    {
      href: '/settings/organization/activity',
      icon: History24Regular,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/20',
      label: t.organization?.activityLog || 'Activity Log',
      desc: t.organization?.trackActions || 'Track team actions',
      show: isAdmin,
    },
    {
      href: '/settings/organization/intros',
      icon: Handshake24Regular,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      label: t.organization?.warmIntros || 'Warm Intros',
      desc: t.organization?.manageIntros || 'Request and manage introductions',
      show: true,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.organization?.title || 'Organization'}</h1>
      </div>

      {/* Org Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-th-border">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-emerald-600/15 to-emerald-600/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.15),transparent_60%)]" />

        <div className="relative p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Org Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-500/20">
                  {organization.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-th-border flex items-center justify-center">
                  <Checkmark24Regular className="w-3 h-3 text-th-text" />
                </div>
              </div>

              <div className="flex-1">
                {editing ? (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-th-surface-h border border-white/20 rounded-lg px-3 py-1.5 text-th-text text-lg font-semibold focus:outline-none focus:border-emerald-500 w-full max-w-xs"
                    autoFocus
                  />
                ) : (
                  <h2 className="text-xl font-bold text-th-text">{organization.name}</h2>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded-full font-semibold border border-emerald-500/20">
                    {organization.subscription?.plan || 'TEAM'} Plan
                  </span>
                  {organization.industry && (
                    <span className="inline-flex items-center gap-1 text-xs text-th-text-t">
                      <Briefcase24Regular className="w-3 h-3" />
                      {organization.industry}
                    </span>
                  )}
                  {organization.website && (
                    <span className="inline-flex items-center gap-1 text-xs text-th-text-t">
                      <Globe24Regular className="w-3 h-3" />
                      {organization.website.replace(/^https?:\/\//, '')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button onClick={handleSave} disabled={saving} className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl transition-colors border border-emerald-500/20">
                      <Checkmark24Regular className="w-5 h-5 text-emerald-400" />
                    </button>
                    <button onClick={() => { setEditing(false); setName(organization.name); setWebsite(organization.website || ''); setIndustry(organization.industry || ''); }} className="p-2 bg-th-surface-h hover:bg-th-surface-h rounded-xl transition-colors">
                      <Dismiss24Regular className="w-5 h-5 text-th-text-t" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} className="p-2 bg-th-surface-h hover:bg-th-surface-h rounded-xl transition-colors">
                    <Edit24Regular className="w-5 h-5 text-th-text-t" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Edit fields */}
          {editing && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-th-text-t mb-1 block">{t.organization?.website || 'Website'}</label>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2.5 text-sm text-th-text placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-th-text-t mb-1 block">{t.organization?.industry || 'Industry'}</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Technology" className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2.5 text-sm text-th-text placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="mt-5 grid grid-cols-3 gap-4">
            <div className="bg-th-surface rounded-xl p-3 text-center border border-th-border-s">
              <p className="text-2xl font-bold text-th-text">{usedSeats}</p>
              <p className="text-xs text-th-text-t mt-0.5">{t.organization?.members || 'Members'}</p>
            </div>
            <div className="bg-th-surface rounded-xl p-3 text-center border border-th-border-s">
              <p className="text-2xl font-bold text-th-text">{organization._count?.sharedContacts || 0}</p>
              <p className="text-xs text-th-text-t mt-0.5">{t.organization?.sharedContacts || 'Shared Contacts'}</p>
            </div>
            <div className="bg-th-surface rounded-xl p-3 text-center border border-th-border-s">
              <p className="text-2xl font-bold text-th-text">{totalSeats - usedSeats}</p>
              <p className="text-xs text-th-text-t mt-0.5">{t.organization?.seatsAvailable || 'Available'}</p>
            </div>
          </div>

          {/* Seat progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-th-text-t">{t.organization?.seatsUsed || 'Seat Usage'}</span>
              <span className="text-xs font-medium text-th-text-s">{seatPercent}%</span>
            </div>
            <div className="h-1.5 bg-th-surface-h rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(seatPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Links */}
      <div className="space-y-2">
        {settingsLinks.filter(l => l.show).map((link, i) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between p-4 bg-th-surface border border-white/[0.06] rounded-xl hover:bg-th-surface-h hover:border-white/[0.12] transition-all group"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${link.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${link.iconColor}`} />
                </div>
                <div>
                  <p className="font-medium text-th-text group-hover:text-emerald-300 transition-colors">{link.label}</p>
                  <p className="text-sm text-th-text-m">{link.desc}</p>
                </div>
              </div>
              <ChevronRight24Regular className="w-5 h-5 text-white/70 group-hover:text-th-text-t transition-colors rtl:rotate-180" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
