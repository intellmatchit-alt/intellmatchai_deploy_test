'use client';

interface QuickTagRowProps {
  tags: string[];
  activeTags: string[];
  onToggle: (tag: string) => void;
  accentColor?: 'emerald' | 'blue' | 'purple';
}

const tagColorMap = {
  emerald: {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    inactive: 'bg-th-surface text-th-text-m border-th-border hover:bg-th-surface-h hover:text-th-text-t',
  },
  blue: {
    active: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    inactive: 'bg-th-surface text-th-text-m border-th-border hover:bg-th-surface-h hover:text-th-text-t',
  },
  purple: {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    inactive: 'bg-th-surface text-th-text-m border-th-border hover:bg-th-surface-h hover:text-th-text-t',
  },
};

export function QuickTagRow({ tags, activeTags, onToggle, accentColor = 'emerald' }: QuickTagRowProps) {
  const colors = tagColorMap[accentColor];

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const isActive = activeTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
              isActive ? colors.active : colors.inactive
            }`}
          >
            {isActive ? '✓ ' : ''}{tag}
          </button>
        );
      })}
    </div>
  );
}
