/**
 * Main App Layout
 *
 * Layout for authenticated app pages.
 * Uses the same deep navy + teal theme as the landing page.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { I18nProvider, useI18n } from "@/lib/i18n";
import {
  ConnectionStatusToast,
  RealTimeNotifications,
} from "@/components/ConnectionStatus";
import { PaywallGuard } from "@/components/common/PaywallGuard";
import { useMessageStore } from "@/stores/messageStore";
import { getUnreadCount } from "@/lib/api/messages";
import { getUnreadCount as getNotifUnreadCount } from "@/lib/api/notifications";
import {
  useWebSocket,
  NewMessageEvent,
  UserOnlineEvent,
  NotificationNewEvent,
} from "@/hooks/useWebSocket";
import { useOrganizationStore } from "@/stores/organizationStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { QAFloatingButton } from "@/components/common/QAFloatingButton";
import { useAffiliateStore } from "@/stores/affiliateStore";

// Background with teal glows and grid pattern
const AppBackground = () => (
  <>
    {/* Teal radial glows */}
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute -top-64 -right-64 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(0,208,132,0.07)_0%,transparent_70%)]" />
      <div className="absolute -bottom-64 -left-64 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,208,132,0.05)_0%,transparent_70%)]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-[radial-gradient(ellipse,rgba(56,97,251,0.03)_0%,transparent_70%)]" />
    </div>

    {/* Grid pattern overlay */}
    <div
      className="fixed inset-0 pointer-events-none z-0 opacity-[0.04]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        maskImage:
          "radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 100%)",
      }}
    />
  </>
);

// Email Verification Banner
const EmailVerificationBanner = ({ user, t }: { user: any; t: any }) => {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  if (!user) return null;
  const actualUser = user.user ? user.user : user;
  if (actualUser.isEmailVerified || dismissed) return null;

  // if (!user || user.isEmailVerified || dismissed) return null;
  const handleResend = async () => {
    if (sending || sent) return;
    setSending(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
        },
      );
      if (response.ok) {
        setSent(true);
      }
    } catch (error) {
      console.error("Failed to resend verification email:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-yellow-500/15 border-b border-yellow-500/20 text-yellow-200 px-4 py-2.5 text-sm flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>
          {t?.emailVerification?.banner || "Please verify your email address."}
        </span>
        {sent ? (
          <span className="text-[#00d084] font-medium ml-2">Email sent!</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            className="ml-2 underline hover:text-yellow-100 transition-colors font-medium disabled:opacity-50"
          >
            {sending
              ? "Sending..."
              : t?.emailVerification?.resend || "Resend verification email"}
          </button>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-yellow-300 hover:text-yellow-100 transition-colors p-1 ml-2"
        aria-label="Dismiss"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

/**
 * Invisible component that manages message unread counts and online status via WebSocket
 */
function MessageNotificationManager() {
  const { setUnreadCount, incrementUnread, setUserOnline, setUserOffline } =
    useMessageStore();
  const {
    incrementUnread: incrementNotifUnread,
    setUnreadCount: setNotifUnreadCount,
  } = useNotificationStore();

  useEffect(() => {
    getUnreadCount()
      .then((data) => setUnreadCount(data.count))
      .catch(() => {});
    getNotifUnreadCount()
      .then((count) => setNotifUnreadCount(count))
      .catch(() => {});
  }, [setUnreadCount, setNotifUnreadCount]);

  useWebSocket({
    onNewMessage: (event: NewMessageEvent) => {
      if (!window.location.pathname.includes(event.conversationId)) {
        incrementUnread();
      }
    },
    onUserOnline: (event: UserOnlineEvent) => {
      setUserOnline(event.userId);
    },
    onUserOffline: (event: UserOnlineEvent) => {
      setUserOffline(event.userId);
    },
    onNotificationNew: (_event: NotificationNewEvent) => {
      incrementNotifUnread();
    },
  });

  return null;
}

/**
 * Invisible component that initializes organization data for TEAM plan users
 */
function OrganizationInitializer() {
  const { fetchOrganization, organization, isLoading } = useOrganizationStore();

  useEffect(() => {
    if (!organization && !isLoading) {
      fetchOrganization();
    }
  }, []); // Run once on mount

  return null;
}

/**
 * Invisible component that checks affiliate status on mount
 */
function AffiliateInitializer() {
  const { checked, checkIsAffiliate } = useAffiliateStore();

  useEffect(() => {
    if (!checked) {
      checkIsAffiliate();
    }
  }, []); // Run once on mount

  return null;
}

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { dir, t } = useI18n();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [mounted, isLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060b18]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,208,132,0.2)_0%,transparent_70%)] w-32 h-32 -m-4 rounded-full" />
            <img
              src="/intelllogo.png"
              alt="IntellMatch"
              className="relative h-16 w-auto animate-pulse"
            />
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00d084] animate-pulse" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <PaywallGuard>
      <div
        className="min-h-screen bg-[#060b18] text-white"
        style={{
          paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
        }}
        dir={dir}
      >
        <AppBackground />

        <Header />
        <EmailVerificationBanner user={user} t={t} />
        <main className="relative z-10 page-container py-4">{children}</main>
        <BottomNav />
        <QAFloatingButton />

        {/* Message notification manager (unread counts, online status) */}
        <MessageNotificationManager />

        {/* Organization data initializer (for TEAM plan features) */}
        <OrganizationInitializer />

        {/* Affiliate status check */}
        <AffiliateInitializer />

        {/* WebSocket Connection Status Toast */}
        <ConnectionStatusToast />

        {/* Real-time notifications for matches and suggestions */}
        <RealTimeNotifications />
      </div>
    </PaywallGuard>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </I18nProvider>
  );
}
