'use client';

type IconVariant = 'emerald' | 'blue' | 'cyan' | 'indigo';

const ICON_VARIANT_CLASSES: Record<IconVariant, string> = {
  emerald: 'bg-emerald-500/[0.12] border-emerald-500/25 text-emerald-400',
  blue: 'bg-blue-500/[0.12] border-blue-500/25 text-blue-400',
  cyan: 'bg-cyan-400/10 border-cyan-400/25 text-cyan-400',
  indigo: 'bg-indigo-400/[0.12] border-indigo-400/25 text-indigo-400',
};

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  iconVariant?: IconVariant;
  badge?: string;
  badgeColor?: string;
  metaBadge?: string;
  countBadge?: string;
  children: React.ReactNode;
}

export function FormSection({
  title,
  description,
  icon,
  iconColor = 'text-emerald-400',
  iconVariant,
  badge,
  badgeColor = 'text-emerald-300 bg-emerald-500/20',
  metaBadge,
  countBadge,
  children,
}: FormSectionProps) {
  const iconBadgeClass = iconVariant
    ? ICON_VARIANT_CLASSES[iconVariant]
    : '';

  return (
    <div className="bg-[linear-gradient(180deg,rgba(10,30,52,0.96),rgba(8,24,42,0.98))] backdrop-blur-xl border-2 border-white/[0.12] rounded-3xl p-5 md:p-6 shadow-lg space-y-5 relative overflow-visible">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3.5">
          {icon && (
            iconVariant ? (
              <div className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center flex-shrink-0 border ${iconBadgeClass}`}>
                {icon}
              </div>
            ) : (
              <div className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center flex-shrink-0 border border-white/10 bg-white/[0.04] ${iconColor}`}>
                {icon}
              </div>
            )
          )}
          <div>
            <h2 className="text-[1.06rem] font-extrabold text-th-text tracking-tight">{title}</h2>
            {description && (
              <p className="text-[0.96rem] text-th-text-s mt-1.5 leading-relaxed font-medium">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge && (
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${badgeColor}`}>{badge}</span>
          )}
          {metaBadge && (
            <span className="inline-flex items-center min-h-[38px] px-3 py-2 rounded-full border border-white/[0.12] bg-white/[0.03] text-th-text text-[0.84rem] font-extrabold whitespace-nowrap">
              {metaBadge}
            </span>
          )}
          {countBadge && (
            <span className="inline-flex items-center min-h-[38px] px-3 py-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-100 text-[0.84rem] font-extrabold whitespace-nowrap">
              {countBadge}
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
