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
    active: 'bg-[#3b82f633] text-[#93c5fd] border-blue-500/50',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
  blue: {
    active: 'bg-[#3b82f633] text-[#93c5fd] border-blue-500/50',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
  purple: {
    active: 'bg-[#3b82f633] text-[#93c5fd] border-blue-500/50',
    inactive: 'bg-th-surface text-th-text border-th-border hover:bg-white/[0.12]',
  },
  amber: {
    active: 'bg-[#3b82f633] text-[#93c5fd] border-blue-500/50',
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
            value === opt.value ? colors.active : colors.inactive
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
