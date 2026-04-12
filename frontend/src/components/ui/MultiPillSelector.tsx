'use client';

interface PillOption {
  value: string;
  label: string;
}

interface MultiPillSelectorProps {
  options: PillOption[];
  value: string[];
  onChange: (value: string[]) => void;
  accentColor?: 'emerald' | 'blue' | 'purple' | 'amber' | 'green' | 'cyan';
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
  green: {
    active: 'bg-emerald-400 text-[#042820] border-emerald-400/80 shadow-emerald-500/10',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
  cyan: {
    active: 'bg-emerald-400 text-[#042820] border-emerald-400/80 shadow-emerald-500/10',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
};

export function MultiPillSelector({ options, value, onChange, accentColor = 'purple' }: MultiPillSelectorProps) {
  const colors = colorMap[accentColor];

  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter(v => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
            value.includes(opt.value) ? colors.active + ' shadow-sm' : colors.inactive
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
