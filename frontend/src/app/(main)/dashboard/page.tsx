/**
 * Dashboard Page
 *
 * Professional dashboard with analytics, insights, and quick actions.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/ui/Avatar";
import { getStats, NetworkStats } from "@/lib/api/graph";
import { getMatches, MatchesResponse } from "@/lib/api/matches";
import {
  getProjects,
  getProjectMatches,
  type Project,
  type ProjectMatch,
} from "@/lib/api/projects";
import { getDeals, getDealResults } from "@/lib/api/deals";
import { listPitches, getPitchResults } from "@/lib/api/pitch";
import {
  getOpportunitiesStats,
  getAllMatches as getAllOpportunityMatches,
} from "@/lib/api/opportunities";
import {
  getConversations,
  type ConversationListItem,
} from "@/lib/api/messages";
import {
  listReceivedRequests,
  acceptCollaborationRequest,
  rejectCollaborationRequest,
  type CollaborationRequest,
} from "@/lib/api/collaboration";
import {
  getContacts,
  Contact,
  getAllTasks,
  getAllReminders,
  updateContactTask,
  updateContactReminder,
  type ContactTask,
  type ContactReminder,
} from "@/lib/api/contacts";
import {
  getDashboard,
  getChartData,
  DashboardData,
  DashboardCharts,
  ComparisonPeriod,
} from "@/lib/api/dashboard";
import {
  LineChart,
  BarChart,
  DonutChart,
  Sparkline,
} from "@/components/charts";
import { MatchCard, type MatchCardData } from "@/components/features/matches";
import {
  Camera24Regular,
  PersonAdd24Regular,
  ArrowTrendingLines24Regular,
  People24Regular,
  Handshake24Regular,
  ArrowRight24Regular,
  CalendarLtr24Regular,
  Target24Regular,
  Sparkle24Regular,
  Clock24Regular,
  Eye24Regular,
  Mail24Regular,
  Chat24Regular,
  ChevronRight24Regular,
  ArrowUp24Regular,
  ArrowDown24Regular,
  MoreHorizontal24Regular,
  Star24Filled,
  CheckmarkCircle24Regular,
  Circle24Regular,
  ChartMultiple24Regular,
  TaskListSquareAdd24Regular,
  Play24Regular,
  Pause24Regular,
  PersonCircle24Regular,
  Search24Regular,
  Image24Regular,
  Dismiss24Regular,
  Lightbulb24Regular,
  Rocket24Regular,
  Briefcase24Regular,
  Open24Regular,
} from "@fluentui/react-icons";
import { api } from "@/lib/api/client";
import { TaskActionPopup } from "@/components/tasks/TaskActionPopup";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores";

// ============================================================
// Match Actions Popup — shown on dashboard top matches
// ============================================================
const SOURCE_ICON_MAP: Record<string, any> = {
  project: Lightbulb24Regular,
  deal: Handshake24Regular,
  pitch: Rocket24Regular,
  job: Briefcase24Regular,
};
const getSourceLabelMap = (t: any): Record<string, string> => ({
  project: t.matchesPage?.projects || "Project",
  deal: t.matchesPage?.deals || "Deal",
  pitch: t.matchesPage?.pitches || "Pitch",
  job: t.matchesPage?.jobs || "Job",
});
const SOURCE_ROUTE_MAP: Record<string, string> = {
  project: "/projects",
  deal: "/deals",
  pitch: "/pitch",
  job: "/opportunities",
};

function MatchActionsPopup({
  match,
  open,
  onClose,
  t,
}: {
  match: MatchCardData;
  open: boolean;
  onClose: () => void;
  t: any;
}) {
  const router = useRouter();
  if (!open) return null;

  const SourceIcon = SOURCE_ICON_MAP[match.source] || Sparkle24Regular;
  const sourceLabelMap = getSourceLabelMap(t);
  const sourceLabel =
    (t.matchesPage as any)?.[
      match.source === "job" ? "jobs" : match.source + "s"
    ] ||
    sourceLabelMap[match.source] ||
    match.source;
  const sourceRoute = SOURCE_ROUTE_MAP[match.source];
  const sourceHref = match.sourceId
    ? `${sourceRoute}/${match.sourceId}`
    : sourceRoute;
  const contactHref = `/contacts/${match.contactId}`;
  const matchHref = `/contacts/${match.contactId}?expand=${match.source === "job" ? "opportunity" : match.source}${match.sourceId ? `&item=${match.sourceId}` : ""}`;

  const actions = [
    {
      label: t.matchesPage?.viewMatch || "View Match Details",
      icon: <Sparkle24Regular className="w-5 h-5 text-emerald-400" />,
      href: matchHref,
      accent: "hover:bg-emerald-500/10",
    },
    {
      label: `${t.matchingHub?.open || "Open"} ${sourceLabel}`,
      sublabel: match.sourceTitle,
      icon: <SourceIcon className="w-5 h-5 text-blue-400" />,
      href: sourceHref,
      accent: "hover:bg-blue-500/10",
    },
    {
      label: t.matchesPage?.viewContact || "View Contact",
      sublabel: match.name,
      icon: <PersonCircle24Regular className="w-5 h-5 text-violet-400" />,
      href: contactHref,
      accent: "hover:bg-violet-500/10",
    },
  ];

  // Add channels if available
  if (match.channels.phone) {
    actions.push({
      label: t.common?.call || "Call",
      sublabel: match.channels.phone,
      icon: <Chat24Regular className="w-5 h-5 text-green-400" />,
      href: `tel:${match.channels.phone}`,
      accent: "hover:bg-green-500/10",
    });
  }
  if (match.channels.email) {
    actions.push({
      label: t.common?.email || "Email",
      sublabel: match.channels.email,
      icon: <Mail24Regular className="w-5 h-5 text-orange-400" />,
      href: `mailto:${match.channels.email}`,
      accent: "hover:bg-orange-500/10",
    });
  }
  if (match.channels.linkedinUrl) {
    actions.push({
      label: "LinkedIn",
      sublabel: undefined,
      icon: <Open24Regular className="w-5 h-5 text-sky-400" />,
      href: match.channels.linkedinUrl,
      accent: "hover:bg-sky-500/10",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-[#131b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-500/40 flex items-center justify-center">
            <span className="text-sm font-bold text-emerald-400">
              {Math.round(match.score)}%
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{match.name}</p>
            <p className="text-xs text-white/50 truncate">
              {match.company || match.sourceTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <Dismiss24Regular className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Actions list */}
        <div className="p-2">
          {actions.map((action, i) => {
            const isExternal =
              action.href.startsWith("tel:") ||
              action.href.startsWith("mailto:") ||
              action.href.startsWith("http");
            const Wrapper = isExternal ? "a" : Link;
            const extraProps = isExternal
              ? {
                  target: action.href.startsWith("http") ? "_blank" : undefined,
                  rel: action.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined,
                }
              : {};

            return (
              <Wrapper
                key={i}
                href={action.href}
                onClick={() => onClose()}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${action.accent}`}
                {...(extraProps as any)}
              >
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {action.label}
                  </p>
                  {action.sublabel && (
                    <p className="text-xs text-white/40 truncate">
                      {action.sublabel}
                    </p>
                  )}
                </div>
                <ChevronRight24Regular className="w-4 h-4 text-white/30 flex-shrink-0 rtl:rotate-180" />
              </Wrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Circular score ring (SVG) for mobile dashboard
 */
function ScoreRing({
  value,
  size = 80,
  strokeWidth = 6,
  label,
  color = "#10B981",
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold text-white"
            style={{ fontSize: size * 0.28 }}
          >
            {value}
          </span>
        </div>
      </div>
      {label && <span className="text-xs text-white/60">{label}</span>}
    </div>
  );
}

/**
 * Compact mobile quick action icon button
 */
function MobileQuickAction({
  href,
  icon,
  title,
  gradient,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 snap-start flex-shrink-0 group"
      style={{ width: 72 }}
    >
      <div
        className={`w-14 h-14 ${gradient} rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-200 group-hover:scale-110 group-active:scale-95 group-hover:shadow-xl`}
      >
        {icon}
      </div>
      <span className="text-[11px] text-white/70 text-center leading-tight truncate w-full">
        {title}
      </span>
    </Link>
  );
}

/**
 * Quick action card
 */
function QuickActionCard({
  href,
  icon,
  title,
  description,
  gradient,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <Link href={href} className="group">
      <div className="relative h-full">
        <div
          className={`absolute inset-0 ${gradient} rounded-xl blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-300`}
        />
        <div className="relative bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-300 hover:-translate-y-1 h-full">
          <div
            className={`w-10 h-10 ${gradient} rounded-lg flex items-center justify-center text-white mb-3`}
          >
            {icon}
          </div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/60 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}

/**
 * Enhanced stat card with sparkline
 */
function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  gradient,
  sparklineData,
  sparklineColor,
  tooltip,
  href,
}: {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  gradient: string;
  sparklineData?: number[];
  sparklineColor?: string;
  tooltip?: string;
  href?: string;
}) {
  const isPositive = change && change > 0;
  const [showTooltip, setShowTooltip] = useState(false);

  const content = (
    <div
      className={`relative bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5 hover:bg-th-surface-h transition-colors ${href ? "cursor-pointer" : ""}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {tooltip && showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-th-bg-t border border-th-border rounded-lg shadow-xl max-w-xs">
          <p className="text-xs text-neutral-200 whitespace-normal">
            {tooltip}
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800" />
        </div>
      )}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 ${gradient} rounded-xl flex items-center justify-center text-white shadow-lg`}
        >
          {icon}
        </div>
        {sparklineData && sparklineData.length > 1 && sparklineColor && (
          <Sparkline
            data={sparklineData}
            color={sparklineColor}
            width={80}
            height={24}
          />
        )}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-white/60 mt-1">{label}</p>
      {change !== undefined && changeLabel && (
        <div className="flex items-center gap-1 mt-2">
          {isPositive ? (
            <ArrowUp24Regular className="w-4 h-4 text-green-400" />
          ) : change < 0 ? (
            <ArrowDown24Regular className="w-4 h-4 text-red-400" />
          ) : null}
          <span
            className={`text-sm font-medium ${isPositive ? "text-green-400" : change < 0 ? "text-red-400" : "text-white/60"}`}
          >
            {isPositive ? "+" : ""}
            {change}%
          </span>
          <span className="text-xs text-white/50">{changeLabel}</span>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

/**
 * Activity item
 */
function ActivityItem({
  icon,
  iconBg,
  title,
  description,
  time,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center text-white flex-shrink-0`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{title}</p>
        <p className="text-xs text-white/50">{description}</p>
      </div>
      <span className="text-xs text-white/50 flex-shrink-0">{time}</span>
    </div>
  );
}

/**
 * Recommendation card
 */
function RecommendationCard({
  id,
  name,
  company,
  score,
  reason,
  avatarUrl,
  tags,
}: {
  id: string;
  name: string;
  company: string;
  score: number;
  reason: string;
  avatarUrl?: string;
  tags?: string[];
}) {
  return (
    <Link href={`/contacts/${id}`} className="block group">
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar src={avatarUrl} name={name} size="lg" />
            <div className="absolute -bottom-1 -end-1 w-5 h-5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center">
              <Star24Filled className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white truncate">{name}</h3>
                <p className="text-sm text-white/60 truncate">{company}</p>
              </div>
              <div className="flex flex-col items-center ms-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                  <span className="text-sm font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    {score}%
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-emerald-400 mt-2">{reason}</p>
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-th-surface rounded-full text-xs text-white/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Insight card
 */
function InsightCard({
  icon,
  title,
  description,
  action,
  gradient,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  gradient: string;
  href?: string;
}) {
  const content = (
    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm border border-th-border rounded-xl p-4 hover:border-emerald-500/30 transition-all duration-200 cursor-pointer group h-full">
      <div
        className={`w-10 h-10 ${gradient} rounded-xl flex items-center justify-center text-white mb-3`}
      >
        {icon}
      </div>
      <h3 className="font-medium text-white mb-1">{title}</h3>
      <p className="text-sm text-white/60 mb-3">{description}</p>
      <span className="text-sm text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1">
        {action}
        <ChevronRight24Regular className="w-4 h-4 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform rtl:rotate-180" />
      </span>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

/**
 * Network Health Score Card
 */
function NetworkHealthCard({
  health,
  t,
}: {
  health: DashboardData["health"] | null;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (!health) {
    return (
      <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl p-4 animate-pulse">
        <div className="h-4 w-32 bg-th-surface-h rounded mb-4" />
        <div className="h-8 w-16 bg-th-surface-h rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-th-surface-h rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-white/60">
          {t.dashboard.overallScore}
        </span>
        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
          {health.overallScore}/100
        </span>
      </div>
      <div className="space-y-3">
        <div className="group relative flex items-center justify-between text-sm cursor-help">
          <span className="text-white/60">{t.dashboard.diversity}</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-th-surface-h rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${health.diversity.score}%` }}
              />
            </div>
            <span className="text-green-400 text-xs">
              {health.diversity.score}%
            </span>
          </div>
          <div className="invisible group-hover:visible absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-th-bg-t border border-th-border rounded-lg shadow-xl max-w-xs whitespace-normal">
            <p className="text-xs text-neutral-200">
              {t.dashboard.tooltips?.diversity}
            </p>
          </div>
        </div>
        <div className="group relative flex items-center justify-between text-sm cursor-help">
          <span className="text-white/60">{t.dashboard.engagement}</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-th-surface-h rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${health.engagement.score}%` }}
              />
            </div>
            <span className="text-blue-400 text-xs">
              {health.engagement.score}%
            </span>
          </div>
          <div className="invisible group-hover:visible absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-th-bg-t border border-th-border rounded-lg shadow-xl max-w-xs whitespace-normal">
            <p className="text-xs text-neutral-200">
              {t.dashboard.tooltips?.engagement}
            </p>
          </div>
        </div>
        <div className="group relative flex items-center justify-between text-sm cursor-help">
          <span className="text-white/60">{t.dashboard.growth}</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-th-surface-h rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${health.growth.score}%` }}
              />
            </div>
            <span className="text-emerald-400 text-xs">
              {health.growth.score}%
            </span>
          </div>
          <div className="invisible group-hover:visible absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-th-bg-t border border-th-border rounded-lg shadow-xl max-w-xs whitespace-normal">
            <p className="text-xs text-neutral-200">
              {t.dashboard.tooltips?.growth}
            </p>
          </div>
        </div>
        <div className="group relative flex items-center justify-between text-sm cursor-help">
          <span className="text-white/60">
            {t.dashboard.quality || "Quality"}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-th-surface-h rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${health.quality.score}%` }}
              />
            </div>
            <span className="text-cyan-400 text-xs">
              {health.quality.score}%
            </span>
          </div>
          <div className="invisible group-hover:visible absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-th-bg-t border border-th-border rounded-lg shadow-xl max-w-xs whitespace-normal">
            <p className="text-xs text-neutral-200">
              {t.dashboard.tooltips?.quality}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  // refresh to get latest user from DB
  const { refreshUser } = useAuthStore();
  // to view the name from localstorage
  const p2pAuthRaw = localStorage.getItem("p2p-auth");
  const p2pAuth = p2pAuthRaw ? JSON.parse(p2pAuthRaw) : null;
  const myName = p2pAuth?.state?.user?.user?.name;
  useEffect(() => {
    refreshUser();
  }, []);
  const { t, isRTL } = useI18n();
  const router = useRouter();

  // State for API data
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [chartData, setChartData] = useState<DashboardCharts | null>(null);
  const [recommendations, setRecommendations] = useState<
    Array<{
      id: string;
      name: string;
      company: string;
      score: number;
      reason: string;
      tags: string[];
      avatarUrl?: string;
    }>
  >([]);
  const [topMatches, setTopMatches] = useState<MatchCardData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(
    null,
  );
  const [tasks, setTasks] = useState<ContactTask[]>([]);
  const [reminders, setReminders] = useState<ContactReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<ComparisonPeriod>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [actionPopup, setActionPopup] = useState<{
    type: "task" | "reminder";
    item: ContactTask | ContactReminder;
  } | null>(null);
  const [imagePopup, setImagePopup] = useState<string[] | null>(null);
  const [recentConversations, setRecentConversations] = useState<
    ConversationListItem[]
  >([]);
  const [pendingCollabRequests, setPendingCollabRequests] = useState<
    CollaborationRequest[]
  >([]);
  const [collabActionLoading, setCollabActionLoading] = useState<string | null>(
    null,
  );
  const [collabConfirm, setCollabConfirm] = useState<{
    id: string;
    action: "accept" | "reject";
  } | null>(null);
  const [actualMatchesCount, setActualMatchesCount] = useState<number>(0);
  const notifUnreadCount = useNotificationStore((s) => s.unreadCount);

  // Onboarding progress state
  const [onboardingProgress, setOnboardingProgress] = useState<{
    currentStep: number;
    completionPercentage: number;
    isCompleted: boolean;
  } | null>(null);

  // Fetch onboarding progress
  useEffect(() => {
    async function fetchOnboardingProgress() {
      try {
        const data = await api.get<{
          currentStep: number;
          completionPercentage: number;
          isCompleted: boolean;
        }>("/profile/onboarding-progress");
        if (data) {
          setOnboardingProgress({
            currentStep: data.currentStep || 0,
            completionPercentage: data.completionPercentage || 0,
            isCompleted: data.isCompleted || false,
          });
        }
      } catch (error) {
        console.error("Failed to fetch onboarding progress:", error);
      }
    }
    fetchOnboardingProgress();
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      try {
        // Fetch all data in parallel
        const [dashboard, charts, matchesData, tasksData, remindersData] =
          await Promise.all([
            getDashboard(
              period,
              customFrom || undefined,
              customTo || undefined,
            ).catch(() => null),
            getChartData(
              period === "week"
                ? 7
                : period === "month"
                  ? 30
                  : customFrom && customTo
                    ? Math.ceil(
                        (new Date(customTo).getTime() -
                          new Date(customFrom).getTime()) /
                          (1000 * 60 * 60 * 24),
                      )
                    : 30,
            ).catch(() => null),
            getMatches({ limit: 10, minScore: 50 }).catch(() => null),
            getAllTasks({ upcoming: true, limit: 10 }).catch(() => []),
            getAllReminders({ upcoming: true, limit: 10 }).catch(() => []),
          ]);

        if (dashboard) {
          console.log("dashboard", dashboard);

          setDashboardData(dashboard);
        }

        if (charts) {
          setChartData(charts);
        }

        // Update recommendations from matches
        if (matchesData?.matches) {
          const contactsRes = await getContacts({ limit: 100 }).catch(
            () => null,
          );
          const recs = matchesData.matches.slice(0, 3).map((match) => {
            const contact = contactsRes?.contacts.find(
              (c) => c.id === match.contactId,
            );
            return {
              id: match.contactId,
              name: contact?.name || "Unknown",
              company: contact?.company || "",
              score: match.score,
              reason:
                match.reasons?.[0] ||
                `${match.score}% ${t.dashboard.compatibility}`,
              tags: match.intersections?.slice(0, 3).map((i) => i.label) || [],
              avatarUrl: contact?.avatarUrl,
            };
          });
          setRecommendations(recs.filter((r) => r.name !== "Unknown"));
        }

        // Fetch all matches (Projects + Deals + Pitches + Opportunities) for top matches & count
        try {
          const [projectsRes, dealsForCount, pitchesForCount, oppsForCount] =
            await Promise.all([
              getProjects({ limit: 50 }).catch(() => null),
              getDeals({ limit: 20 }).catch(() => null),
              listPitches({ limit: 20 }).catch(() => null),
              getAllOpportunityMatches({ limit: 100 }).catch(() => null),
            ]);

          const allUnifiedMatches: MatchCardData[] = [];

          // Project matches (contacts only)
          if (projectsRes?.projects) {
            for (const project of projectsRes.projects) {
              try {
                const res = await getProjectMatches(project.id, {
                  minScore: 30,
                });
                if (res?.matches) {
                  for (const m of res.matches) {
                    if (m.matchType !== "contact" || !m.matchedContact?.id)
                      continue;
                    allUnifiedMatches.push({
                      id: `proj-${m.id}`,
                      source: "project",
                      sourceTitle: project.title,
                      sourceId: project.id,
                      score: m.matchScore,
                      contactId: m.matchedContact.id,
                      name: m.matchedContact.fullName || "Unknown",
                      company: m.matchedContact.company || "",
                      reasons: m.reasons || [],
                      sharedSectors: m.sharedSectors || [],
                      sharedSkills: m.sharedSkills || [],
                      status: m.status || "PENDING",
                      channels: { email: m.matchedContact.email || null },
                    });
                  }
                }
              } catch {}
            }
          }

          // Deal matches
          if (dealsForCount?.deals) {
            for (const deal of dealsForCount.deals.filter(
              (d: any) => d.matchCount > 0,
            )) {
              try {
                const res = await getDealResults(deal.id);
                if (res?.results) {
                  for (const m of res.results) {
                    if (!m.contact?.id) continue;
                    allUnifiedMatches.push({
                      id: `deal-${m.id}`,
                      source: "deal",
                      sourceTitle:
                        deal.productName ||
                        deal.targetDescription ||
                        "Smart Deal",
                      sourceId: deal.id,
                      score: m.score,
                      contactId: m.contact.id,
                      name:
                        m.contact.fullName ||
                        (m.contact as any).name ||
                        "Unknown",
                      company: m.contact.company || "",
                      reasons: (m.reasons || []).map((r: any) =>
                        typeof r === "string" ? r : r.text,
                      ),
                      sharedSectors: [],
                      sharedSkills: [],
                      status: m.status || "PENDING",
                      channels: { email: m.contact.email || null },
                    });
                  }
                }
              } catch {}
            }
          }

          // Pitch matches
          if (pitchesForCount?.pitches) {
            for (const pitch of pitchesForCount.pitches.filter(
              (p: any) => p.status === "COMPLETED" || p.status === "completed",
            )) {
              try {
                const res = await getPitchResults(pitch.id);
                if (res?.sections) {
                  for (const section of res.sections) {
                    if (section.matches) {
                      for (const m of section.matches) {
                        if (!m.contact?.id) continue;
                        allUnifiedMatches.push({
                          id: `pitch-${m.id}`,
                          source: "pitch",
                          sourceTitle:
                            pitch.title || pitch.companyName || "Pitch Deck",
                          sourceId: pitch.id,
                          score: m.score,
                          contactId: m.contact.id,
                          name: m.contact.fullName || "Unknown",
                          company: m.contact.company || "",
                          reasons: (m.reasons || []).map((r: any) =>
                            typeof r === "string" ? r : r.text,
                          ),
                          sharedSectors: [],
                          sharedSkills: [],
                          status: m.status || "PENDING",
                          channels: { email: null },
                        });
                      }
                    }
                  }
                }
              } catch {}
            }
          }

          // Opportunity matches (contacts only)
          if (oppsForCount?.matches) {
            for (const m of oppsForCount.matches) {
              if (m.matchType !== "contact" || !m.candidate?.id) continue;
              allUnifiedMatches.push({
                id: `job-${m.id}`,
                source: "job",
                sourceTitle: m.opportunityTitle || "Opportunity",
                sourceId: m.opportunityId,
                score: m.matchScore,
                contactId: m.candidate.id,
                name: m.candidate.fullName || "Unknown",
                company: m.candidate.company || "",
                reasons: m.reasons || [],
                sharedSectors: m.sharedSectors || [],
                sharedSkills: m.sharedSkills || [],
                status: m.status || "PENDING",
                channels: { email: m.candidate.email || null },
              });
            }
          }

          setActualMatchesCount(allUnifiedMatches.length);
          allUnifiedMatches.sort((a, b) => b.score - a.score);
          setTopMatches(allUnifiedMatches.slice(0, 5));
        } catch {}

        // Update tasks and reminders (filter out completed/cancelled, sort by urgency)
        if (tasksData && Array.isArray(tasksData)) {
          const priorityOrder: Record<string, number> = {
            URGENT: 0,
            HIGH: 1,
            MEDIUM: 2,
            LOW: 3,
          };
          const filtered = tasksData.filter(
            (t: ContactTask) =>
              t.status !== "COMPLETED" && t.status !== "CANCELLED",
          );
          filtered.sort(
            (a: ContactTask, b: ContactTask) =>
              (priorityOrder[a.priority] ?? 4) -
              (priorityOrder[b.priority] ?? 4),
          );
          setTasks(filtered);
        }
        if (remindersData && Array.isArray(remindersData)) {
          setReminders(
            remindersData.filter((r: ContactReminder) => !r.isCompleted),
          );
        }

        // Fetch recent conversations and pending collaboration requests in parallel
        try {
          const [convRes, collabRes] = await Promise.all([
            getConversations({ limit: 10 }).catch(() => null),
            listReceivedRequests({ status: "PENDING", limit: 5 }).catch(
              () => null,
            ),
          ]);
          if (convRes?.conversations) {
            // Show conversations with unread messages first, then most recent
            const sorted = convRes.conversations
              .filter((c) => c.lastMessage)
              .sort((a, b) => {
                if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
                if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
                return (
                  new Date(b.lastMessageAt || 0).getTime() -
                  new Date(a.lastMessageAt || 0).getTime()
                );
              });
            setRecentConversations(sorted.slice(0, 5));
          }
          if (collabRes?.requests) {
            setPendingCollabRequests(collabRes.requests);
          }
        } catch {}
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, [period, customFrom, customTo, t.dashboard.compatibility]);

  useEffect(() => {
    console.log("dash data", dashboardData);
  }, [dashboardData]);

  // Re-fetch pending collab requests when notification count changes
  useEffect(() => {
    if (notifUnreadCount > 0) {
      listReceivedRequests({ status: "PENDING", limit: 5 })
        .then((res) => {
          if (res?.requests) setPendingCollabRequests(res.requests);
        })
        .catch(() => {});
    }
  }, [notifUnreadCount]);

  // Extract stats from dashboard data
  const stats = dashboardData?.stats;
  const health = dashboardData?.health;
  const goals = dashboardData?.goals;

  // Build sparkline data from chart data
  const sparklineContacts =
    chartData?.contactsOverTime.slice(-7).map((d) => d.value) || [];
  const sparklineMatches =
    chartData?.matchesOverTime.slice(-7).map((d) => d.value) || [];
  const sparklineInteractions =
    chartData?.interactionsOverTime.slice(-7).map((d) => d.value) || [];

  // Build follow-up items (kept for mobile cards reference)
  const recentActivity =
    dashboardData?.recentActivity?.slice(0, 3).map((activity) => ({
      icon: getActivityIcon(activity.type),
      iconBg: getActivityIconBg(activity.type),
      title: activity.title,
      description: activity.description,
      time: formatRelativeTime(activity.occurredAt, t.dashboard.relativeTime),
    })) || [];

  const contactCount = stats?.contacts.current || 0;
  const matchCount = actualMatchesCount || stats?.matches.current || 0;

  const insights = [
    {
      icon: <Sparkle24Regular className="w-5 h-5" />,
      title: t.dashboard.networkGrowingFast,
      description: `${contactCount} ${t.dashboard.totalContacts.toLowerCase()} — ${contactCount > 20 ? t.dashboard.insightDescriptions?.networkExpanding || "Your professional network is expanding nicely. Keep adding contacts to unlock better AI matches." : t.dashboard.insightDescriptions?.addMoreContacts || "Add more contacts to grow your network and improve match quality."}`,
      action: t.dashboard.viewInsights,
      gradient: "bg-gradient-to-br from-emerald-500 to-teal-500",
      href: "/contacts",
    },
    {
      icon: <Target24Regular className="w-5 h-5" />,
      title: t.dashboard.highValueMatches,
      description: `${matchCount} ${t.dashboard.aiMatches.toLowerCase()} — ${matchCount > 0 ? t.dashboard.insightDescriptions?.aiFoundCollaborators || "AI found potential collaborators based on your skills, sectors, and project interests." : t.dashboard.insightDescriptions?.noMatchesYet || "No matches yet. Create projects or enrich your profile to get AI-powered match suggestions."}`,
      action: t.dashboard.viewMatches,
      gradient: "bg-gradient-to-br from-blue-500 to-cyan-500",
      href: "/matches",
    },
  ];

  // Task/Reminder handlers — open action popup instead of direct toggle
  const handleTaskClick = (task: ContactTask) => {
    setActionPopup({ type: "task", item: task });
  };

  const handleReminderClick = (reminder: ContactReminder) => {
    setActionPopup({ type: "reminder", item: reminder });
  };

  const handleActionComplete = async () => {
    const popup = actionPopup;
    if (!popup) return;
    setActionPopup(null);
    try {
      if (popup.type === "task") {
        const task = popup.item as ContactTask;
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        await api.patch(`/tasks/${task.id}/status`, { status: "COMPLETED" });
      } else {
        const reminder = popup.item as ContactReminder;
        setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
        await updateContactReminder(reminder.contactId, reminder.id, {
          isCompleted: true,
        });
      }
    } catch (error) {
      console.error("Failed to complete:", error);
    }
  };

  const handleActionDismiss = async () => {
    const popup = actionPopup;
    if (!popup) return;
    setActionPopup(null);
    try {
      if (popup.type === "task") {
        const task = popup.item as ContactTask;
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        await api.patch(`/tasks/${task.id}/status`, { status: "CANCELLED" });
      } else {
        const reminder = popup.item as ContactReminder;
        setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
        await updateContactReminder(reminder.contactId, reminder.id, {
          isCompleted: true,
        });
      }
    } catch (error) {
      console.error("Failed to dismiss:", error);
    }
  };

  const handleActionRemindLater = async (remindAt: Date) => {
    const popup = actionPopup;
    if (!popup) return;
    setActionPopup(null);
    try {
      if (popup.type === "task") {
        const task = popup.item as ContactTask;
        if (task.contactId) {
          const updated = await updateContactTask(task.contactId, task.id, {
            reminderAt: remindAt.toISOString(),
          });
          setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        } else {
          await api.patch(`/tasks/${task.id}`, {
            reminderAt: remindAt.toISOString(),
          });
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? { ...t, reminderAt: remindAt.toISOString() }
                : t,
            ),
          );
        }
      } else {
        const reminder = popup.item as ContactReminder;
        const updated = await updateContactReminder(
          reminder.contactId,
          reminder.id,
          { reminderAt: remindAt.toISOString() },
        );
        setReminders((prev) =>
          prev.map((r) => (r.id === reminder.id ? updated : r)),
        );
      }
    } catch (error) {
      console.error("Failed to set reminder:", error);
    }
  };

  const playVoice = (taskId: string, url: string) => {
    if (playingAudio === taskId) {
      setPlayingAudio(null);
    } else {
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setPlayingAudio(taskId);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "HIGH":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "MEDIUM":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "LOW":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-white/[0.03]0/20 text-white/60 border-neutral-500/30";
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.dashboard.greetingMorning;
    if (hour < 18) return t.dashboard.greetingAfternoon;
    return t.dashboard.greetingEvening;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Quick Actions */}
      <section>
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {user?.name ?? myName}
        </h1>
        <p className="text-white/60 mb-3">
          {t.dashboard.quickActionsSubtitle ||
            "Jump right in, here are your most-used actions"}
        </p>
        {/* Mobile: Centered horizontal icons */}
        <div className="flex justify-center gap-5 pb-2 md:hidden">
          {[
            {
              href: "/contacts/add",
              icon: <PersonAdd24Regular className="w-6 h-6" />,
              title: t.dashboard.addContact,
              gradient: "bg-[#00b4d8]",
            },
            {
              href: "/matches",
              icon: <Sparkle24Regular className="w-6 h-6" />,
              title: t.dashboard.findMatches,
              gradient: "bg-[#76c893]",
            },
            {
              href: "/map",
              icon: <Target24Regular className="w-6 h-6" />,
              title: t.dashboard.networkMap,
              gradient: "bg-[#52b69a]",
            },
            {
              href: "/explorer",
              icon: <Search24Regular className="w-6 h-6" />,
              title: t.dashboard.explore || "Explore",
              gradient: "bg-[#0077b6]",
            },
          ].map((action, i) => (
            <div
              key={action.href}
              className="animate-pop-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <MobileQuickAction {...action} />
            </div>
          ))}
        </div>
        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-3">
          <QuickActionCard
            href="/contacts/add"
            icon={<PersonAdd24Regular className="w-5 h-5" />}
            title={t.dashboard.addContact}
            description={t.dashboard.enterManually}
            gradient="bg-[#00b4d8]"
          />
          <QuickActionCard
            href="/matches"
            icon={<Sparkle24Regular className="w-5 h-5" />}
            title={t.dashboard.findMatches}
            description={t.dashboard.aiRecommendations}
            gradient="bg-[#76c893]"
          />
          <QuickActionCard
            href="/map"
            icon={<Target24Regular className="w-5 h-5" />}
            title={t.dashboard.networkMap}
            description={t.dashboard.visualizeConnections}
            gradient="bg-[#52b69a]"
          />
          <QuickActionCard
            href="/explorer"
            icon={<Search24Regular className="w-5 h-5" />}
            title={t.dashboard.explore || "Explore"}
            description={t.dashboard.exploreNetwork || "Explore your network"}
            gradient="bg-[#0077b6]"
          />
        </div>
      </section>

      {/* Network Overview Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {t.dashboard.networkOverview || "Network Overview"}
          </h2>
          <p className="text-white/60 text-sm">{t.dashboard.networkOverview}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period quick buttons */}
          <div className="flex items-center bg-th-surface border border-th-border rounded-lg overflow-hidden">
            {[
              {
                value: "week" as ComparisonPeriod,
                label: t.common?.thisWeek || "This Week",
              },
              {
                value: "month" as ComparisonPeriod,
                label: t.common?.thisMonth || "This Month",
              },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPeriod(opt.value);
                  setShowDatePicker(false);
                  setCustomFrom("");
                  setCustomTo("");
                }}
                className={`px-3 py-2 text-sm transition-colors ${
                  period === opt.value && !showDatePicker
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-white/60 hover:bg-th-surface-h"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors border-s border-th-border ${
                showDatePicker || period === "custom"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-white/60 hover:bg-th-surface-h"
              }`}
            >
              <CalendarLtr24Regular className="w-4 h-4" />
              <span>{t.common?.custom || "Custom"}</span>
            </button>
          </div>
          {/* Custom date range inputs */}
          {showDatePicker && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 bg-th-surface border border-th-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <span className="text-white/60 text-sm">
                {t.common?.to || "to"}
              </span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 bg-th-surface border border-th-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="button"
                disabled={!customFrom || !customTo}
                onClick={() => {
                  if (customFrom && customTo) {
                    setPeriod("custom");
                  }
                }}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                {t.common?.apply || "Apply"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Progress Card - Show if not completed */}
      {onboardingProgress && !onboardingProgress.isCompleted && (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 rounded-xl blur-lg opacity-50" />
          <div className="relative bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <PersonCircle24Regular className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {t.dashboard.completeProfile || "Complete Your Profile"}
                  </h3>
                  <p className="text-sm text-white/60">
                    {t.dashboard.profileProgress?.replace(
                      "{percent}",
                      String(onboardingProgress.completionPercentage),
                    ) ||
                      `${onboardingProgress.completionPercentage}% complete - Continue where you left off`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Progress Circle */}
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 transform -rotate-90">
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-white/10"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      stroke="url(#progressGradient)"
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${onboardingProgress.completionPercentage * 1.51} 151`}
                    />
                    <defs>
                      <linearGradient
                        id="progressGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">
                      {onboardingProgress.completionPercentage}%
                    </span>
                  </div>
                </div>
                <Link
                  href="/onboarding"
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                >
                  {t.dashboard.continueSetup || "Continue Setup"}
                  <ArrowRight24Regular className="w-4 h-4" />
                </Link>
              </div>
            </div>
            {/* Step indicators */}
            <div className="flex gap-1.5 mt-4">
              {[0, 1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    step < onboardingProgress.currentStep
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : step === onboardingProgress.currentStep
                        ? "bg-emerald-500/50"
                        : "bg-th-surface-h"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <section>
        {/* Mobile: Compact cards with score rings */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {[
            {
              label: t.dashboard.totalContacts,
              desc:
                t.dashboard.statDescriptions?.totalContacts ||
                "People in your network",
              tooltip: t.dashboard.tooltips?.totalContacts,
              value: stats?.contacts.current || 0,
              color: "#A855F7",
              href: "/contacts",
              suffix: "",
            },
            {
              label: t.dashboard.aiMatches,
              desc:
                t.dashboard.statDescriptions?.aiMatches ||
                "AI-found collaborators",
              tooltip: t.dashboard.tooltips?.aiMatches,
              value: actualMatchesCount || stats?.matches.current || 0,
              color: "#3B82F6",
              href: "/matches",
              suffix: "",
            },
          ].map((s, i) => (
            <Link
              key={s.label}
              href={s.href}
              className="animate-slide-up-fade"
              style={{ animationDelay: `${i * 80}ms` }}
              title={s.tooltip}
            >
              <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200 hover:bg-th-surface-h active:scale-95">
                <span className="text-2xl font-bold" style={{ color: s.color }}>
                  {s.value}
                  {s.suffix}
                </span>
                <span className="text-[11px] text-white/60 text-center leading-tight">
                  {s.label}
                </span>
                <span className="text-[10px] text-white/50 text-center leading-tight">
                  {s.desc}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {/* Desktop: Full stat cards */}
        <div className="hidden md:grid md:grid-cols-2 gap-4">
          <StatCard
            label={t.dashboard.totalContacts}
            value={stats?.contacts.current || 0}
            change={stats?.contacts.changePercent}
            changeLabel={
              period === "custom"
                ? t.common?.vsLastPeriod || "vs prev period"
                : period === "week"
                  ? t.common.vsLastWeek
                  : t.common?.vsLastMonth || "vs last month"
            }
            icon={<People24Regular className="w-5 h-5" />}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
            sparklineData={sparklineContacts}
            sparklineColor="#10b981"
            tooltip={t.dashboard.tooltips?.totalContacts}
            href="/contacts"
          />
          <StatCard
            label={t.dashboard.aiMatches}
            value={actualMatchesCount || stats?.matches.current || 0}
            change={stats?.matches.changePercent}
            changeLabel={
              period === "custom"
                ? t.common?.vsLastPeriod || "vs prev period"
                : period === "week"
                  ? t.common.vsLastWeek
                  : t.common?.vsLastMonth || "vs last month"
            }
            icon={<Handshake24Regular className="w-5 h-5" />}
            gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
            sparklineData={sparklineMatches}
            sparklineColor="#3b82f6"
            tooltip={t.dashboard.tooltips?.aiMatches}
            href="/matches"
          />
        </div>
      </section>

      {/* Interactive Charts (collapsible) */}
      {chartData && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {t.dashboard.analytics || "Analytics"}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4"
              title={t.dashboard.tooltips?.contactsOverTime}
            >
              <h3 className="text-sm font-medium text-white/70">
                {t.dashboard.contactsOverTime || "Contacts Over Time"}
              </h3>
              <p className="text-xs text-white/50 mb-4">
                {t.dashboard.chartDescriptions?.contactsOverTime ||
                  "Track how your professional network grows day by day"}
              </p>
              <LineChart
                data={chartData.contactsOverTime}
                color="#10b981"
                showArea={true}
                height={180}
              />
            </div>
            {chartData.contactsBySector.length > 0 && (
              <div
                className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4"
                title={t.dashboard.tooltips?.contactsBySector}
              >
                <Link
                  href="/contacts?sector=all"
                  className="flex items-center justify-between mb-1 group"
                >
                  <h3 className="text-sm font-medium text-white/70 group-hover:text-emerald-400 transition-colors">
                    {t.dashboard.contactsBySector || "Contacts by Sector"}
                  </h3>
                  <span className="text-xs text-white/50 group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                    {t.common?.viewAll || "View All"}{" "}
                    <ArrowRight24Regular className="w-3 h-3 rtl:rotate-180" />
                  </span>
                </Link>
                <p className="text-xs text-white/50 mb-4">
                  {t.dashboard.chartDescriptions?.contactsBySector ||
                    "Click a sector to see its contacts"}
                </p>
                <DonutChart
                  data={chartData.contactsBySector.slice(0, 6).map((s) => {
                    const sectorMap = t.dashboard.sectorNames as Record<
                      string,
                      string
                    >;
                    const arLabel = isRTL
                      ? s.nameAr || sectorMap?.[s.sector] || s.sector
                      : s.sector;
                    return { label: arLabel, value: s.count };
                  })}
                  height={200}
                  showLegend={true}
                  onSegmentClick={(label) => {
                    const entry = chartData.contactsBySector.find((s) => {
                      const sectorMap = t.dashboard.sectorNames as Record<
                        string,
                        string
                      >;
                      const arLabel = isRTL
                        ? s.nameAr || sectorMap?.[s.sector] || s.sector
                        : s.sector;
                      return arLabel === label;
                    });
                    router.push(
                      `/contacts/sector/${encodeURIComponent(entry?.sector || label)}`,
                    );
                  }}
                  totalLabel={t.dashboard.chartTotal || "Total"}
                />
              </div>
            )}
            <div
              className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4"
              title={t.dashboard.tooltips?.matchScoreDistribution}
            >
              <h3 className="text-sm font-medium text-white/70">
                {t.dashboard.matchScoreDistribution ||
                  "Match Score Distribution"}
              </h3>
              <p className="text-xs text-white/50 mb-4">
                {t.dashboard.chartDescriptions?.matchScoreDistribution ||
                  "See the quality distribution of your match scores"}
              </p>
              {(() => {
                // Match tiers aligned with MatchCard.tsx: Excellent(90+), Strong(75+), Very Good(60+), Good(40+), Weak(<40)
                const tierMap: Record<
                  string,
                  { label: string; color: string }
                > = {
                  Excellent: {
                    label:
                      t.dashboard.matchScoreTiers?.excellent || "Excellent",
                    color: "#10b981",
                  },
                  Strong: {
                    label: t.dashboard.matchScoreTiers?.strong || "Strong",
                    color: "#22d3ee",
                  },
                  "Very Good": {
                    label: t.dashboard.matchScoreTiers?.veryGood || "Very Good",
                    color: "#3b82f6",
                  },
                  Good: {
                    label: t.dashboard.matchScoreTiers?.good || "Good",
                    color: "#f59e0b",
                  },
                  Weak: {
                    label: t.dashboard.matchScoreTiers?.weak || "Weak",
                    color: "#ef4444",
                  },
                };
                const getTier = (n: number) => {
                  if (n >= 90) return "Excellent";
                  if (n >= 75) return "Strong";
                  if (n >= 60) return "Very Good";
                  if (n >= 40) return "Good";
                  return "Weak";
                };
                // Group backend ranges into the correct tiers
                const tierCounts: Record<string, number> = {};
                for (const s of chartData.matchScoreDistribution) {
                  const tier = getTier(parseInt(s.range));
                  tierCounts[tier] = (tierCounts[tier] || 0) + s.count;
                }
                const sorted = Object.entries(tierCounts)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a);
                return (
                  <BarChart
                    data={sorted.map(([tier, count]) => ({
                      label: tierMap[tier].label,
                      value: count,
                    }))}
                    colors={sorted.map(([tier]) => tierMap[tier].color)}
                    height={180}
                  />
                );
              })()}
            </div>
            <div
              className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4"
              title={t.dashboard.tooltips?.matchesOverTime}
            >
              <h3 className="text-sm font-medium text-white/70">
                {t.dashboard.matchesOverTime || "Matches Over Time"}
              </h3>
              <p className="text-xs text-white/50 mb-4">
                {t.dashboard.chartDescriptions?.matchesOverTime ||
                  "See how many AI-powered matches were discovered"}
              </p>
              <LineChart
                data={chartData.matchesOverTime}
                color="#3b82f6"
                showArea={true}
                height={180}
              />
            </div>
          </div>
        </section>
      )}

      {/* Tasks & Reminders */}
      {(tasks.length > 0 || reminders.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <TaskListSquareAdd24Regular className="w-5 h-5 text-cyan-400" />
              {t.dashboard.tasksAndReminders || "Tasks & Reminders"}
            </h2>
            <Link
              href="/calendar"
              className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {t.common.viewAll}
              <ArrowRight24Regular className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reminders */}
            {reminders.length > 0 && (
              <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock24Regular className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-medium text-white/70">
                    {t.dashboard.remindersCount || "Reminders"} (
                    {reminders.filter((r) => !r.isCompleted).length})
                  </h3>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {reminders
                    .filter((r) => !r.isCompleted)
                    .slice(0, 5)
                    .map((reminder) => (
                      <button
                        key={reminder.id}
                        type="button"
                        onClick={() => handleReminderClick(reminder)}
                        className="w-full flex items-center gap-3 p-2 bg-th-surface rounded-lg hover:bg-th-surface-h transition-colors text-start"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {reminder.title}
                          </p>
                          <p className="text-xs text-white/60">
                            {new Date(reminder.reminderAt).toLocaleString()}
                          </p>
                          {reminder.contact && (
                            <span className="text-xs text-emerald-400">
                              {reminder.contact.fullName}
                            </span>
                          )}
                          {reminder.imageUrls &&
                            reminder.imageUrls.length > 0 && (
                              <div
                                className="flex items-center gap-1.5 mt-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImagePopup(reminder.imageUrls!);
                                }}
                              >
                                {reminder.imageUrls
                                  .slice(0, 3)
                                  .map((url, i) => (
                                    <img
                                      key={i}
                                      src={url}
                                      alt=""
                                      className="w-8 h-8 rounded object-cover border border-th-border cursor-pointer"
                                    />
                                  ))}
                                {reminder.imageUrls.length > 3 && (
                                  <span className="text-xs text-white/60">
                                    +{reminder.imageUrls.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TaskListSquareAdd24Regular className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-medium text-white/70">
                    {t.dashboard.tasksCount || "Tasks"} (
                    {tasks.filter((t) => t.status !== "COMPLETED").length})
                  </h3>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tasks
                    .filter((t) => t.status !== "COMPLETED")
                    .slice(0, 5)
                    .map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleTaskClick(task)}
                        className="w-full flex items-center gap-3 p-2 bg-th-surface rounded-lg hover:bg-th-surface-h transition-colors text-start"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white truncate">
                              {task.title}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs border ${getPriorityColor(task.priority)}`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          {task.dueDate && (
                            <p className="text-xs text-white/60">
                              {t.dashboard.due || "Due"}:{" "}
                              {new Date(task.dueDate).toLocaleString()}
                            </p>
                          )}
                          {task.contact && (
                            <span className="text-xs text-cyan-400">
                              {task.contact.fullName}
                            </span>
                          )}
                          {task.imageUrls && task.imageUrls.length > 0 && (
                            <div
                              className="flex items-center gap-1.5 mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImagePopup(task.imageUrls!);
                              }}
                            >
                              {task.imageUrls.slice(0, 3).map((url, i) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt=""
                                  className="w-8 h-8 rounded object-cover border border-th-border cursor-pointer"
                                />
                              ))}
                              {task.imageUrls.length > 3 && (
                                <span className="text-xs text-white/60">
                                  +{task.imageUrls.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {task.voiceNoteUrl && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoice(task.id, task.voiceNoteUrl!);
                            }}
                            className="p-1.5 hover:bg-th-surface-h rounded-lg text-cyan-400"
                          >
                            {playingAudio === task.id ? (
                              <Pause24Regular className="w-4 h-4" />
                            ) : (
                              <Play24Regular className="w-4 h-4" />
                            )}
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* AI Insights */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          {t.dashboard.aiInsights}
        </h2>
        {/* Mobile: Checkmark bullet list */}
        <div className="md:hidden bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl p-4 space-y-3 animate-slide-up-fade">
          {insights.map((insight, i) => (
            <Link
              key={i}
              href={insight.href || "#"}
              className="flex items-start gap-3 group animate-slide-up-fade active:scale-[0.98] transition-transform"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <CheckmarkCircle24Regular className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium group-hover:text-green-300 transition-colors">
                  {insight.title}
                </p>
                <p className="text-xs text-white/60">{insight.description}</p>
              </div>
              <ChevronRight24Regular className="w-4 h-4 text-white/50 flex-shrink-0 mt-0.5 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform rtl:rotate-180" />
            </Link>
          ))}
        </div>
        {/* Desktop: Card grid */}
        <div className="hidden md:grid md:grid-cols-2 gap-4">
          {insights.map((insight, i) => (
            <InsightCard key={i} {...insight} />
          ))}
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Recommendations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Matches */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">
                {t.dashboard.topMatches || "Top Matches"}
              </h2>
              <Link
                href="/matches"
                className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {t.common.viewAll}
                <ArrowRight24Regular className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
            <div className="space-y-3">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-th-surface rounded-xl p-4 animate-pulse"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-th-surface-h rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-th-surface-h rounded" />
                        <div className="h-3 w-24 bg-th-surface-h rounded" />
                      </div>
                    </div>
                  </div>
                ))
              ) : topMatches.length > 0 ? (
                topMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    t={t as any}
                    actionSlot={
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMatch(match);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                      >
                        {t.common?.actions || "Actions"}
                      </button>
                    }
                  />
                ))
              ) : (
                <div className="bg-th-surface rounded-xl p-8 text-center">
                  <Handshake24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
                  <p className="text-white/60">
                    {t.dashboard.noMatches || "No matches yet"}
                  </p>
                  <Link
                    href="/matching"
                    className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 inline-block"
                  >
                    {t.dashboard.goToMatching || "Go to Matching"}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Collaboration Requests */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">
                  {(t.dashboard as any).collaborationRequests ||
                    "Collaboration Requests"}
                </h2>
                {pendingCollabRequests.length > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-violet-500 text-white text-[10px] font-bold leading-none">
                    {pendingCollabRequests.length}
                  </span>
                )}
              </div>
              <Link
                href="/collaborations"
                className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {t.common.viewAll}
                <ArrowRight24Regular className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
            {pendingCollabRequests.length > 0 ? (
              <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl divide-y divide-th-border-s overflow-hidden">
                {pendingCollabRequests.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 p-3">
                    <div className="flex-shrink-0">
                      <Avatar
                        src={req.fromUser?.avatarUrl}
                        name={req.fromUser?.fullName || "User"}
                        size="md"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {req.fromUser?.fullName || "Someone"}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        {req.sourceFeature?.title ||
                          req.sourceTitle ||
                          req.sourceType}
                      </p>
                      {req.message && (
                        <p className="text-xs text-white/40 truncate mt-0.5">
                          {req.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() =>
                          setCollabConfirm({ id: req.id, action: "accept" })
                        }
                        disabled={!!collabActionLoading}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {collabActionLoading === req.id + "-accept"
                          ? "..."
                          : t.common?.accept || "Accept"}
                      </button>
                      <button
                        onClick={() =>
                          setCollabConfirm({ id: req.id, action: "reject" })
                        }
                        disabled={!!collabActionLoading}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 text-white/60 hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        {collabActionLoading === req.id + "-reject"
                          ? "..."
                          : t.common?.decline || "Decline"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 text-center">
                <Handshake24Regular className="w-10 h-10 text-white/30 mx-auto mb-2" />
                <p className="text-white/50 text-sm">
                  {(t.dashboard as any).noCollaborationRequests ||
                    "No pending collaboration requests"}
                </p>
              </div>
            )}
          </section>

          {/* Collaboration Confirm Dialog */}
          {collabConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setCollabConfirm(null)}
              />
              <div className="relative bg-th-surface border border-th-border rounded-xl p-4 max-w-[260px] w-full shadow-2xl">
                <h3 className="text-sm font-semibold text-th-text mb-1">
                  {collabConfirm.action === "accept"
                    ? (t.common?.accept || "Accept") + " Request"
                    : (t.common?.decline || "Decline") + " Request"}
                </h3>
                <p className="text-xs text-th-text-t mb-3">
                  {collabConfirm.action === "accept"
                    ? (t.dashboard as any).confirmAcceptCollab ||
                      "Accept this collaboration request?"
                    : (t.dashboard as any).confirmRejectCollab ||
                      "Decline this request?"}
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setCollabConfirm(null)}
                    disabled={!!collabActionLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-colors"
                  >
                    {t.common?.cancel || "Cancel"}
                  </button>
                  <button
                    onClick={async () => {
                      const { id, action } = collabConfirm;
                      setCollabActionLoading(id + "-" + action);
                      try {
                        if (action === "accept") {
                          await acceptCollaborationRequest(id);
                        } else {
                          await rejectCollaborationRequest(id);
                        }
                        setPendingCollabRequests((prev) =>
                          prev.filter((r) => r.id !== id),
                        );
                      } catch {}
                      setCollabActionLoading(null);
                      setCollabConfirm(null);
                    }}
                    disabled={!!collabActionLoading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                      collabConfirm.action === "accept"
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-red-600 hover:bg-red-500"
                    }`}
                  >
                    {collabActionLoading
                      ? "..."
                      : collabConfirm.action === "accept"
                        ? t.common?.accept || "Accept"
                        : t.common?.decline || "Decline"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">
                {t.bottomNav?.messages || "Messages"}
              </h2>
              <Link
                href="/messages"
                className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {t.common.viewAll}
                <ArrowRight24Regular className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
            <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl divide-y divide-th-border-s overflow-hidden">
              {recentConversations.length > 0 ? (
                recentConversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/messages/${conv.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-th-surface-h transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar
                        src={conv.otherUser.avatarUrl}
                        name={conv.otherUser.fullName}
                        size="md"
                      />
                      {conv.otherUser.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-th-surface" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm truncate ${conv.unreadCount > 0 ? "font-semibold text-white" : "text-white/70"}`}
                        >
                          {conv.otherUser.fullName}
                        </p>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-white/50 flex-shrink-0">
                            {formatRelativeTime(
                              conv.lastMessageAt,
                              t.dashboard.relativeTime,
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-xs truncate flex-1 ${conv.unreadCount > 0 ? "text-white/70" : "text-white/50"}`}
                        >
                          {conv.lastMessage?.content || "Attachment"}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold flex-shrink-0">
                            {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-6 text-center text-white/60">
                  <Chat24Regular className="w-8 h-8 mx-auto mb-2" />
                  <p>{t.dashboard.noMessagesYet || "No messages yet"}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column - Activity */}
        <div className="space-y-6">
          {/* Network Health - hidden on mobile (shown as hero at top) */}
          <section className="hidden md:block">
            <h2 className="text-lg font-semibold text-white mb-3">
              {t.dashboard.networkHealth}
            </h2>
            <NetworkHealthCard health={health || null} t={t} />
          </section>
        </div>
      </div>

      {/* Task/Reminder Action Popup */}
      <TaskActionPopup
        isOpen={!!actionPopup}
        onClose={() => setActionPopup(null)}
        onComplete={handleActionComplete}
        onDismiss={handleActionDismiss}
        onRemindLater={handleActionRemindLater}
        title={
          actionPopup
            ? actionPopup.type === "task"
              ? (actionPopup.item as ContactTask).title
              : (actionPopup.item as ContactReminder).title
            : ""
        }
        type={actionPopup?.type || "task"}
        t={t.taskAction}
      />

      {/* Image Attachment Popup */}
      {imagePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={() => setImagePopup(null)}
        >
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-th-nav-bottom border border-th-border rounded-2xl shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImagePopup(null)}
              className="absolute top-3 end-3 z-10 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
            >
              <Dismiss24Regular className="w-5 h-5 text-white" />
            </button>
            <div className="space-y-3">
              {imagePopup.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  className="w-full rounded-lg object-contain"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Match Actions Popup */}
      {selectedMatch && (
        <MatchActionsPopup
          match={selectedMatch}
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          t={t}
        />
      )}
    </div>
  );
}

// Helper functions
function getActivityIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    SCANNED: <Camera24Regular className="w-4 h-4" />,
    SAVED: <PersonAdd24Regular className="w-4 h-4" />,
    VIEWED: <Eye24Regular className="w-4 h-4" />,
    NOTED: <Chat24Regular className="w-4 h-4" />,
    MEETING: <CalendarLtr24Regular className="w-4 h-4" />,
    MESSAGE: <Mail24Regular className="w-4 h-4" />,
    FOLLOW_UP: <CheckmarkCircle24Regular className="w-4 h-4" />,
    INTRODUCED: <Handshake24Regular className="w-4 h-4" />,
    CALLED: <Chat24Regular className="w-4 h-4" />,
    EMAILED: <Mail24Regular className="w-4 h-4" />,
    CONTACT_ADDED: <PersonAdd24Regular className="w-4 h-4" />,
    MATCH_FOUND: <Sparkle24Regular className="w-4 h-4" />,
  };
  return icons[type] || <Circle24Regular className="w-4 h-4" />;
}

function getActivityIconBg(type: string): string {
  const colors: Record<string, string> = {
    SCANNED: "bg-emerald-500",
    SAVED: "bg-blue-500",
    VIEWED: "bg-cyan-500",
    NOTED: "bg-yellow-500",
    MEETING: "bg-green-500",
    MESSAGE: "bg-cyan-500",
    FOLLOW_UP: "bg-emerald-500",
    INTRODUCED: "bg-emerald-500",
    CALLED: "bg-teal-500",
    EMAILED: "bg-red-500",
    CONTACT_ADDED: "bg-emerald-500",
    MATCH_FOUND: "bg-emerald-500",
  };
  return colors[type] || "bg-white/[0.03]0";
}

function formatRelativeTime(
  dateString: string,
  rt?: {
    justNow?: string;
    minutesAgo?: string;
    hoursAgo?: string;
    daysAgo?: string;
  },
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return rt?.justNow || "Just now";
  if (diffMins < 60)
    return (rt?.minutesAgo || "{n}m ago").replace("{n}", String(diffMins));
  if (diffHours < 24)
    return (rt?.hoursAgo || "{n}h ago").replace("{n}", String(diffHours));
  if (diffDays < 7)
    return (rt?.daysAgo || "{n}d ago").replace("{n}", String(diffDays));
  return date.toLocaleDateString();
}
