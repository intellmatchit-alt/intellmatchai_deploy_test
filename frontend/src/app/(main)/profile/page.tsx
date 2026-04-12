/**
 * Profile Page
 *
 * View and manage user profile - Dark Theme.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/ui/Toast";
import { getContacts } from "@/lib/api/contacts";
import { getMatches } from "@/lib/api/matches";
import { getStats } from "@/lib/api/graph";
import { getProfile, Profile } from "@/lib/api/profile";
import {
  Edit24Regular,
  Settings24Regular,
  SignOut24Regular,
  ChevronRight24Regular,
  People24Regular,
  Handshake24Regular,
  Chat24Regular,
  Shield24Regular,
  Info24Regular,
  Heart24Regular,
  Translate24Regular,
  Briefcase24Regular,
  Lightbulb24Regular,
  Target24Regular,
  Star24Regular,
  Sparkle24Regular,
  PersonCircle24Regular,
  ArrowRight24Regular,
} from "@fluentui/react-icons";
import { api } from "@/lib/api/client";
import { useI18n, languages, type LanguageCode } from "@/lib/i18n";

/**
 * Menu item component
 */
function MenuItem({
  href,
  icon,
  label,
  description,
  onClick,
  danger,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const content = (
    <div
      className={`flex items-center gap-4 p-4 hover:bg-th-surface rounded-xl transition-colors cursor-pointer ${
        danger ? "text-red-400" : "text-th-text"
      }`}
      onClick={onClick}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          danger
            ? "bg-red-500/20 text-red-400"
            : "bg-th-surface-h text-th-text-s"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <span className="font-medium">{label}</span>
        {description && <p className="text-sm text-th-text-m">{description}</p>}
      </div>
      {href && <ChevronRight24Regular className="w-5 h-5 text-th-text-m" />}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

/**
 * Bio section component with summary/full tabs
 */
function BioSection({ bio }: { bio: string }) {
  const { t, lang } = useI18n();
  const [activeBioTab, setActiveBioTab] = useState<"summary" | "full">(
    "summary",
  );

  // Generate summary from full bio (first ~300 chars at sentence boundary)
  const bioSummary = (() => {
    if (bio.length <= 300) return bio;
    let summary = bio.slice(0, 300);
    const lastPeriod = summary.lastIndexOf(".");
    if (lastPeriod > 150) {
      return summary.slice(0, lastPeriod + 1);
    }
    return summary.trim() + "...";
  })();

  // Detect RTL content
  const isRtl = lang === "ar" || /[\u0600-\u06FF]/.test(bio.slice(0, 50));

  return (
    <div className="px-4">
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-th-text-s">
            {t.profile.aboutMe || "About"}
          </h3>
        </div>

        {/* Bio Tabs - only show if bio is long enough for summary */}
        {bio.length > 300 && (
          <div
            className={`flex gap-1 mb-3 p-1 bg-th-surface rounded-lg ${isRtl ? "flex-row-reverse" : ""}`}
          >
            <button
              type="button"
              onClick={() => setActiveBioTab("summary")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeBioTab === "summary"
                  ? "bg-emerald-500 text-white"
                  : "text-th-text-t hover:text-th-text hover:bg-th-surface"
              }`}
            >
              {t.onboarding?.cvBio?.summarized || "Summary"}
            </button>
            <button
              type="button"
              onClick={() => setActiveBioTab("full")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeBioTab === "full"
                  ? "bg-emerald-500 text-white"
                  : "text-th-text-t hover:text-th-text hover:bg-th-surface"
              }`}
            >
              {t.onboarding?.cvBio?.fullBio || "Full Bio"}
            </button>
          </div>
        )}

        <p
          className="text-th-text-t text-sm leading-relaxed"
          dir={isRtl ? "rtl" : "ltr"}
          style={{ textAlign: isRtl ? "right" : "left" }}
        >
          {bio.length > 300 && activeBioTab === "summary" ? bioSummary : bio}
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, logoutAll } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  useEffect(() => {
    console.log(user, "user");
  }, [user]);

  // State for profile data from API
  const [profileStats, setProfileStats] = useState({
    contacts: 0,
    matches: 0,
    interactions: 0,
  });
  const [fullProfile, setFullProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingProgress, setOnboardingProgress] = useState<{
    currentStep: number;
    completionPercentage: number;
    isCompleted: boolean;
  } | null>(null);

  // Fetch profile data
  useEffect(() => {
    async function fetchProfileData() {
      setIsLoading(true);
      try {
        const [contactsData, matchesData, statsData, profileData] =
          await Promise.all([
            getContacts({ limit: 1 }).catch(() => null),
            getMatches({ limit: 1 }).catch(() => null),
            getStats().catch(() => null),
            getProfile().catch(() => null),
          ]);

        // Update stats
        setProfileStats({
          contacts: contactsData?.total || 0,
          matches: matchesData?.total || 0,
          interactions: statsData?.summary?.totalInteractions || 0,
        });

        // Set full profile
        if (profileData) {
          setFullProfile(profileData);
        }

        // Fetch onboarding progress
        try {
          const progressData = await api.get<{
            currentStep: number;
            completionPercentage: number;
            isCompleted: boolean;
          }>("/profile/onboarding-progress");
          if (progressData) {
            setOnboardingProgress({
              currentStep: progressData.currentStep || 0,
              completionPercentage: progressData.completionPercentage || 0,
              isCompleted: progressData.isCompleted || false,
            });
          }
        } catch (err) {
          console.error("Failed to fetch onboarding progress:", err);
        }
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfileData();
  }, []);

  useEffect(() => {
    console.log("profileStats", profileStats);
    console.log("profileStats", user);
  }, [profileStats]);

  const handleLogout = async (all: boolean = false) => {
    setIsLoggingOut(true);
    try {
      if (all) {
        await logoutAll();
      } else {
        await logout();
      }
      toast({
        title: t.profile.loggedOut,
        description: all ? t.profile.loggedOutAll : t.profile.loggedOutSingle,
        variant: "success",
      });
      router.push("/login");
    } catch (error) {
      toast({
        title: t.common.error,
        description: t.profile.logOutError,
        variant: "error",
      });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Profile Header */}
      <div className="relative">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 via-emerald-500/10 to-transparent rounded-b-3xl" />

        <div className="relative pt-4 pb-6 px-4">
          <div className="flex justify-end mb-4">
            <Link
              href="/profile/edit"
              className="p-2.5 rounded-xl bg-th-surface-h backdrop-blur-sm border border-th-border text-th-text hover:bg-th-surface-h transition-colors"
            >
              <Edit24Regular className="w-5 h-5" />
            </Link>
          </div>

          {/* Profile Info */}
          <div className="text-center">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-lg opacity-50" />
              <div className="relative p-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full">
                <Avatar
                  src={user?.avatarUrl}
                  name={user?.name || "User"}
                  size="2xl"
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-th-text">
              {user?.name || "User"}
            </h1>
            {user?.jobTitle && (
              <p className="text-th-text-s mt-1">{user.jobTitle}</p>
            )}
            {user?.company && <p className="text-th-text-m">{user.company}</p>}
            <p className="text-sm text-th-text-m mt-1">{user?.email || ""}</p>
            {user?.phone && (
              <p className="text-sm text-th-text-m">{user.phone}</p>
            )}
            {user?.location && (
              <p className="text-sm text-th-text-m">{user.location}</p>
            )}

            {!user?.isEmailVerified && (
              <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {t.profile.emailNotVerified}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-4">
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <People24Regular className="w-5 h-5 text-th-text" />
          </div>
          <p className="text-2xl font-bold text-th-text">
            {isLoading ? "-" : profileStats.contacts}
          </p>
          <p className="text-xs text-th-text-m">{t.profile.contacts}</p>
        </div>
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Handshake24Regular className="w-5 h-5 text-th-text" />
          </div>
          <p className="text-2xl font-bold text-th-text">
            {isLoading ? "-" : profileStats.matches}
          </p>
          <p className="text-xs text-th-text-m">{t.profile.matchesLabel}</p>
        </div>
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Chat24Regular className="w-5 h-5 text-th-text" />
          </div>
          <p className="text-2xl font-bold text-th-text">
            {isLoading ? "-" : profileStats.interactions}
          </p>
          <p className="text-xs text-th-text-m">
            {t.profile.interactionsLabel}
          </p>
        </div>
      </div>

      {/* Profile Completion Card */}
      {onboardingProgress && !onboardingProgress.isCompleted && (
        <div className="px-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 rounded-xl blur-lg opacity-50" />
            <div className="relative bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                    <PersonCircle24Regular className="w-5 h-5 text-th-text" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-th-text text-sm">
                      {t.dashboard?.completeProfile || "Complete Your Profile"}
                    </h3>
                    <p className="text-xs text-th-text-t">
                      {t.dashboard?.profileProgress?.replace(
                        "{percent}",
                        String(onboardingProgress.completionPercentage),
                      ) ||
                        `${onboardingProgress.completionPercentage}% complete`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Progress Circle */}
                  <div className="relative w-12 h-12">
                    <svg className="w-12 h-12 transform -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        className="text-th-text/10"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="url(#profileProgressGradient)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${onboardingProgress.completionPercentage * 1.26} 126`}
                      />
                      <defs>
                        <linearGradient
                          id="profileProgressGradient"
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
                      <span className="text-xs font-semibold text-th-text">
                        {onboardingProgress.completionPercentage}%
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/onboarding"
                    className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                  >
                    {t.dashboard?.continueSetup || "Continue"}
                    <ArrowRight24Regular className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              {/* Step indicators */}
              <div className="flex gap-1 mt-3">
                {[0, 1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`h-1 flex-1 rounded-full transition-colors ${
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
        </div>
      )}

      {/* Sectors */}
      {fullProfile?.sectors && fullProfile.sectors.length > 0 && (
        <div className="px-4">
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase24Regular className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-medium text-th-text-s">
                {t.profile?.sectors || "Sectors"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {fullProfile.sectors.map((sector) => (
                <span
                  key={sector.id}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                >
                  {sector.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skills */}
      {fullProfile?.skills && fullProfile.skills.length > 0 && (
        <div className="px-4">
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Star24Regular className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-th-text-s">
                {t.profile?.skills || "Skills"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {fullProfile.skills.map((skill) => (
                <span
                  key={skill.id}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Interests */}
      {fullProfile?.interests && fullProfile.interests.length > 0 && (
        <div className="px-4">
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Heart24Regular className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-medium text-th-text-s">
                {t.profile?.interestsLabel || "Interests"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {fullProfile.interests.map((interest) => (
                <span
                  key={interest.id}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-emerald-500 to-red-500 text-white"
                >
                  {interest.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Objectives */}
      {fullProfile?.goals && fullProfile.goals.length > 0 && (
        <div className="px-4">
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target24Regular className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-medium text-th-text-s">
                {t.profile?.objectives || "Objectives"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {fullProfile.goals.map((goal) => (
                <span
                  key={goal.id}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                >
                  {goal.type
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hobbies */}
      {fullProfile?.hobbies && fullProfile.hobbies.length > 0 && (
        <div className="px-4">
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkle24Regular className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-medium text-th-text-s">
                {t.profile?.hobbies || "Hobbies"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {fullProfile.hobbies.map((hobby) => (
                <span
                  key={hobby.id}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-yellow-500 to-cyan-500 text-white"
                >
                  {hobby.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Bio with Tabs */}
      {user?.bio && <BioSection bio={user.bio} />}

      {/* Quick Links */}
      {(user?.linkedInUrl || user?.websiteUrl) && (
        <div className="px-4">
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-th-text-s mb-3">
              {t.profile.links || "Links"}
            </h3>
            <div className="space-y-2">
              {user.linkedInUrl && (
                <a
                  href={user.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  <span>LinkedIn</span>
                  <ChevronRight24Regular className="w-4 h-4" />
                </a>
              )}
              {user.websiteUrl && (
                <a
                  href={user.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
                >
                  <span>{t.profile.website || "Website"}</span>
                  <ChevronRight24Regular className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="px-4">
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
          <MenuItem
            href="/profile/edit"
            icon={<Edit24Regular className="w-5 h-5" />}
            label={t.profile.editProfile}
            description={t.profile.updateInfo}
          />
          <div className="h-px bg-th-surface" />
          <MenuItem
            href="/settings"
            icon={<Settings24Regular className="w-5 h-5" />}
            label={t.profile.settings}
            description={t.profile.appPreferences}
          />
          <div className="h-px bg-th-surface" />
          <MenuItem
            href="/settings/privacy"
            icon={<Shield24Regular className="w-5 h-5" />}
            label={t.profile.privacySecurity}
            description={t.profile.manageData}
          />
          <div className="h-px bg-th-surface" />
          <MenuItem
            href="/about"
            icon={<Info24Regular className="w-5 h-5" />}
            label={t.profile.about}
            description={t.profile.appInfo}
          />
        </div>
      </div>

      {/* Language Selection */}
      <div className="px-4">
        <h3 className="text-sm font-medium text-th-text-t mb-3 px-1">
          {t.profile.language} / {t.profile.languageArabic}
        </h3>
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center text-th-text-s">
              <Translate24Regular className="w-5 h-5" />
            </div>
            <div>
              <span className="font-medium text-th-text">
                {t.profile.appLanguage}
              </span>
              <p className="text-sm text-th-text-m">
                {t.profile.chooseLanguage}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(languages).map((language) => (
              <button
                key={language.code}
                onClick={() => setLang(language.code as LanguageCode)}
                className={`flex items-center justify-center gap-3 p-4 rounded-xl transition-all ${
                  lang === language.code
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h"
                }`}
              >
                <span className="text-xl">{language.flag}</span>
                <span className="font-medium">{language.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="px-4">
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
          <MenuItem
            icon={<SignOut24Regular className="w-5 h-5" />}
            label={t.profile.logOut}
            onClick={() => setShowLogoutDialog(true)}
            danger
          />
        </div>
      </div>

      {/* Logout Dialog */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLogoutDialog(false)}
          />
          <div className="relative bg-th-bg-s border border-th-border rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-th-text mb-2">
              {t.profile.logOutTitle}
            </h3>
            <p className="text-th-text-t mb-6">{t.profile.chooseLogout}</p>

            <div className="space-y-3">
              <button
                onClick={() => handleLogout(false)}
                disabled={isLoggingOut}
                className="w-full py-3 px-4 rounded-xl bg-th-surface border border-th-border text-th-text font-medium hover:bg-th-surface-h transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? t.profile.loggingOut : t.profile.logOutDevice}
              </button>
              <button
                onClick={() => handleLogout(true)}
                disabled={isLoggingOut}
                className="w-full py-3 px-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {t.profile.logOutAll}
              </button>
              <button
                onClick={() => setShowLogoutDialog(false)}
                className="w-full py-3 px-4 rounded-xl text-th-text-t hover:text-th-text transition-colors"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App version */}
      <div className="text-center text-xs text-th-text-m pb-4">
        <p>{t.profile.version}</p>
      </div>
    </div>
  );
}
