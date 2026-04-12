'use client';

/**
 * Landing Page - Premium Fintech-Inspired Design with i18n
 *
 * Enhanced with dramatic glows, alternating section backgrounds,
 * phone mockup, parallax effects, section separators, and trust section.
 */

import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  DocumentSearch24Regular,
  Target24Regular,
  Globe24Regular,
  Chat24Regular,
  DataTrending24Regular,
  Alert24Regular,
  Star24Filled,
  ArrowRight24Regular,
  PlayCircle24Filled,
  Checkmark24Regular,
  Dismiss24Regular,
  Briefcase24Regular,
  People24Regular,
  Lightbulb24Regular,
  Rocket24Regular,
  Handshake24Regular,
  LockClosed24Regular,
  Money24Regular,
} from '@fluentui/react-icons';
import { I18nProvider, useI18n } from '@/lib/i18n';

// ============================================================
// Scroll-reveal hook
// ============================================================
function useRevealOnScroll(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ============================================================
// Parallax scroll hook for hero glows
// ============================================================
function useParallax() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setOffset(window.scrollY * 0.15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return offset;
}

// ============================================================
// Grid pattern overlay (used across all sections)
// ============================================================
const GridPattern = ({ opacity = 0.05 }: { opacity?: number }) => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      opacity,
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
      backgroundSize: '64px 64px',
    }}
  />
);

// ============================================================
// Section separator - gradient divider with glow
// ============================================================
const SectionSeparator = ({ color = 'teal' }: { color?: 'teal' | 'blue' }) => {
  const glowColor = color === 'teal' ? 'rgba(0,208,132,0.4)' : 'rgba(56,97,251,0.4)';
  const lineColor = color === 'teal' ? 'rgba(0,208,132,0.15)' : 'rgba(56,97,251,0.15)';
  return (
    <div className="relative h-px w-full">
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, transparent 0%, ${lineColor} 30%, ${lineColor} 70%, transparent 100%)` }} />
      <div className="absolute left-1/2 -translate-x-1/2 -top-4 w-64 h-8" style={{ background: `radial-gradient(ellipse, ${glowColor} 0%, transparent 70%)` }} />
    </div>
  );
};

// ============================================================
// Background decorations (enhanced with bigger, brighter glows)
// ============================================================
const HeroBackground = ({ parallaxOffset }: { parallaxOffset: number }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <GridPattern opacity={0.05} />
    {/* Large green radial glow behind hero - PROMINENT */}
    <div
      className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(0,208,132,0.2) 0%, rgba(0,208,132,0.08) 40%, transparent 70%)',
        transform: `translate(-50%, ${parallaxOffset * 0.5}px)`,
      }}
    />
    {/* Teal radial glow top-right - bigger & brighter */}
    <div
      className="absolute -top-32 -right-32 w-[900px] h-[900px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(0,208,132,0.22) 0%, transparent 70%)',
        transform: `translateY(${parallaxOffset * 0.3}px)`,
      }}
    />
    {/* Teal radial glow bottom-left - bigger & brighter */}
    <div
      className="absolute -bottom-48 -left-48 w-[800px] h-[800px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(0,208,132,0.18) 0%, transparent 70%)',
        transform: `translateY(${-parallaxOffset * 0.2}px)`,
      }}
    />
    {/* Blue glow center */}
    <div
      className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full"
      style={{
        background: 'radial-gradient(ellipse, rgba(56,97,251,0.12) 0%, transparent 70%)',
        transform: `translate(-50%, ${parallaxOffset * 0.4}px)`,
      }}
    />
  </div>
);

const SectionGlow = ({ position = 'right', intensity = 'normal' }: { position?: 'left' | 'right' | 'center'; intensity?: 'normal' | 'strong' }) => {
  const pos = position === 'left' ? '-left-64' : position === 'right' ? '-right-64' : 'left-1/2 -translate-x-1/2';
  const opacity = intensity === 'strong' ? '0.2' : '0.15';
  const size = intensity === 'strong' ? 'w-[900px] h-[900px]' : 'w-[800px] h-[800px]';
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <GridPattern opacity={0.05} />
      <div className={`absolute top-0 ${pos} ${size} rounded-full`} style={{ background: `radial-gradient(circle, rgba(0,208,132,${opacity}) 0%, transparent 70%)` }} />
    </div>
  );
};

// ============================================================
// Language switcher
// ============================================================
const LanguageSwitcher = () => {
  const { lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className="flex items-center gap-1 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer font-medium text-sm"
    >
      <span className={lang === 'en' ? 'text-white' : 'text-[#56657a]'}>EN</span>
      <span className="text-[#56657a]">/</span>
      <span className={lang === 'ar' ? 'text-white' : 'text-[#56657a]'}>AR</span>
    </button>
  );
};

// ============================================================
// Video modal
// ============================================================
const VideoModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useI18n();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-[#0c1222] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <Dismiss24Regular className="w-6 h-6 text-white" />
        </button>
        <div className="aspect-video bg-[#131b2e] flex items-center justify-center">
          <div className="text-center">
            <PlayCircle24Filled className="w-16 h-16 text-[#00d084] mx-auto mb-4" />
            <p className="text-white/70">{t.videoModal.title}</p>
            <p className="text-white/40 text-sm mt-2">{t.videoModal.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Feature card (enhanced with dramatic entrance)
// ============================================================
const FeatureCard = ({ icon, title, description, delay = 0 }: {
  icon: React.ReactNode; title: string; description: string; delay?: number;
}) => {
  const { ref, visible } = useRevealOnScroll();
  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[60px]'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="landing-card p-8 h-full flex flex-col group">
        <div className="w-14 h-14 rounded-xl bg-[#00d084]/10 border border-[#00d084]/20 flex items-center justify-center text-[#00d084] mb-6 group-hover:bg-[#00d084]/20 group-hover:scale-110 transition-all duration-300">
          {icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
        <p className="text-white/70 leading-relaxed text-sm flex-1">{description}</p>
      </div>
    </div>
  );
};

// ============================================================
// Testimonial card
// ============================================================
const TestimonialCard = ({ headline, quote, author, role, delay = 0 }: {
  headline: string; quote: string; author: string; role: string; delay?: number;
}) => {
  const { ref, visible } = useRevealOnScroll();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="landing-card p-8 h-full flex flex-col">
        <div className="flex gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star24Filled key={i} className="w-4 h-4 text-[#00d084]" />
          ))}
        </div>
        <h3 className="text-base font-semibold text-white mb-3">{headline}</h3>
        <p className="text-white/70 text-sm mb-6 italic leading-relaxed flex-1">&quot;{quote}&quot;</p>
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d084] to-[#00b870] flex items-center justify-center text-[#060b18] font-bold text-sm">
            {author[0]}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{author}</p>
            <p className="text-xs text-white/50">{role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Animated stat counter (with scale-in effect)
// ============================================================
const AnimatedStat = ({ value, label, suffix = '', delay = 0 }: { value: number; label: string; suffix?: string; delay?: number }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000;
          const increment = value / (duration / 16);
          const timer = setInterval(() => {
            start += increment;
            if (start >= value) { setCount(value); clearInterval(timer); }
            else setCount(Math.floor(start));
          }, 16);
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  return (
    <div
      ref={ref}
      className={`text-center px-2 transition-all duration-1000 ${hasAnimated ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#00d084] mb-2" dir="ltr">
        <span className="inline-block">{count.toLocaleString('en-US')}{suffix}</span>
      </div>
      <div className="text-white/70 font-medium text-sm">{label}</div>
    </div>
  );
};

