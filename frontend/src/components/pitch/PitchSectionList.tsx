'use client';

/**
 * PNME Component: Pitch Section List
 * Left panel showing classified sections
 */

import {
  LightbulbRegular,
  TargetRegular,
  PeopleRegular,
  ChartMultipleRegular,
  RocketRegular,
  CodeRegular,
  PersonRegular,
  MoneyRegular,
  DocumentRegular,
} from '@fluentui/react-icons';

interface PitchSection {
  id: string;
  type: string;
  order: number;
  title: string;
  content: string;
  confidence: number;
  matches: any[];
}

interface PitchSectionListProps {
  sections: PitchSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const sectionIcons: Record<string, typeof LightbulbRegular> = {
  PROBLEM: LightbulbRegular,
  SOLUTION: TargetRegular,
  MARKET: ChartMultipleRegular,
  BUSINESS_MODEL: MoneyRegular,
  TRACTION: RocketRegular,
  TECHNOLOGY: CodeRegular,
  TEAM: PeopleRegular,
  INVESTMENT_ASK: MoneyRegular,
  OTHER: DocumentRegular,
};

const sectionColors: Record<string, string> = {
  PROBLEM: 'text-red-400',
  SOLUTION: 'text-green-400',
  MARKET: 'text-blue-400',
  BUSINESS_MODEL: 'text-yellow-400',
  TRACTION: 'text-emerald-400',
  TECHNOLOGY: 'text-cyan-400',
  TEAM: 'text-cyan-400',
  INVESTMENT_ASK: 'text-emerald-400',
  OTHER: 'text-dark-400',
};

export function PitchSectionList({
  sections,
  selectedId,
  onSelect,
}: PitchSectionListProps) {
  return (
    <div className="p-4">
      <h2 className="text-th-text font-medium mb-4">Sections</h2>
      <div className="space-y-2">
        {sections.map((section) => {
          const Icon = sectionIcons[section.type] || DocumentRegular;
          const colorClass = sectionColors[section.type] || 'text-dark-400';
          const isSelected = section.id === selectedId;
          const matchCount = section.matches?.length || 0;

          return (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                isSelected
                  ? 'bg-[#00d084]/50/20 border border-[#00d084]/40/30'
                  : 'bg-dark-800 hover:bg-dark-700 border border-transparent'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-[#00d084]/50/30' : 'bg-dark-700'
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? 'text-primary-400' : colorClass}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium truncate ${
                    isSelected ? 'text-th-text' : 'text-dark-200'
                  }`}
                >
                  {section.title}
                </p>
                <p className="text-dark-500 text-sm">
                  {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                </p>
              </div>
              {section.confidence >= 0.8 && (
                <div className="w-2 h-2 rounded-full bg-green-400" title="High confidence" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
