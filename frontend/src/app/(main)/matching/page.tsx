'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  Lightbulb24Regular,
  Rocket24Regular,
  Handshake24Regular,
  Briefcase24Regular,
  Sparkle24Regular,
  ArrowRight24Regular,
  People24Regular,
} from '@fluentui/react-icons';
import { getProjects } from '@/lib/api/projects';
import { getDeals } from '@/lib/api/deals';
import { listPitches } from '@/lib/api/pitch';
import { listOpportunities } from '@/lib/api/opportunities';

interface CardCounts {
  items: number;
  matches: number;
}

const matchingOptions = [
  {
    href: '/projects',
    labelKey: 'projects' as const,
    fallback: 'Projects',
    description: 'Create project ideas and get AI-matched with collaborators.',
    Icon: Lightbulb24Regular,
    gradient: 'from-emerald-500 to-teal-400',
    bgGlow: 'bg-emerald-500/[0.08]',
    borderColor: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-400/40',
    hoverGlow: 'group-hover:shadow-emerald-500/20',
    matchBg: 'bg-emerald-500/15 border-emerald-500/25',
    matchText: 'text-emerald-400',
    countKey: 'projects' as const,
  },
  {
    href: '/pitch',
    labelKey: 'pitch' as const,
    fallback: 'Pitch',
    description: 'Upload pitch decks and find the right people to connect with.',
    Icon: Rocket24Regular,
    gradient: 'from-violet-500 to-purple-400',
    bgGlow: 'bg-violet-500/[0.08]',
    borderColor: 'border-violet-500/20',
    iconColor: 'text-violet-400',
    hoverBorder: 'hover:border-violet-400/40',
    hoverGlow: 'group-hover:shadow-violet-500/20',
    matchBg: 'bg-violet-500/15 border-violet-500/25',
    matchText: 'text-violet-400',
    countKey: 'pitch' as const,
  },
  {
    href: '/deals',
    labelKey: 'smartDeals' as const,
    fallback: 'Smart Deals',
    description: 'Describe what you need and let AI find the best contacts for you.',
    Icon: Handshake24Regular,
    gradient: 'from-blue-500 to-cyan-400',
    bgGlow: 'bg-blue-500/[0.08]',
    borderColor: 'border-blue-500/20',
    iconColor: 'text-blue-400',
    hoverBorder: 'hover:border-blue-400/40',
    hoverGlow: 'group-hover:shadow-blue-500/20',
    matchBg: 'bg-blue-500/15 border-blue-500/25',
    matchText: 'text-blue-400',
    countKey: 'deals' as const,
  },
  {
    href: '/opportunities',
    labelKey: 'opportunities' as const,
    fallback: 'Jobs',
    description: 'Post or find job opportunities and get matched with talent.',
    Icon: Briefcase24Regular,
    gradient: 'from-emerald-500 to-teal-400',
    bgGlow: 'bg-emerald-500/[0.08]',
    borderColor: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-400/40',
    hoverGlow: 'group-hover:shadow-emerald-500/20',
    matchBg: 'bg-emerald-500/15 border-emerald-500/25',
    matchText: 'text-emerald-400',
    countKey: 'opportunities' as const,
  },
];

export default function MatchingPage() {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Record<string, CardCounts>>({
    projects: { items: 0, matches: 0 },
    pitch: { items: 0, matches: 0 },
    deals: { items: 0, matches: 0 },
    opportunities: { items: 0, matches: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [projectsRes, pitchRes, dealsRes, oppsRes] = await Promise.all([
          getProjects({ limit: 200, status: 'active' }).catch(() => null),
          listPitches({ limit: 200 }).catch(() => null),
          getDeals({ limit: 200 }).catch(() => null),
          listOpportunities({ status: 'active' }).catch(() => null),
        ]);

        const projectsList = projectsRes?.projects || [];
        const pitchList = pitchRes?.pitches || [];
        const dealsList = dealsRes?.deals || [];
        const oppsList = oppsRes?.opportunities || [];

        setCounts({
          projects: {
            items: projectsList.length,
            matches: projectsList.reduce((sum: number, p: any) => sum + (p.matchCount || 0), 0),
          },
          pitch: {
            items: pitchList.length,
            matches: pitchList.reduce((sum: number, p: any) => sum + (p.matchCount || 0), 0),
          },
          deals: {
            items: dealsList.length,
            matches: dealsList.reduce((sum: number, d: any) => sum + (d.matchCount || 0), 0),
          },
          opportunities: {
            items: oppsList.length,
            matches: oppsList.reduce((sum: number, o: any) => sum + (o.matchCount || 0), 0),
          },
        });
      } catch {}
      setLoading(false);
    }
    fetchCounts();
  }, []);

  const totalMatches = Object.values(counts).reduce((s, c) => s + c.matches, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 mb-3">
          <Sparkle24Regular className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          {t.bottomNav?.matching || 'Matching'}
        </h1>
        <p className="text-white font-bold mt-1 max-w-xs mx-auto text-sm">
          {t.matchingHub?.subtitle || 'AI-powered tools to find the right people for your goals'}
        </p>
      </div>

      {/* Grid of options */}
      <div className="grid grid-cols-2 gap-4 px-1">
        {matchingOptions.map((option) => {
          const cardCounts = counts[option.countKey];
          return (
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
                </div>

                {/* Label */}
                <h3 className="font-bold text-white text-lg mb-1.5">
                  {t.bottomNav?.[option.labelKey] || option.fallback}
                </h3>

                {/* Description */}
                <p className="text-sm text-white font-bold leading-relaxed line-clamp-2 flex-1">
                  {(t.matchingHub?.cards as any)?.[option.labelKey] || option.description}
                </p>

                {/* Counters */}
                <div className="relative mt-3 flex items-center gap-2">
                  {loading ? (
                    <div className="flex gap-2">
                      <div className="h-5 w-10 bg-white/5 rounded-full animate-pulse" />
                      <div className="h-5 w-12 bg-white/5 rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${option.matchBg}`}>
                        <option.Icon className={`w-4 h-4 ${option.matchText}`} />
                        <span className={`text-xs font-bold ${option.matchText}`}>{cardCounts.items}</span>
                      </div>
                      {cardCounts.matches > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/10">
                          <People24Regular className="w-4 h-4 text-white" />
                          <span className="text-xs font-bold text-white">{cardCounts.matches}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Arrow */}
                <div className="relative mt-3 flex items-center gap-2 text-sm">
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-400 text-[#042820] font-bold text-xs">{t.matchingHub?.open || 'Open'}</span>
                  <ArrowRight24Regular className="w-4 h-4 group-hover:translate-x-0.5 transition-transform rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* View all matches link */}
      <Link
        href="/matches"
        className="block mx-1"
      >
        <div className="bg-gradient-to-r from-emerald-500/[0.08] to-teal-500/[0.08] border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/[0.12] active:scale-[0.98]">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
            <Sparkle24Regular className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-sm">{t.matchingHub?.viewAllMatches || 'View All Matches'}</h3>
            <p className="text-xs text-white font-bold">{t.matchingHub?.viewAllMatchesSub || 'See all AI matches across projects, deals, pitch, and jobs'}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!loading && totalMatches > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold">
                {totalMatches}
              </span>
            )}
            <ArrowRight24Regular className="w-5 h-5 text-white/80 rtl:rotate-180" />
          </div>
        </div>
      </Link>
    </div>
  );
}