// ============================================================
// Animated dashboard preview (hero)
// ============================================================
const AnimatedDashboardPreview = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useI18n();
  const anim = (t as any).animations || {};
  const [matchIndex, setMatchIndex] = useState(0);
  const [connections, setConnections] = useState(247);
  const [avgMatch, setAvgMatch] = useState(89);

  const matchData = [
    { name: anim.match1Name || 'Nora Al-Rashid', role: anim.match1Role || 'VP of Sales', score: 94, type: 'strong' },
    { name: anim.match2Name || 'Ahmed Al-Mansoori', role: anim.match2Role || 'CTO', score: 87, type: 'strong' },
    { name: anim.match3Name || 'Fatima Al-Sayed', role: anim.match3Role || 'Founder', score: 72, type: 'good' },
    { name: anim.match4Name || 'Khalid Al-Fahad', role: anim.match4Role || 'Investor', score: 91, type: 'strong' },
    { name: anim.match5Name || 'Layla Hassan', role: anim.match5Role || 'Director', score: 68, type: 'good' },
    { name: anim.match6Name || 'Omar Al-Bakri', role: anim.match6Role || 'CEO', score: 85, type: 'strong' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMatchIndex((prev) => (prev + 1) % (matchData.length - 2));
      setConnections((prev) => prev + Math.floor(Math.random() * 3));
      setAvgMatch(Math.floor(75 + Math.random() * 20));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const visibleMatches = compact
    ? [matchData[matchIndex], matchData[(matchIndex + 1) % matchData.length]]
    : [matchData[matchIndex], matchData[(matchIndex + 1) % matchData.length], matchData[(matchIndex + 2) % matchData.length]];

  if (compact) {
    return (
      <div className="relative">
        <div className="relative landing-card p-4 shadow-2xl !rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500/60" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
            <div className="w-2 h-2 rounded-full bg-green-500/60" />
            <div className="flex-1 ms-2 h-4 bg-white/5 rounded-md" />
          </div>
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-[#00d084]/5 border border-[#00d084]/10 rounded-lg p-3">
              <div className="text-lg font-bold text-white" dir="ltr">{connections}</div>
              <div className="text-[10px] text-white font-bold">{anim.connections || 'Connections'}</div>
            </div>
            <div className="flex-1 bg-[#3861fb]/5 border border-[#3861fb]/10 rounded-lg p-3">
              <div className="text-lg font-bold text-white" dir="ltr">{avgMatch}%</div>
              <div className="text-[10px] text-white font-bold">{anim.avgMatch || 'Avg Match'}</div>
            </div>
          </div>
          {visibleMatches.map((match, i) => (
            <div key={`${match.name}-${i}`} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-lg p-2 mb-2 last:mb-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[#060b18] font-bold text-xs ${match.type === 'strong' ? 'bg-gradient-to-br from-[#00d084] to-[#00b870]' : 'bg-gradient-to-br from-[#3861fb] to-[#5b7cfd]'}`}>
                {match.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-xs truncate">{match.name}</div>
                <div className="text-white/80 font-bold text-[10px]">{match.role}</div>
              </div>
              <div className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${match.type === 'strong' ? 'bg-[#00d084]/10 text-[#00d084]' : 'bg-[#3861fb]/10 text-[#5b7cfd]'}`} dir="ltr">
                {match.score}%
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative lg:block hidden">
      {/* Animated gradient border */}
      <div className="absolute -inset-[2px] rounded-2xl overflow-hidden">
        <div
          className="absolute inset-0 animate-spin-slow"
          style={{
            background: 'conic-gradient(from 0deg, #00d084, #3861fb, #00d084, transparent, #00d084)',
            animationDuration: '6s',
          }}
        />
      </div>
      {/* Outer glow */}
      <div className="absolute -inset-6 bg-[radial-gradient(ellipse,rgba(0,208,132,0.15)_0%,transparent_70%)] rounded-3xl" />
      <div className="relative landing-card p-6 shadow-2xl !rounded-2xl">
        {/* Browser dots */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <div className="flex-1 ms-4 h-6 bg-white/5 rounded-md" />
        </div>
        <div className="space-y-4">
          {/* Stats row */}
          <div className="flex gap-4">
            <div className="flex-1 bg-[#00d084]/5 border border-[#00d084]/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white transition-all duration-500" dir="ltr">{connections}</div>
              <div className="text-xs text-white font-bold mt-1">{anim.connections || 'Connections'}</div>
            </div>
            <div className="flex-1 bg-[#3861fb]/5 border border-[#3861fb]/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white transition-all duration-500" dir="ltr">{avgMatch}%</div>
              <div className="text-xs text-white font-bold mt-1">{anim.avgMatch || 'Avg Match'}</div>
            </div>
          </div>
          {/* Match rows */}
          {visibleMatches.map((match, i) => (
            <div key={`${match.name}-${i}`} className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:bg-white/[0.06] transition-all duration-500">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[#060b18] font-bold text-sm ${match.type === 'strong' ? 'bg-gradient-to-br from-[#00d084] to-[#00b870]' : 'bg-gradient-to-br from-[#3861fb] to-[#5b7cfd]'}`}>
                {match.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm truncate">{match.name}</div>
                <div className="text-white/80 font-bold text-xs">{match.role}</div>
              </div>
              <div className={`px-3 py-1 text-xs rounded-full font-medium ${match.type === 'strong' ? 'bg-[#00d084]/10 text-[#00d084] border border-[#00d084]/20' : 'bg-[#3861fb]/10 text-[#5b7cfd] border border-[#3861fb]/20'}`} dir="ltr">
                {match.score}%
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Floating notification */}
      <div className="absolute -end-4 top-1/4 landing-card !p-3 animate-gentle-float shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#00d084] rounded-lg flex items-center justify-center">
            <Checkmark24Regular className="w-4 h-4 text-[#060b18]" />
          </div>
          <div>
            <div className="font-semibold text-white text-xs">{anim.newMatch || 'New Match!'}</div>
            <div className="text-[10px] text-white/80 font-bold">{anim.noraSharesInterests || 'Nora shares 5 interests'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Phone Mockup component
// ============================================================
// Animated counter hook for phone mockup stats
function useCountUp(target: number, duration: number, start: boolean, suffix = '') {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) { setValue(0); return; }
    let startTime: number | null = null;
    let frame: number;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, start]);
  return `${value}${suffix}`;
}

// Continuously shifting bar heights for the live chart effect
function useLiveBars(baseHeights: number[], active: boolean) {
  const [heights, setHeights] = useState(baseHeights);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setHeights(prev => prev.map((h, i) => {
        const delta = (Math.random() - 0.4) * 14;
        return Math.max(20, Math.min(95, h + delta));
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [active]);
  return heights;
}

// Cycling match scores for a live feel
function useLiveScores(baseScores: number[], active: boolean) {
  const [scores, setScores] = useState(baseScores);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setScores(prev => prev.map(s => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(80, Math.min(99, s + delta));
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [active]);
  return scores;
}

// Live incrementing connections counter
function useLiveCounter(base: number, active: boolean) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setValue(prev => prev + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [active]);
  return value;
}

// Notification pop-in that appears periodically
function useNotificationPop(active: boolean, messages: string[] = ['New match found!', 'Sara K. connected', '+3 connections', 'Match: 96%']) {
  const [show, setShow] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    // First pop after 3s, then every 5s
    const firstTimeout = setTimeout(() => {
      setShow(true);
      setTimeout(() => setShow(false), 2500);
    }, 3000);
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % messages.length);
      setShow(true);
      setTimeout(() => setShow(false), 2500);
    }, 5000);
    return () => { clearTimeout(firstTimeout); clearInterval(interval); };
  }, [active]);
  return { show, message: messages[msgIndex] };
}

const PhoneMockup = () => {
  const { t } = useI18n();
  const anim = (t as any).animations || {};
  const { ref, visible } = useRevealOnScroll();
  const connectionsDisplay = useCountUp(247, 1800, visible);
  const matchRateDisplay = useCountUp(89, 1600, visible, '%');

  // Continuous animations activate after initial reveal
  const [liveActive, setLiveActive] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setLiveActive(true), 2200);
    return () => clearTimeout(timer);
  }, [visible]);

  const baseBarHeights = [30, 45, 35, 55, 48, 62, 58, 72, 65, 80, 75, 90];
  const liveBarHeights = useLiveBars(baseBarHeights, liveActive);

  const baseMatches = [
    { name: anim.phoneMatch1 || 'Nora A.', score: 94 },
    { name: anim.phoneMatch2 || 'Ahmed M.', score: 87 },
    { name: anim.phoneMatch3 || 'Khalid F.', score: 91 },
  ];
  const liveScores = useLiveScores(baseMatches.map(m => m.score), liveActive);
  const liveConnections = useLiveCounter(247, liveActive);
  const notifMessages = [
    anim.notifNewMatch || 'New match found!',
    anim.notifSaraConnected || 'Sara K. connected',
    anim.notifPlusConnections || '+3 connections',
    anim.notifMatch96 || 'Match: 96%',
  ];
  const notification = useNotificationPop(liveActive, notifMessages);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'}`}
    >
      <div className="relative mx-auto" style={{ width: '320px', maxWidth: '100%' }}>
        {/* Phone outer glow - pulses when visible */}
        <div className={`absolute -inset-8 bg-[radial-gradient(ellipse,rgba(0,208,132,0.15)_0%,transparent_70%)] rounded-[60px] transition-opacity duration-1000 ${visible ? 'animate-[phonePulse_3s_ease-in-out_infinite]' : 'opacity-0'}`} />
        {/* Phone frame */}
        <div className="relative bg-[#1a1a2e] rounded-[40px] p-3 border-2 border-white/10 shadow-2xl shadow-black/50">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1a1a2e] rounded-b-2xl z-10 flex items-center justify-center">
            <div className="w-16 h-4 bg-[#0a0a18] rounded-full" />
          </div>

          {/* Floating notification toast */}
          <div
            className="absolute top-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{
              opacity: notification.show ? 1 : 0,
              transform: notification.show ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            <div className="bg-[#00d084] text-[#060b18] text-[9px] font-bold px-3 py-1.5 rounded-full shadow-lg shadow-[#00d084]/30 whitespace-nowrap flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-[#060b18] rounded-full animate-ping" />
              {notification.message}
            </div>
          </div>

          {/* Screen */}
          <div className="relative bg-[#060b18] rounded-[32px] overflow-hidden pt-6">
            {/* Scanning line effect */}
            {liveActive && (
              <div className="absolute inset-x-0 top-0 bottom-0 z-[1] pointer-events-none overflow-hidden rounded-[32px]">
                <div className="absolute inset-x-0 h-[1px] animate-[scanLine_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[#00d084]/30 to-transparent" />
              </div>
            )}
            {/* Status bar */}
            <div className="flex items-center justify-between px-6 py-2 text-[10px] text-white/60">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 border border-white/40 rounded-sm relative">
                  <div className="absolute inset-[1px] bg-[#00d084] rounded-[1px]" style={{ width: '70%' }} />
                </div>
              </div>
            </div>
            {/* App header */}
            <div className="px-5 py-3">
              <h3 className={`text-white font-bold text-sm transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>{anim.dashboard || 'Dashboard'}</h3>
              <p className={`text-white/80 font-bold text-[10px] transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>{anim.networkAtGlance || 'Your network at a glance'}</p>
            </div>
            {/* Dashboard content inside phone */}
            <div className="px-4 pb-6 space-y-3">
              {/* Stats row - slide up with stagger */}
              <div className="flex gap-2">
                <div className={`flex-1 bg-[#00d084]/5 border border-[#00d084]/10 rounded-xl p-3 transition-all duration-700 delay-[400ms] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  <div className="text-lg font-bold text-white tabular-nums" dir="ltr">
                    {liveActive ? liveConnections : connectionsDisplay}
                  </div>
                  <div className="text-[9px] text-white font-bold">{anim.connections || 'Connections'}</div>
                  {/* Live indicator dot */}
                  {liveActive && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1 h-1 rounded-full bg-[#00d084] animate-pulse" />
                      <span className="text-[7px] text-[#00d084]/60">{anim.live || 'Live'}</span>
                    </div>
                  )}
                </div>
                <div className={`flex-1 bg-[#3861fb]/5 border border-[#3861fb]/10 rounded-xl p-3 transition-all duration-700 delay-[550ms] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  <div className="text-lg font-bold text-white tabular-nums" dir="ltr">{matchRateDisplay}</div>
                  <div className="text-[9px] text-white font-bold">{anim.matchRate || 'Match Rate'}</div>
                  {liveActive && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1 h-1 rounded-full bg-[#3861fb] animate-pulse" />
                      <span className="text-[7px] text-[#3861fb]/60">{anim.live || 'Live'}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Mini chart - bars animate continuously */}
              <div className={`bg-white/[0.03] border border-white/5 rounded-xl p-3 transition-all duration-600 delay-[700ms] ${visible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-white font-bold">{anim.networkGrowth || 'Network Growth'}</div>
                  {liveActive && (
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-[#00d084] animate-[blink_1.5s_ease-in-out_infinite]" />
                      <span className="text-[7px] text-[#00d084]/60">{anim.updating || 'Updating'}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-end gap-1 h-12">
                  {(liveActive ? liveBarHeights : baseBarHeights).map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-gradient-to-t from-[#00d084]/40 to-[#00d084] origin-bottom"
                      style={{
                        height: visible ? `${Math.round(h)}%` : '0%',
                        transition: liveActive
                          ? 'height 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
                          : `height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${800 + i * 80}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Recent matches - scores update live */}
              <div className={`bg-white/[0.03] border border-white/5 rounded-xl p-3 transition-all duration-600 delay-[1200ms] ${visible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="text-[10px] text-white font-bold mb-2">{anim.recentMatches || 'Recent Matches'}</div>
                {baseMatches.map((m, i) => {
                  const currentScore = liveActive ? liveScores[i] : m.score;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0"
                      style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateX(0)' : 'translateX(20px)',
                        transition: `opacity 0.5s ease ${1400 + i * 200}ms, transform 0.5s ease ${1400 + i * 200}ms`,
                      }}
                    >
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br from-[#00d084] to-[#00b870] flex items-center justify-center text-[#060b18] text-[8px] font-bold ${liveActive ? 'animate-[avatarPop_3s_ease-in-out_infinite]' : ''}`}
                        style={liveActive ? { animationDelay: `${i * 1000}ms` } : {}}
                      >
                        {m.name[0]}
                      </div>
                      <span className="text-white text-[10px] flex-1">{m.name}</span>
                      <span className="text-[#00d084] text-[10px] font-medium tabular-nums transition-all duration-700" dir="ltr">{currentScore}%</span>
                    </div>
                  );
                })}
              </div>
              {/* Bottom nav mock - fade in last */}
              <div
                className="flex items-center justify-around pt-2 border-t border-white/5"
                style={{
                  opacity: visible ? 1 : 0,
                  transition: 'opacity 0.6s ease 2000ms',
                }}
              >
                {[anim.home || 'Home', anim.contacts || 'Contacts', anim.scan || 'Scan', anim.messages || 'Messages'].map((label, i) => (
                  <div key={i} className="text-center">
                    <div className={`w-5 h-5 rounded-full mx-auto mb-0.5 ${i === 0 ? 'bg-[#00d084] shadow-[0_0_8px_rgba(0,208,132,0.5)]' : 'bg-white/10'}`} />
                    <span className={`text-[8px] font-bold ${i === 0 ? 'text-[#00d084]' : 'text-white/80'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Home indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  );
};

// ============================================================
// Use-case card
// ============================================================
const UseCaseCard = ({ href, icon, label, delay = 0 }: { href: string; icon: React.ReactNode; label: string; delay?: number }) => {
  const { ref, visible } = useRevealOnScroll();
  return (
    <Link href={href} className="group h-full" ref={ref as any}>
      <div
        className={`landing-card flex flex-col items-center justify-center p-6 h-full min-h-[160px] transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{ transitionDelay: `${delay}ms` }}
      >
        <div className="w-14 h-14 rounded-xl bg-[#00d084]/10 border border-[#00d084]/20 flex items-center justify-center text-[#00d084] mb-4 group-hover:bg-[#00d084]/20 group-hover:scale-110 transition-all duration-300">
          {icon}
        </div>
        <span className="text-sm font-medium text-white text-center leading-tight">{label}</span>
      </div>
    </Link>
  );
};

// ============================================================
// How It Works step (with slide-in from alternating sides)
// ============================================================
const HowItWorksStep = ({ number, icon, title, description, delay = 0, direction = 'center' }: {
  number: number; icon: React.ReactNode; title: string; description: string; delay?: number; direction?: 'left' | 'right' | 'center';
}) => {
  const { ref, visible } = useRevealOnScroll();
  const translateClass = direction === 'left'
    ? (visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-16')
    : direction === 'right'
      ? (visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16')
      : (visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8');
  return (
    <div
      ref={ref}
      className={`relative text-center transition-all duration-1000 ${translateClass}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="relative mx-auto w-20 h-20 mb-6">
        <div className="absolute inset-0 bg-[#00d084]/10 rounded-2xl rotate-6" />
        <div className="relative w-full h-full bg-[#0c1222] border border-[#00d084]/20 rounded-2xl flex items-center justify-center text-[#00d084]">
          {icon}
        </div>
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#00d084] text-[#060b18] font-bold text-xs flex items-center justify-center">
          {number}
        </div>
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/70 leading-relaxed max-w-xs mx-auto">{description}</p>
    </div>
  );
};

// ============================================================
// Trust/Security Section
// ============================================================
const TrustSection = () => {
  const { ref, visible } = useRevealOnScroll();
  const { t } = useI18n();

  const badges = [
    {
      icon: <LockClosed24Regular className="w-8 h-8" />,
      title: t.trust?.badges?.ssl?.title || 'SSL Encrypted',
      description: t.trust?.badges?.ssl?.description || 'All data encrypted in transit with 256-bit SSL',
    },
    {
      icon: <DataTrending24Regular className="w-8 h-8" />,
      title: t.trust?.badges?.uptime?.title || '99.9% Uptime',
      description: t.trust?.badges?.uptime?.description || 'Enterprise-grade reliability you can count on',
    },
    {
      icon: <Checkmark24Regular className="w-8 h-8" />,
      title: t.trust?.badges?.gdpr?.title || 'GDPR Compliant',
      description: t.trust?.badges?.gdpr?.description || 'Your data privacy is our top priority',
    },
    {
      icon: <Globe24Regular className="w-8 h-8" />,
      title: t.trust?.badges?.cdn?.title || 'Global CDN',
      description: t.trust?.badges?.cdn?.description || 'Fast access from anywhere in the world',
    },
  ];

  return (
    <section className="relative py-16 md:py-24 bg-[#0d1f35]" style={{ borderTop: '1px solid rgba(0,208,132,0.1)', borderBottom: '1px solid rgba(0,208,132,0.1)' }}>
      <GridPattern opacity={0.05} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(0,208,132,0.1) 0%, transparent 70%)' }} />
      </div>

      <div
        ref={ref}
        className={`relative max-w-6xl mx-auto px-6 lg:px-8 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
      >
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-6">
            <LockClosed24Regular className="w-4 h-4 text-[#00d084]" />
            <span className="text-[#00d084] text-sm font-medium">{t.trust?.badge || 'Trusted & Secure'}</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            {t.trust?.title || 'Trusted by'} <span className="text-gradient-teal">{t.trust?.titleHighlight || '10,000+'}</span> {t.trust?.titleEnd || 'Professionals'}
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            {t.trust?.subtitle || 'Your data security and privacy are built into every layer of our platform'}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {badges.map((badge, i) => (
            <div
              key={i}
              className={`text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="w-16 h-16 rounded-2xl bg-[#00d084]/10 border border-[#00d084]/20 flex items-center justify-center text-[#00d084] mx-auto mb-4">
                {badge.icon}
              </div>
              <h3 className="text-base font-bold text-white mb-1">{badge.title}</h3>
              <p className="text-sm text-white/70 leading-relaxed">{badge.description}</p>
            </div>
          ))}
        </div>

        {/* Trust logos placeholder */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <p className="text-center text-white/50 text-sm mb-6">{t.trust?.protecting || 'Protecting professionals worldwide'}</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {['AES-256', 'SOC 2', 'HTTPS', 'OAuth 2.0'].map((label, i) => (
              <div key={i} className="px-4 py-2 bg-white/[0.03] border border-white/5 rounded-lg text-white/70 text-sm font-medium">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// Affiliate Program Section
// ============================================================
const AffiliateSection = () => {
  const { ref, visible } = useRevealOnScroll();
  const { t } = useI18n();

  const benefits = [
    {
      icon: <Money24Regular className="w-7 h-7" />,
      title: (t as any).affiliateLanding?.benefits?.earn?.title || 'Earn Commissions',
      description: (t as any).affiliateLanding?.benefits?.earn?.description || 'Get up to 20% commission on every referral that converts to a paying customer.',
    },
    {
      icon: <DataTrending24Regular className="w-7 h-7" />,
      title: (t as any).affiliateLanding?.benefits?.track?.title || 'Real-Time Tracking',
      description: (t as any).affiliateLanding?.benefits?.track?.description || 'Monitor your referrals, conversions, and earnings with a dedicated dashboard.',
    },
    {
      icon: <People24Regular className="w-7 h-7" />,
      title: (t as any).affiliateLanding?.benefits?.codes?.title || 'Custom Referral Codes',
      description: (t as any).affiliateLanding?.benefits?.codes?.description || 'Create personalized codes with flexible discount rates for your audience.',
    },
  ];

  return (
    <section id="affiliate" className="relative py-16 md:py-28 bg-[#0a1628]">
      <GridPattern opacity={0.05} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(0,208,132,0.1) 0%, transparent 70%)' }} />
      </div>

      <div
        ref={ref}
        className={`relative max-w-6xl mx-auto px-6 lg:px-8 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
      >
        <div className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-6">
            <Money24Regular className="w-4 h-4 text-[#00d084]" />
            <span className="text-[#00d084] text-sm font-medium">{(t as any).affiliateLanding?.badge || 'Affiliate Program'}</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            {(t as any).affiliateLanding?.title || 'Earn While You Share'}
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            {(t as any).affiliateLanding?.subtitle || 'Join our affiliate program and earn commissions by referring professionals to IntellMatch. Share your unique codes and watch your earnings grow.'}
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {benefits.map((benefit, i) => (
            <div
              key={i}
              className={`landing-card p-8 text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="w-14 h-14 rounded-xl bg-[#00d084]/10 border border-[#00d084]/20 flex items-center justify-center text-[#00d084] mx-auto mb-5">
                {benefit.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{benefit.title}</h3>
              <p className="text-sm text-white/70 leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* How it works mini-steps */}
        <div className="landing-card p-8 md:p-10 mb-10">
          <h3 className="text-xl font-bold text-white text-center mb-8">{(t as any).affiliateLanding?.howTitle || 'How It Works'}</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: (t as any).affiliateLanding?.steps?.apply?.title || 'Apply', desc: (t as any).affiliateLanding?.steps?.apply?.description || 'Sign up and apply to our affiliate program. Get approved quickly.' },
              { step: '2', title: (t as any).affiliateLanding?.steps?.share?.title || 'Share', desc: (t as any).affiliateLanding?.steps?.share?.description || 'Create custom referral codes and share them with your network.' },
              { step: '3', title: (t as any).affiliateLanding?.steps?.earn?.title || 'Earn', desc: (t as any).affiliateLanding?.steps?.earn?.description || 'Earn commissions when your referrals sign up and subscribe.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#00d084] text-[#060b18] font-bold flex items-center justify-center flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">{item.title}</h4>
                  <p className="text-sm text-white/60">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/affiliate/apply" className="btn-accent px-8 py-4 text-lg inline-flex items-center justify-center gap-2">
            {(t as any).affiliateLanding?.cta || 'Join Affiliate Program'}
            <ArrowRight24Regular className="w-5 h-5 rtl:rotate-180" />
          </Link>
          <p className="mt-4 text-white/50 text-sm">{(t as any).affiliateLanding?.ctaNote || 'Free to join. No minimum requirements.'}</p>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// Main Landing Content
// ============================================================
function LandingPageContent() {
  const { t, dir } = useI18n();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const parallaxOffset = useParallax();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = useCallback((e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const features = [
    { icon: <DocumentSearch24Regular className="w-7 h-7" />, ...t.features.items.scanning },
    { icon: <Target24Regular className="w-7 h-7" />, ...t.features.items.matching },
    { icon: <Globe24Regular className="w-7 h-7" />, ...t.features.items.network },
    { icon: <Chat24Regular className="w-7 h-7" />, ...t.features.items.conversation },
    { icon: <DataTrending24Regular className="w-7 h-7" />, ...t.features.items.analytics },
    { icon: <Alert24Regular className="w-7 h-7" />, ...t.features.items.followups },
  ];

  return (
    <div className="min-h-screen bg-[#060b18] text-white overflow-hidden" dir={dir}>
      {/* Spin-slow animation style */}
      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 6s linear infinite;
        }
      `}</style>

      {/* ==================== NAVBAR ==================== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-[#060b18]/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20' : 'bg-transparent'}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <img src="/intelllogo.png" alt="IntellMatch" className="h-11 w-auto" />
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm cursor-pointer">{t.howItWorks?.badge || 'How It Works'}</a>
              <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm cursor-pointer">{t.nav.features}</a>
              <a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm cursor-pointer">{t.nav.testimonials}</a>
              <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm cursor-pointer">{t.nav.pricing}</a>
              <Link href="/faq" className="text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm">{t.faq?.badge || 'FAQ'}</Link>
              <Link href="/videos" className="text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm">{(t as any).videoGallery?.navLabel || 'Videos'}</Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              {!authLoading && isAuthenticated ? (
                <Link href="/dashboard" className="btn-accent px-5 py-2.5 text-sm whitespace-nowrap">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="hidden sm:inline-flex text-[#c4cdd8] hover:text-white transition-colors font-medium px-4 py-2 text-sm">{t.nav.signIn}</Link>
                  <Link href="/register" className="btn-accent px-5 py-2.5 text-sm whitespace-nowrap">
                    {t.nav.getStarted}
                  </Link>
                </>
              )}
              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2 text-white/70 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="flex flex-col gap-1.5 w-5"><span className="w-full h-0.5 bg-current rounded" /><span className="w-full h-0.5 bg-current rounded" /><span className="w-full h-0.5 bg-current rounded" /></span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0c1222] border-t border-white/5 px-6 py-4 space-y-3">
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="block text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm py-2">{t.howItWorks?.badge || 'How It Works'}</a>
            <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="block text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm py-2">{t.nav.features}</a>
            <a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="block text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm py-2">{t.nav.testimonials}</a>
            <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="block text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm py-2">{t.nav.pricing}</a>
            <Link href="/faq" className="block text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm py-2">{t.faq?.badge || 'FAQ'}</Link>
            <Link href="/videos" className="block text-white/70 hover:text-[#00d084] transition-colors font-medium text-sm py-2">{(t as any).videoGallery?.navLabel || 'Videos'}</Link>
            {/* Auth links */}
            <div className="border-t border-white/10 pt-3 mt-3 space-y-3">
              {!authLoading && isAuthenticated ? (
                <Link href="/dashboard" className="block text-center btn-accent px-5 py-2.5 text-sm rounded-lg font-medium">Dashboard</Link>
              ) : (
                <>
                  <Link href="/login" className="block text-center text-[#00d084] hover:text-[#00d084]/80 transition-colors font-medium text-sm py-2">{t.nav.signIn}</Link>
                  <Link href="/register" className="block text-center btn-accent px-5 py-2.5 text-sm rounded-lg font-medium">{t.nav.getStarted}</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ==================== HERO (bg: #060b18 - darkest) ==================== */}
      <section className="relative min-h-screen flex items-center pt-20 bg-[#060b18]">
        <HeroBackground parallaxOffset={parallaxOffset} />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-10 md:py-20">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="text-center lg:text-start">
              {/* Mobile logo text */}
              <div className="flex justify-center sm:hidden mb-6">
                <span className="text-3xl font-bold text-gradient-teal">IntellMatch</span>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d084] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d084]" />
                </span>
                <span className="text-sm text-[#00d084] font-medium">{t.hero.badge}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] mb-8 tracking-tight">
                <span className="block text-white">{t.hero.title1}</span>
                <span className="block text-gradient-teal">{t.hero.title2}</span>
              </h1>

              <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">{t.hero.subtitle}</p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="btn-accent px-8 py-4 text-lg inline-flex items-center justify-center gap-2">
                  {t.hero.cta}
                  <ArrowRight24Regular className="w-5 h-5 rtl:rotate-180" />
                </a>
                <button onClick={() => setShowVideoModal(true)} className="btn-outline-accent px-8 py-4 text-lg inline-flex items-center justify-center gap-3">
                  <PlayCircle24Filled className="w-5 h-5" />
                  {t.hero.watchDemo}
                </button>
              </div>

              {/* Mobile dashboard preview */}
              <div className="lg:hidden mt-10">
                <AnimatedDashboardPreview compact />
              </div>

              {/* Social proof */}
              <div className="mt-12 flex items-center gap-5 justify-center lg:justify-start">
                <div className="flex -space-x-2 rtl:space-x-reverse">
                  {['bg-[#00d084]', 'bg-[#3861fb]', 'bg-[#00b870]', 'bg-[#5b7cfd]', 'bg-[#00e896]'].map((bg, i) => (
                    <div key={i} className={`w-11 h-11 ${bg} rounded-full border-2 border-[#060b18] flex items-center justify-center text-[#060b18] text-sm font-bold`}>
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <div className="text-start">
                  <div className="text-white font-semibold text-sm">{t.hero.socialProof}</div>
                  <div className="text-xs text-white/50">{t.hero.socialProofSub}</div>
                </div>
              </div>
            </div>

            {/* Dashboard Preview (desktop) */}
            <AnimatedDashboardPreview />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50">
          <span className="text-xs">{t.hero.scrollToExplore}</span>
          <div className="w-5 h-8 border border-[#56657a]/50 rounded-full p-1">
            <div className="w-1 h-2 bg-[#00d084] rounded-full animate-bounce mx-auto" />
          </div>
        </div>
      </section>

      <SectionSeparator color="teal" />

      {/* ==================== USE CASES (bg: #0a1628 - slightly lighter) ==================== */}
      <section className="relative py-16 md:py-24 bg-[#0a1628]">
        <GridPattern opacity={0.05} />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,208,132,0.08) 0%, transparent 70%)' }} />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {t.useCases?.title || 'What are you looking for right now?'}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <UseCaseCard href="/use-cases/looking-for-job" icon={<Briefcase24Regular className="w-7 h-7" />} label={t.useCases?.items?.lookingForJob?.label || 'Looking for a Job'} delay={0} />
            <UseCaseCard href="/use-cases/hiring" icon={<People24Regular className="w-7 h-7" />} label={t.useCases?.items?.hiring?.label || "We're Hiring"} delay={80} />
            <UseCaseCard href="/use-cases/have-project" icon={<Lightbulb24Regular className="w-7 h-7" />} label={t.useCases?.items?.haveProject?.label || 'I Have a Project'} delay={160} />
            <UseCaseCard href="/use-cases/entrepreneur" icon={<Rocket24Regular className="w-7 h-7" />} label={t.useCases?.items?.entrepreneur?.label || "I'm an Entrepreneur"} delay={240} />
            <UseCaseCard href="/use-cases/buy-sell" icon={<Handshake24Regular className="w-7 h-7" />} label={t.useCases?.items?.buySell?.label || 'Buy or Sell'} delay={320} />
            <UseCaseCard href="/use-cases/collaborate" icon={<LockClosed24Regular className="w-7 h-7" />} label={t.useCases?.items?.collaborate?.label || 'Collaborate Privately'} delay={400} />
          </div>
        </div>
      </section>

      <SectionSeparator color="blue" />

      {/* ==================== HOW IT WORKS (bg: #060b18 - darkest) ==================== */}
      <section id="how-it-works" className="relative py-16 md:py-28 bg-[#060b18]">
        <SectionGlow position="left" intensity="strong" />
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-6">
              <span className="text-[#00d084] text-sm font-medium">{t.howItWorks?.badge || 'How It Works'}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {t.howItWorks?.title || 'Get Started in Minutes'}
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              {t.howItWorks?.subtitle || 'Three simple steps to transform your professional network'}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <HowItWorksStep
              number={1}
              icon={<DocumentSearch24Regular className="w-8 h-8" />}
              title={t.howItWorks?.steps?.scan?.title || 'Scan & Import'}
              description={t.howItWorks?.steps?.scan?.description || 'Scan business cards or import contacts. Our AI extracts and organizes everything automatically.'}
              delay={0}
              direction="left"
            />
            <HowItWorksStep
              number={2}
              icon={<Target24Regular className="w-8 h-8" />}
              title={t.howItWorks?.steps?.match?.title || 'AI Matching'}
              description={t.howItWorks?.steps?.match?.description || 'Our AI analyzes compatibility across skills, sectors, and goals to find your best connections.'}
              delay={150}
              direction="center"
            />
            <HowItWorksStep
              number={3}
              icon={<Handshake24Regular className="w-8 h-8" />}
              title={t.howItWorks?.steps?.connect?.title || 'Connect & Grow'}
              description={t.howItWorks?.steps?.connect?.description || 'Get introduced to the right people, collaborate on projects, and grow your network intelligently.'}
              delay={300}
              direction="right"
            />
          </div>
        </div>
      </section>

      <SectionSeparator color="teal" />

      {/* ==================== PHONE MOCKUP "Everything You Need" (bg: #0d1f35 - lighter panel) ==================== */}
      <section className="relative py-16 md:py-28 bg-[#0d1f35]" style={{ borderTop: '1px solid rgba(0,208,132,0.1)', borderBottom: '1px solid rgba(0,208,132,0.1)' }}>
        <GridPattern opacity={0.05} />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[800px] rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(0,208,132,0.12) 0%, transparent 60%)' }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Text content */}
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-6">
                <span className="text-[#00d084] text-sm font-medium">{t.mobileFirst?.badge || 'Mobile First'}</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                {t.mobileFirst?.title1 || 'Everything You Need,'}
                <span className="block text-gradient-teal">{t.mobileFirst?.title2 || 'In Your Pocket'}</span>
              </h2>
              <p className="text-lg text-white/70 mb-8 leading-relaxed">
                {t.mobileFirst?.subtitle || 'Access your entire professional network from anywhere. Scan cards, find matches, and manage connections on the go with our powerful mobile experience.'}
              </p>
              <div className="space-y-4">
                {(t.mobileFirst?.features || [
                  'Real-time AI matching on mobile',
                  'Instant business card scanning',
                  'Push notifications for new matches',
                  'Offline access to your contacts',
                ]).map((feature: string, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#00d084]/10 border border-[#00d084]/20 flex items-center justify-center">
                      <Checkmark24Regular className="w-3 h-3 text-[#00d084]" />
                    </div>
                    <span className="text-white/80 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Phone mockup */}
            <div className="order-1 md:order-2 flex justify-center">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      <SectionSeparator color="blue" />

      {/* ==================== FEATURES (bg: #0d1f35 - lighter panel with borders) ==================== */}
      <section id="features" className="relative py-16 md:py-28 bg-[#0d1f35]" style={{ borderTop: '1px solid rgba(0,208,132,0.1)', borderBottom: '1px solid rgba(0,208,132,0.1)' }}>
        <GridPattern opacity={0.05} />
        <SectionGlow position="right" intensity="strong" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-6">
              <span className="text-[#00d084] text-sm font-medium">{t.features.badge}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {t.features.title1}
              <span className="block text-gradient-teal">{t.features.title2}</span>
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">{t.features.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} delay={i * 120} />
            ))}
          </div>
        </div>
      </section>

      <SectionSeparator color="teal" />

      {/* ==================== STATS (bg: dark with strong teal glow band) ==================== */}
      <section className="relative py-16 sm:py-24 overflow-hidden bg-[#060b18]">
        <GridPattern opacity={0.05} />
        {/* Strong teal glow band */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,208,132,0.08) 30%, rgba(0,208,132,0.12) 50%, rgba(0,208,132,0.08) 70%, transparent 100%)' }} />
        <div className="absolute inset-0 border-y border-[#00d084]/10" />
        {/* Extra glow in center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[300px] rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(0,208,132,0.15) 0%, transparent 70%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
            <AnimatedStat value={10000} label={t.stats.users} suffix="+" delay={0} />
            <AnimatedStat value={500000} label={t.stats.connections} suffix="+" delay={150} />
            <AnimatedStat value={98} label={t.stats.satisfaction} suffix="%" delay={300} />
            <AnimatedStat value={50000} label={t.stats.scanned} suffix="+" delay={450} />
          </div>
        </div>
      </section>

      <SectionSeparator color="blue" />

      {/* ==================== TESTIMONIALS (bg: #060b18 - darkest) ==================== */}
      <section id="testimonials" className="relative py-16 md:py-28 bg-[#060b18]">
        <SectionGlow position="center" intensity="strong" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-6">
              <span className="text-[#00d084] text-sm font-medium">{t.testimonials.badge}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {t.testimonials.title1}
              <span className="block text-gradient-teal">{t.testimonials.title2}</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {t.testimonials.items.map((testimonial, i) => (
              <TestimonialCard key={i} {...testimonial} delay={i * 120} />
            ))}
          </div>
        </div>
      </section>

      <SectionSeparator color="teal" />

      {/* ==================== AFFILIATE PROGRAM (bg: #0a1628) ==================== */}
      <AffiliateSection />

      <SectionSeparator color="blue" />

      {/* ==================== PRICING (bg: #0d1f35 - lighter panel) ==================== */}
      <PricingSection />

      <SectionSeparator color="blue" />

      {/* ==================== CTA (bg: dark with dramatic glow) ==================== */}
      <section className="relative py-16 md:py-28 bg-[#060b18]">
        <GridPattern opacity={0.05} />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px]" style={{ background: 'radial-gradient(circle, rgba(0,208,132,0.2) 0%, rgba(0,208,132,0.05) 40%, transparent 70%)' }} />
          <div className="absolute top-0 right-0 w-[600px] h-[600px]" style={{ background: 'radial-gradient(circle, rgba(56,97,251,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px]" style={{ background: 'radial-gradient(circle, rgba(0,208,132,0.12) 0%, transparent 70%)' }} />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            {t.cta.title1}
            <span className="block text-gradient-teal">{t.cta.title2}</span>
          </h2>
          <p className="text-lg text-white/70 mb-10 max-w-2xl mx-auto">{t.cta.subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="btn-accent px-8 py-4 text-lg inline-flex items-center justify-center gap-2">
              {t.cta.primary}
              <ArrowRight24Regular className="w-5 h-5 rtl:rotate-180" />
            </a>
            <Link href="/login" className="btn-outline-accent px-8 py-4 text-lg inline-flex items-center justify-center">{t.cta.secondary}</Link>
          </div>
          <p className="mt-6 text-white/50 text-sm">{t.cta.disclaimer}</p>
        </div>
      </section>

      <SectionSeparator color="teal" />

      {/* ==================== TRUST/SECURITY SECTION ==================== */}
      <TrustSection />

      <SectionSeparator color="blue" />

      {/* ==================== FOOTER (bg: #050a15 - darkest) ==================== */}
      <footer className="relative border-t border-white/5 bg-[#050a15]">
        <GridPattern opacity={0.03} />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <img src="/intelllogo.png" alt="IntellMatch" className="h-10 w-auto mb-4" />
              <p className="text-white/70 text-sm leading-relaxed max-w-sm">{t.footer.tagline}</p>
              <div className="flex items-center gap-4 mt-6">
                <div className="flex items-center gap-2 text-[#00d084]">
                  <LockClosed24Regular className="w-4 h-4" />
                  <span className="text-xs font-medium">{t.trust?.footerSecure || 'Secure & Private'}</span>
                </div>
                <div className="flex items-center gap-2 text-[#00d084]">
                  <DataTrending24Regular className="w-4 h-4" />
                  <span className="text-xs font-medium">{t.trust?.footerUptime || '99.9% Uptime'}</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">{t.footerLinks?.quickLinks || 'Quick Links'}</h4>
              <div className="space-y-3">
                <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="block text-white/70 hover:text-[#00d084] transition-colors text-sm cursor-pointer">{t.nav.features}</a>
                <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="block text-white/70 hover:text-[#00d084] transition-colors text-sm cursor-pointer">{t.nav.pricing}</a>
                <a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="block text-white/70 hover:text-[#00d084] transition-colors text-sm cursor-pointer">{t.nav.testimonials}</a>
                <Link href="/affiliate/apply" className="block text-white/70 hover:text-[#00d084] transition-colors text-sm">{(t as any).affiliateLanding?.badge || 'Affiliate Program'}</Link>
                <Link href="/videos" className="block text-white/70 hover:text-[#00d084] transition-colors text-sm">{(t as any).videoGallery?.navLabel || 'Videos'}</Link>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">{t.footerLinks?.legal || 'Legal'}</h4>
              <div className="space-y-3">
                <Link href="/faq" className="block text-white/70 hover:text-[#00d084] transition-colors text-sm">{t.faq?.badge || 'FAQ'}</Link>
                <Link href="/privacy" className="block text-white/70 hover:text-[#00d084] transition-colors text-sm">{t.footer.privacy}</Link>
                <Link href="/terms" className="block text-white/70 hover:text-[#00d084] transition-colors text-sm">{t.footer.terms}</Link>
                <a href="mailto:contact@intellmatch.com" className="block text-white/70 hover:text-[#00d084] transition-colors text-sm">{t.footer.contact}</a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/50 text-xs">{t.footer.copyright}</p>
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <span>{t.trust?.footerPowered || 'Powered by AI'}</span>
              <span className="w-1 h-1 rounded-full bg-[#00d084]" />
              <span>{t.trust?.footerBuilt || 'Built for Professionals'}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      <VideoModal isOpen={showVideoModal} onClose={() => setShowVideoModal(false)} />
    </div>
  );
}

// ============================================================
// Team Inquiry Modal
// ============================================================
const TeamInquiryModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    companyName: '', contactName: '', email: '', phone: '', teamSize: '', message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://intellmatch.com/api/v1'}/contact/team-inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ companyName: '', contactName: '', email: '', phone: '', teamSize: '', message: '' });
      } else setSubmitStatus('error');
    } catch { setSubmitStatus('error'); }
    finally { setIsSubmitting(false); }
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-[#56657a] focus:outline-none focus:border-[#00d084]/40 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0c1222] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <Dismiss24Regular className="w-5 h-5 text-white" />
        </button>
        <div className="p-6 sm:p-8">
          {submitStatus === 'success' ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#00d084]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Checkmark24Regular className="w-8 h-8 text-[#00d084]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{t.pricing?.teamModal?.successTitle || 'Thank you!'}</h3>
              <p className="text-white/70 mb-6">{t.pricing?.teamModal?.successMessage || 'We will contact you shortly to discuss your team plan needs.'}</p>
              <button onClick={onClose} className="btn-accent px-6 py-3">{t.pricing?.teamModal?.closeButton || 'Close'}</button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-[#00d084]/10 border border-[#00d084]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <People24Regular className="w-7 h-7 text-[#00d084]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{t.pricing?.teamModal?.title || 'Get Team Plan'}</h3>
                <p className="text-white/70 text-sm">{t.pricing?.teamModal?.subtitle || 'Fill out the form and our team will contact you to discuss your needs.'}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#c4cdd8] mb-1.5">{t.pricing?.teamModal?.companyName || 'Company Name'} <span className="text-red-400">*</span></label>
                  <input type="text" required value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className={inputClass} placeholder={t.pricing?.teamModal?.companyNamePlaceholder || 'Your company name'} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#c4cdd8] mb-1.5">{t.pricing?.teamModal?.contactName || 'Your Name'} <span className="text-red-400">*</span></label>
                  <input type="text" required value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} className={inputClass} placeholder={t.pricing?.teamModal?.contactNamePlaceholder || 'Your full name'} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#c4cdd8] mb-1.5">{t.pricing?.teamModal?.email || 'Email'} <span className="text-red-400">*</span></label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder={t.pricing?.teamModal?.emailPlaceholder || 'your@email.com'} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#c4cdd8] mb-1.5">{t.pricing?.teamModal?.phone || 'Phone'} <span className="text-white/50">({t.pricing?.teamModal?.optional || 'optional'})</span></label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClass} placeholder={t.pricing?.teamModal?.phonePlaceholder || '+1 (555) 000-0000'} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#c4cdd8] mb-1.5">{t.pricing?.teamModal?.teamSize || 'Team Size'} <span className="text-red-400">*</span></label>
                  <select required value={formData.teamSize} onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })} className={`${inputClass} appearance-none cursor-pointer`}>
                    <option value="" className="bg-[#0c1222]">{t.pricing?.teamModal?.teamSizePlaceholder || 'Select team size'}</option>
                    {['3-5', '6-10', '11-25', '26-50', '51-100', '100+'].map(s => <option key={s} value={s} className="bg-[#0c1222]">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#c4cdd8] mb-1.5">{t.pricing?.teamModal?.message || 'Message'} <span className="text-white/50">({t.pricing?.teamModal?.optional || 'optional'})</span></label>
                  <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3} className={`${inputClass} resize-none`} placeholder={t.pricing?.teamModal?.messagePlaceholder || 'Tell us about your team and needs...'} />
                </div>
                {submitStatus === 'error' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-sm text-center">{t.pricing?.teamModal?.errorMessage || 'Something went wrong. Please try again.'}</p>
                  </div>
                )}
                <button type="submit" disabled={isSubmitting} className="btn-accent w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (t.pricing?.teamModal?.submitting || 'Submitting...') : (t.pricing?.teamModal?.submitButton || 'Submit Inquiry')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Pricing Section (with lighter background panel)
// ============================================================
interface PlanConfig {
  id: string;
  name: string;
  displayName: string;
  displayNameAr?: string;
  description?: string;
  descriptionAr?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  pointsAllocation: number;
  contactLimit: number;
  features?: string;
  featuresAr?: string;
  sortOrder: number;
  ctaText?: string;
  ctaTextAr?: string;
  badgeText?: string;
  badgeTextAr?: string;
  badgeColor?: string;
  borderColor?: string;
  isHighlighted?: boolean;
  animation?: string;
}

function PricingSection() {
  const { t, lang } = useI18n();
  const [isYearly, setIsYearly] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const { ref: sectionRef, visible: sectionVisible } = useRevealOnScroll();

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    fetch(`${apiUrl}/plans`)
      .then(r => r.json())
      .then(d => { if (d.success) setPlans(d.data); })
      .catch(() => {});
  }, []);

  const renderCellValue = (value: boolean | string) => {
    if (value === true) return <Checkmark24Regular className="w-5 h-5 text-[#00d084] mx-auto" />;
    if (value === false) return <span className="text-white/40">—</span>;
    return <span className="text-white/80 text-sm">{value}</span>;
  };

  return (
    <section id="pricing" className="relative py-16 md:py-28 bg-[#0d1f35]" style={{ borderTop: '1px solid rgba(0,208,132,0.1)', borderBottom: '1px solid rgba(0,208,132,0.1)' }}>
      <GridPattern opacity={0.05} />
      <SectionGlow position="center" intensity="strong" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8" ref={sectionRef}>
        {/* Header */}
        <div className={`text-center mb-8 transition-all duration-700 ${sectionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-6">
            <span className="text-[#00d084] text-sm font-medium">{t.pricing.badge}</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{t.pricing.title}</h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">{t.pricing.subtitle}</p>
        </div>

        {/* Trial Banner */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="landing-card !p-6 text-center border-[#00d084]/20">
            <h3 className="text-base font-semibold text-white mb-3">{t.pricing.trialBanner}</h3>
            <div className="flex flex-wrap justify-center gap-4 mb-3">
              {t.pricing.trialFeatures?.map((feature: string, i: number) => (
                <span key={i} className="flex items-center gap-2 text-[#c4cdd8] text-sm">
                  <Checkmark24Regular className="w-4 h-4 text-[#00d084]" />
                  {feature}
                </span>
              ))}
            </div>
            <p className="text-[#00d084] text-sm">{t.pricing.trialMessage}</p>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-white' : 'text-white/50'}`}>{t.pricing.monthly}</span>
          <button onClick={() => setIsYearly(!isYearly)} className="relative w-14 h-8 bg-white/10 rounded-full p-1 transition-colors hover:bg-white/15">
            <div className={`absolute top-1 w-6 h-6 bg-[#00d084] rounded-full transition-all duration-300 ${isYearly ? 'left-7' : 'left-1'}`} />
          </button>
          <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-white' : 'text-white/50'}`}>{t.pricing.yearly}</span>
          {isYearly && <span className="px-2 py-1 bg-[#00d084]/15 text-[#00d084] text-xs font-medium rounded-full">{t.pricing.saveBadge}</span>}
        </div>

        {/* Plan Cards - Dynamic from database */}
        <style jsx>{`
          @keyframes plan-pulse { 0%, 100% { box-shadow: 0 0 15px rgba(0,208,132,0.2); } 50% { box-shadow: 0 0 30px rgba(0,208,132,0.4); } }
          @keyframes plan-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
          @keyframes plan-glow { 0%, 100% { border-color: rgba(0,208,132,0.2); } 50% { border-color: rgba(0,208,132,0.6); } }
          .plan-pulse { animation: plan-pulse 2s ease-in-out infinite; }
          .plan-bounce { animation: plan-bounce 2s ease-in-out infinite; }
          .plan-glow { animation: plan-glow 2s ease-in-out infinite; }
          .plan-scale { transition: transform 0.3s ease; }
          .plan-scale:hover { transform: scale(1.05); }
        `}</style>
        <div className={`grid md:grid-cols-${plans.length || 2} gap-6 max-w-4xl mx-auto mb-8`}>
          {plans.map((plan) => {
            const isAr = lang === 'ar';
            const displayName = isAr && plan.displayNameAr ? plan.displayNameAr : plan.displayName;
            const description = isAr && plan.descriptionAr ? plan.descriptionAr : plan.description;
            const featuresRaw = isAr && plan.featuresAr ? plan.featuresAr : plan.features;
            let features: string[] = [];
            try { features = typeof featuresRaw === 'string' ? JSON.parse(featuresRaw) : (featuresRaw as any) || []; } catch { features = []; }
            const monthlyPrice = Number(plan.monthlyPrice);
            const yearlyPrice = Number(plan.yearlyPrice);
            const isHighlighted = plan.isHighlighted ?? false;
            const badgeText = isAr && plan.badgeTextAr ? plan.badgeTextAr : plan.badgeText;
            const badgeColor = plan.badgeColor || '#00d084';
            const borderColor = plan.borderColor;
            const animClass = plan.animation ? `plan-${plan.animation}` : '';
            const ctaText = isAr && plan.ctaTextAr ? plan.ctaTextAr : plan.ctaText;

            return (
              <div
                key={plan.id}
                className={`relative landing-card !p-6 sm:!p-8 flex flex-col ${animClass} ${isHighlighted ? 'z-10' : ''}`}
                style={{
                  borderColor: borderColor || (isHighlighted ? `${badgeColor}33` : undefined),
                  borderWidth: borderColor ? '2px' : undefined,
                }}
              >
                {badgeText && (
                  <div
                    className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: badgeColor, color: '#060b18' }}
                  >
                    {badgeText}
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white">{displayName}</h3>
                </div>
                {description && <p className="text-sm text-white/70 mb-4">{description}</p>}
                <div className="mb-6">
                  <div className="text-3xl sm:text-4xl font-bold text-white" dir="ltr">
                    <span className="inline-block">${isYearly ? yearlyPrice : monthlyPrice}</span>
                    <span className="text-base sm:text-lg text-white/50">{isYearly ? t.pricing.perYear : t.pricing.perMonth}</span>
                  </div>
                  {isYearly && yearlyPrice < monthlyPrice * 12 && (
                    <p className="text-sm text-[#00d084]">{t.pricing.saveBadge}</p>
                  )}
                </div>
                {plan.pointsAllocation > 0 && (
                  <p className="text-sm text-[#00d084] mb-4">{plan.pointsAllocation} {t.wallet?.points || 'points'} {'included'}</p>
                )}
                <ul className="space-y-2 mb-8 flex-1">
                  {features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-white/80">
                      <Checkmark24Regular className="w-4 h-4 text-[#00d084] shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={isHighlighted ? `/checkout?plan=${plan.name}&interval=${isYearly ? 'YEARLY' : 'MONTHLY'}` : '/register'}
                  className={`w-full py-3 text-center ${isHighlighted ? 'btn-accent' : 'btn-outline-accent'}`}
                >
                  {ctaText || (isHighlighted ? (t.pricing.plans.pro?.cta || 'Start Free Trial') : (t.pricing.plans.basic?.cta || 'Get Started'))}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Currency Note */}
        <p className="text-center text-xs text-white/50 mb-12">{t.pricing.currencyNote}</p>

        {/* Compare Plans */}
        <div className="text-center mb-8">
          <button onClick={() => setShowComparison(!showComparison)} className="inline-flex items-center gap-2 px-6 py-3 landing-card !p-0 px-6 py-3 text-white hover:text-[#00d084] transition-colors font-medium text-sm">
            {t.pricing.comparePlans}
            <ArrowRight24Regular className={`w-4 h-4 transition-transform ${showComparison ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Comparison Table */}
        {showComparison && (
          <div className="mb-16 overflow-x-auto">
            <div className="min-w-[640px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    {t.pricing.comparison?.headers?.map((header: string, i: number) => (
                      <th key={i} className={`py-4 px-4 text-sm font-semibold ${i === 0 ? 'text-start text-white/70' : 'text-center text-white'}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.pricing.comparison?.rows?.map((row: { feature: string; basic: boolean | string; pro: boolean | string }, i: number) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-sm text-white/80">{row.feature}</td>
                      <td className="py-3 px-4 text-center">{renderCellValue(row.basic)}</td>
                      <td className="py-3 px-4 text-center bg-[#00d084]/[0.02]">{renderCellValue(row.pro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pricing FAQ */}
        <div className="max-w-2xl mx-auto mb-16">
          <h3 className="text-2xl font-bold text-white text-center mb-8">{t.pricing.faq?.title}</h3>
          <div className="space-y-4">
            {t.pricing.faq?.items?.map((item: { question: string; answer: string }, i: number) => (
              <div key={i} className="landing-card !p-5">
                <h4 className="font-semibold text-white mb-2">{item.question}</h4>
                <p className="text-sm text-white/70">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{t.pricing.finalCta?.title}</h3>
          <p className="text-white/70 mb-8">{t.pricing.finalCta?.subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#pricing" className="btn-accent px-8 py-3">{t.pricing.finalCta?.primaryCta}</a>
            <a href="#pricing" className="btn-outline-accent px-8 py-3">{t.pricing.finalCta?.secondaryCta}</a>
          </div>
        </div>
      </div>

    </section>
  );
}

// ============================================================
// Export with I18n Provider
// ============================================================
export default function LandingPage() {
  return (
    <I18nProvider>
      <LandingPageContent />
    </I18nProvider>
  );
}
