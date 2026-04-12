/**
 * Sell Smarter Page
 *
 * Product profile form and match trigger for the Sell Smarter feature.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  Money24Regular,
  Save24Regular,
  Play24Regular,
  Edit24Regular,
  Checkmark24Regular,
  Info24Regular,
  ChevronRight24Regular,
  People24Regular,
} from '@fluentui/react-icons';
import {
  getProductProfile,
  upsertProductProfile,
  startMatchRun,
  getLatestMatchRun,
  ProductProfile,
  ProductMatchRun,
  ProductType,
  PRODUCT_TYPE_OPTIONS,
  COMPANY_SIZE_OPTIONS,
} from '@/lib/api/productMatch';
import { toast } from '@/components/ui/Toast';

export default function SellSmarterPage() {
  const { t } = useI18n();
  const router = useRouter();

  // State
  const [profile, setProfile] = useState<ProductProfile | null>(null);
  const [latestRun, setLatestRun] = useState<ProductMatchRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    productType: 'SAAS' as ProductType,
    productName: '',
    targetIndustry: '',
    targetCompanySize: 'MEDIUM',
    problemSolved: '',
    decisionMakerRole: '',
    additionalContext: '',
  });

  // Fetch profile and latest run on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profileData, runData] = await Promise.all([
        getProductProfile(),
        getLatestMatchRun(),
      ]);

      if (profileData) {
        setProfile(profileData);
        setFormData({
          productType: profileData.productType,
          productName: profileData.productName || '',
          targetIndustry: profileData.targetIndustry,
          targetCompanySize: profileData.targetCompanySize,
          problemSolved: profileData.problemSolved,
          decisionMakerRole: profileData.decisionMakerRole,
          additionalContext: profileData.additionalContext || '',
        });
      } else {
        setIsEditing(true);
      }

      setLatestRun(runData);
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate
    if (!formData.targetIndustry.trim()) {
      toast({ title: t.sellSmarter?.validation?.targetIndustryRequired || 'Target industry is required', variant: 'error' });
      return;
    }
    if (!formData.problemSolved.trim()) {
      toast({ title: t.sellSmarter?.validation?.problemSolvedRequired || 'Problem solved is required', variant: 'error' });
      return;
    }
    if (!formData.decisionMakerRole.trim()) {
      toast({ title: t.sellSmarter?.validation?.decisionMakerRoleRequired || 'Decision maker role is required', variant: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const savedProfile = await upsertProductProfile({
        productType: formData.productType,
        productName: formData.productName || undefined,
        targetIndustry: formData.targetIndustry,
        targetCompanySize: formData.targetCompanySize,
        problemSolved: formData.problemSolved,
        decisionMakerRole: formData.decisionMakerRole,
        additionalContext: formData.additionalContext || undefined,
      });

      setProfile(savedProfile);
      setIsEditing(false);
      toast({ title: t.sellSmarter?.profileSaved || 'Profile saved', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMatch = async () => {
    setIsMatching(true);
    try {
      const result = await startMatchRun();

      if (result.status === 'DONE') {
        toast({ title: t.sellSmarter?.matchingComplete || 'Matching complete', variant: 'success' });
        router.push(`/sell-smarter/results/${result.runId}`);
      } else {
        // Async processing - redirect to results to show progress
        router.push(`/sell-smarter/results/${result.runId}`);
      }
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
      setIsMatching(false);
    }
  };

  const handleViewResults = () => {
    if (latestRun) {
      router.push(`/sell-smarter/results/${latestRun.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in pb-20">
        <div className="h-8 bg-th-surface-h rounded w-48 animate-pulse" />
        <div className="h-4 bg-th-surface-h rounded w-64 animate-pulse" />
        <div className="space-y-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-th-surface border border-th-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-text flex items-center gap-2">
            <Money24Regular className="w-6 h-6 text-green-400" />
            {t.sellSmarter?.title || 'Sell Smarter'}
          </h1>
          <p className="text-sm text-th-text-t mt-1">
            {t.sellSmarter?.subtitle || 'Find the best sales leads in your network'}
          </p>
        </div>

        {profile && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-th-surface border border-th-border text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-all"
          >
            <Edit24Regular className="w-5 h-5" />
            {t.common?.edit || 'Edit'}
          </button>
        )}
      </div>

      {/* Latest Run Summary */}
      {latestRun && latestRun.status === 'DONE' && !isEditing && (
        <button
          onClick={handleViewResults}
          className="w-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 text-start hover:from-green-500/30 hover:to-emerald-500/30 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <People24Regular className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-th-text-t">{t.sellSmarter?.lastRun || 'Last Run'}</p>
                <p className="text-lg font-semibold text-th-text">
                  {latestRun.matchCount} {t.sellSmarter?.matches || 'matches'} ({t.sellSmarter?.avgScore || 'avg'}: {latestRun.avgScore}%)
                </p>
              </div>
            </div>
            <ChevronRight24Regular className="w-5 h-5 text-th-text-t" />
          </div>
        </button>
      )}

      {/* Form */}
      {(isEditing || !profile) && (
        <div className="space-y-4">
          {/* Product Type */}
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.sellSmarter?.productType || 'Product Type'}
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRODUCT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setFormData((prev) => ({ ...prev, productType: option.id }))}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    formData.productType === option.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-th-surface border-th-border text-th-text-t hover:border-white/30'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Name */}
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.sellSmarter?.productName || 'Product Name'} ({t.common?.optional || 'optional'})
            </label>
            <input
              type="text"
              value={formData.productName}
              onChange={(e) => setFormData((prev) => ({ ...prev, productName: e.target.value }))}
              placeholder={t.sellSmarter?.productNamePlaceholder || 'e.g., CloudCRM Pro'}
              className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Target Industry */}
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.sellSmarter?.targetIndustry || 'Target Industry'} *
            </label>
            <input
              type="text"
              value={formData.targetIndustry}
              onChange={(e) => setFormData((prev) => ({ ...prev, targetIndustry: e.target.value }))}
              placeholder={t.sellSmarter?.targetIndustryPlaceholder || 'e.g., Technology, SaaS, Healthcare'}
              className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
            <p className="text-xs text-th-text-m mt-1">
              {t.sellSmarter?.targetIndustryHint || 'Separate multiple industries with commas'}
            </p>
          </div>

          {/* Target Company Size */}
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.sellSmarter?.targetCompanySize || 'Target Company Size'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COMPANY_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setFormData((prev) => ({ ...prev, targetCompanySize: option.id }))}
                  className={`px-4 py-3 rounded-lg border transition-all text-start ${
                    formData.targetCompanySize === option.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-th-surface border-th-border text-th-text-t hover:border-white/30'
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-th-text-m">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Problem Solved */}
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.sellSmarter?.problemSolved || 'Problem You Solve'} *
            </label>
            <textarea
              value={formData.problemSolved}
              onChange={(e) => setFormData((prev) => ({ ...prev, problemSolved: e.target.value }))}
              placeholder={t.sellSmarter?.problemSolvedPlaceholder || 'e.g., Managing customer relationships and sales pipeline efficiently'}
              rows={3}
              className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Decision Maker Role */}
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.sellSmarter?.decisionMakerRole || 'Decision Maker Roles'} *
            </label>
            <input
              type="text"
              value={formData.decisionMakerRole}
              onChange={(e) => setFormData((prev) => ({ ...prev, decisionMakerRole: e.target.value }))}
              placeholder={t.sellSmarter?.decisionMakerRolePlaceholder || 'e.g., VP of Sales, CRO, Sales Director'}
              className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
            <p className="text-xs text-th-text-m mt-1">
              {t.sellSmarter?.decisionMakerRoleHint || 'Separate multiple roles with commas'}
            </p>
          </div>

          {/* Additional Context */}
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.sellSmarter?.additionalContext || 'Additional Context'} ({t.common?.optional || 'optional'})
            </label>
            <textarea
              value={formData.additionalContext}
              onChange={(e) => setFormData((prev) => ({ ...prev, additionalContext: e.target.value }))}
              placeholder={t.sellSmarter?.additionalContextPlaceholder || 'Any other details that might help with matching...'}
              rows={2}
              className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.common?.saving || 'Saving...'}
              </>
            ) : (
              <>
                <Save24Regular className="w-5 h-5" />
                {t.sellSmarter?.saveProfile || 'Save Profile'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Profile Summary (when not editing) */}
      {profile && !isEditing && (
        <div className="space-y-4">
          {/* Profile Summary Card */}
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <h2 className="text-lg font-semibold text-th-text mb-4">{t.sellSmarter?.yourProfile || 'Your Product Profile'}</h2>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-th-text-m">{t.sellSmarter?.productType || 'Product Type'}</span>
                <p className="text-th-text">{profile.productType}{profile.productName ? ` - ${profile.productName}` : ''}</p>
              </div>

              <div>
                <span className="text-xs text-th-text-m">{t.sellSmarter?.targetIndustry || 'Target Industry'}</span>
                <p className="text-th-text">{profile.targetIndustry}</p>
              </div>

              <div>
                <span className="text-xs text-th-text-m">{t.sellSmarter?.targetCompanySize || 'Target Company Size'}</span>
                <p className="text-th-text">{COMPANY_SIZE_OPTIONS.find(o => o.id === profile.targetCompanySize)?.label || profile.targetCompanySize}</p>
              </div>

              <div>
                <span className="text-xs text-th-text-m">{t.sellSmarter?.problemSolved || 'Problem You Solve'}</span>
                <p className="text-th-text">{profile.problemSolved}</p>
              </div>

              <div>
                <span className="text-xs text-th-text-m">{t.sellSmarter?.decisionMakerRole || 'Decision Maker Roles'}</span>
                <p className="text-th-text">{profile.decisionMakerRole}</p>
              </div>

              {profile.additionalContext && (
                <div>
                  <span className="text-xs text-th-text-m">{t.sellSmarter?.additionalContext || 'Additional Context'}</span>
                  <p className="text-th-text">{profile.additionalContext}</p>
                </div>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
            <Info24Regular className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              {t.sellSmarter?.matchingInfo || 'Click "Match My Contacts" to analyze your network and find the best sales leads based on your product profile.'}
            </div>
          </div>

          {/* Match Button */}
          <button
            onClick={handleMatch}
            disabled={isMatching}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMatching ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.sellSmarter?.matching || 'Matching...'}
              </>
            ) : (
              <>
                <Play24Regular className="w-5 h-5" />
                {t.sellSmarter?.matchContacts || 'Match My Contacts'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
