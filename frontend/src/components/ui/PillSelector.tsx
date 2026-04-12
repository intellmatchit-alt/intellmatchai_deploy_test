'use client';

interface PillOption {
  value: string;
  label: string;
}

interface PillSelectorProps {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  accentColor?: 'emerald' | 'blue' | 'purple' | 'amber';
}

const colorMap = {
  emerald: {
    active: 'bg-emerald-400 text-[#042820] border-emerald-400/80 shadow-emerald-500/10',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
  blue: {
    active: 'bg-emerald-400 text-[#042820] border-emerald-400/80 shadow-emerald-500/10',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
  purple: {
    active: 'bg-emerald-400 text-[#042820] border-emerald-400/80 shadow-emerald-500/10',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
  amber: {
    active: 'bg-emerald-400 text-[#042820] border-emerald-400/80 shadow-emerald-500/10',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
};

export function PillSelector({ options, value, onChange, accentColor = 'purple' }: PillSelectorProps) {
  const colors = colorMap[accentColor];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
            value === opt.value ? colors.active + ' shadow-sm' : colors.inactive
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
