/**
 * Consent Screen
 *
 * Privacy consent screen shown before importing contacts.
 * Explains what data is collected and provides opt-in toggles.
 *
 * @module components/import/ConsentScreen
 */

'use client';

import { useState } from 'react';
import {
  Shield24Regular,
  Person24Regular,
  Mail24Regular,
  Phone24Regular,
  Building24Regular,
  Briefcase24Regular,
  Sparkle24Regular,
  Database24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n';
import type { ImportSource } from './ImportMethodSelector';

interface ConsentScreenProps {
  method: ImportSource;
  onConsent: (options: { enrichment: boolean; aiSummary: boolean; phoneEnrichment: boolean }) => void;
  onBack: () => void;
}

export default function ConsentScreen({ method, onConsent, onBack }: ConsentScreenProps) {
  const { t } = useI18n();
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const dataCollected = [
    { icon: Person24Regular, label: t.import?.consent?.data?.name || 'Full Name' },
    { icon: Mail24Regular, label: t.import?.consent?.data?.email || 'Email Addresses' },
    { icon: Phone24Regular, label: t.import?.consent?.data?.phone || 'Phone Numbers' },
    { icon: Building24Regular, label: t.import?.consent?.data?.company || 'Company Name' },
    { icon: Briefcase24Regular, label: t.import?.consent?.data?.title || 'Job Title' },
  ];

  const handleContinue = () => {
    if (privacyAccepted) {
      onConsent({ enrichment: true, aiSummary: true, phoneEnrichment: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Privacy Badge */}
      <div className="flex items-center gap-3 p-4 bg-accent-blue/10 rounded-xl border border-accent-blue/20">
        <Shield24Regular className="w-6 h-6 text-accent-blue" />
        <div>
          <h3 className="font-medium text-th-text">
            {t.import?.consent?.privacyFirst || 'Privacy First'}
          </h3>
          <p className="text-sm text-dark-300">
            {t.import?.consent?.privacyDescription || 'Your contact data stays private and secure'}
          </p>
        </div>
      </div>

      {/* Data Collected Section */}
      <div>
        <h3 className="text-sm font-medium text-dark-300 uppercase tracking-wide mb-3">
          {t.import?.consent?.dataCollected || 'Data We Import'}
        </h3>
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
          <div className="grid grid-cols-2 gap-3">
            {dataCollected.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-dark-400" />
                  <span className="text-sm text-th-text">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* What We Don't Collect */}
      <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
        <p className="text-sm text-dark-300">
          <span className="text-accent-green font-medium">
            {t.import?.consent?.neverCollect || "We never access:"}
          </span>{' '}
          {t.import?.consent?.neverCollectList || 'message content, call logs, photos, or any data outside your contacts.'}
        </p>
      </div>

      {/* Included Features (All Mandatory) */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-dark-300 uppercase tracking-wide">
          {t.import?.consent?.includedFeatures || 'Included With Import'}
        </h3>

        {/* Enrichment */}
        <div className="flex items-start gap-4 p-4 bg-dark-800 rounded-xl border border-emerald-500/30">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Database24Regular className="w-5 h-5 text-emerald-500" />
              <span className="font-medium text-th-text">
                {t.import?.consent?.enrichment?.title || 'Profile Enrichment'}
              </span>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
                Auto
              </span>
            </div>
            <p className="text-sm text-dark-400 mt-1">
              {t.import?.consent?.enrichment?.description || 'Automatically discover company details, job titles, sectors, and skills for better matching.'}
            </p>
          </div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20">
            <Checkmark24Regular className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        {/* AI Summary */}
        <div className="flex items-start gap-4 p-4 bg-dark-800 rounded-xl border border-accent-yellow/30">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkle24Regular className="w-5 h-5 text-accent-yellow" />
              <span className="font-medium text-th-text">
                {t.import?.consent?.aiSummary?.title || 'AI Summaries & Tags'}
              </span>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent-yellow/20 text-accent-yellow">
                Auto
              </span>
            </div>
            <p className="text-sm text-dark-400 mt-1">
              {t.import?.consent?.aiSummary?.description || 'Generate intelligent profile summaries and extract sectors, skills, and interests using AI.'}
            </p>
          </div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-yellow/20">
            <Checkmark24Regular className="w-4 h-4 text-accent-yellow" />
          </div>
        </div>

        {/* Phone Enrichment */}
        <div className="flex items-start gap-4 p-4 bg-dark-800 rounded-xl border border-accent-green/30">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Phone24Regular className="w-5 h-5 text-accent-green" />
              <span className="font-medium text-th-text">
                {t.import?.consent?.phoneEnrichment?.title || 'Phone Lookup'}
              </span>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green">
                Auto
              </span>
            </div>
            <p className="text-sm text-dark-400 mt-1">
              {t.import?.consent?.phoneEnrichment?.description || 'Look up real names and locations from phone numbers.'}
            </p>
            <div className="mt-2 p-2 bg-accent-green/10 rounded-lg border border-accent-green/20">
              <p className="text-xs text-accent-green font-medium">
                {t.import?.consent?.sdaiaNotice || 'SDAIA PDPL Compliant'}
              </p>
              <p className="text-xs text-dark-400 mt-0.5">
                {(t.import?.consent?.sdaiaDescription || 'Processing complies with Saudi Personal Data Protection Law. Data retained for {days} days.').replace('{days}', '365')}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-green/20">
            <Checkmark24Regular className="w-4 h-4 text-accent-green" />
          </div>
        </div>
      </div>

      {/* Privacy Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.target.checked)}
            className="sr-only"
          />
          <div className={`
            w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
            ${privacyAccepted
              ? 'bg-accent-blue border-accent-blue'
              : 'bg-transparent border-dark-500'
            }
          `}>
            {privacyAccepted && (
              <Checkmark24Regular className="w-3 h-3 text-th-text" />
            )}
          </div>
        </div>
        <span className="text-sm text-dark-300">
          {t.import?.consent?.agreement || 'I understand and agree that my contact data will be processed according to the'}{' '}
          <a href="/privacy" target="_blank" className="text-accent-blue hover:underline">
            {t.import?.consent?.privacyPolicy || 'Privacy Policy'}
          </a>
        </span>
      </label>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 bg-dark-700 text-th-text rounded-lg hover:bg-dark-600 transition-colors"
        >
          {t.common?.back || 'Back'}
        </button>
        <button
          onClick={handleContinue}
          disabled={!privacyAccepted}
          className={`
            flex-1 px-4 py-3 rounded-lg font-medium transition-colors
            ${privacyAccepted
              ? 'bg-accent-blue text-th-text hover:bg-accent-blue/90'
              : 'bg-dark-600 text-dark-400 cursor-not-allowed'
            }
          `}
        >
          {t.import?.consent?.continue || 'Continue'}
        </button>
      </div>
    </div>
  );
}
