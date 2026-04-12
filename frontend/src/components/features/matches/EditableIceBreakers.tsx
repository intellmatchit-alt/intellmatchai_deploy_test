'use client';

import { useState } from 'react';
import { Lightbulb24Regular, Edit24Regular, Checkmark24Regular, Dismiss24Regular, Copy24Regular } from '@fluentui/react-icons';
import { toast } from '@/components/ui/Toast';

interface EditableIceBreakersProps {
  iceBreakers: string[];
  accentColor: string; // e.g. 'purple', 'green', 'pink', 'sky'
  label: string;
  onSave: (editedText: string) => Promise<void>;
}

export function EditableIceBreakers({ iceBreakers, accentColor, label, onSave }: EditableIceBreakersProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [savedIceBreakers, setSavedIceBreakers] = useState<string[] | null>(null);

  // Use saved version if available, otherwise use props
  const displayedIceBreakers = savedIceBreakers ?? iceBreakers;

  const colorMap: Record<string, { bg: string; border: string; text: string; hoverText: string }> = {
    purple: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', hoverText: 'hover:text-emerald-400' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', hoverText: 'hover:text-green-400' },
    pink: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', hoverText: 'hover:text-emerald-400' },
    sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', hoverText: 'hover:text-sky-400' },
  };

  const colors = colorMap[accentColor] || colorMap.purple;

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleStartEdit = () => {
    setEditText(displayedIceBreakers.join('\n'));
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editText);
      setSavedIceBreakers(editText.split('\n').filter(Boolean));
      setIsEditing(false);
      toast({ title: 'Ice breakers saved', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Failed to save', description: error.message, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditText('');
  };

  if (displayedIceBreakers.length === 0) return null;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-3.5`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Lightbulb24Regular className={`w-4 h-4 ${colors.text}`} />
          <span className={`text-xs font-medium ${colors.text}`}>{label}</span>
        </div>
        {!isEditing && (
          <button
            onClick={handleStartEdit}
            className={`p-1 text-th-text-m ${colors.hoverText} transition-colors`}
            title="Edit"
          >
            <Edit24Regular className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full bg-th-surface border border-th-border rounded-lg p-2.5 text-xs text-th-text-s resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
            rows={Math.max(3, displayedIceBreakers.length + 1)}
            placeholder="One ice breaker per line..."
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-th-text-t hover:bg-th-surface-h transition-colors"
            >
              <Dismiss24Regular className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${colors.text} ${colors.bg} hover:opacity-80 transition-colors disabled:opacity-50`}
            >
              <Checkmark24Regular className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedIceBreakers.slice(0, 3).map((message, idx) => (
            <div key={idx} className="group relative bg-th-surface rounded-lg p-2.5 pr-9">
              <p className="text-sm text-white font-bold">&quot;{message.trim()}&quot;</p>
              <button
                onClick={() => handleCopy(message.trim(), idx)}
                className={`absolute top-2 right-2 p-1 text-th-text-m ${colors.hoverText} transition-colors opacity-0 group-hover:opacity-100`}
              >
                {copiedIdx === idx ? (
                  <Checkmark24Regular className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy24Regular className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
