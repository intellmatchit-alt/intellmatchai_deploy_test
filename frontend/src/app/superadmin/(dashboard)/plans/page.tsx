'use client';

import { useEffect, useState } from 'react';
import { getSAPlans, createSAPlan, updateSAPlan, deleteSAPlan } from '@/lib/api/superadmin';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  displayNameAr?: string;
  description?: string;
  descriptionAr?: string;
  monthlyPrice: number | string;
  yearlyPrice: number | string;
  pointsAllocation: number;
  contactLimit: number;
  features: string | string[];
  featuresAr?: string | string[];
  isFree: boolean;
  hasFreeTrial: boolean;
  freeTrialDays: number;
  paymentRequired: boolean;
  isUpgradable: boolean;
  isActive: boolean;
  subscriberCount?: number;
  sortOrder?: number;
  // Landing page display
  ctaText?: string;
  ctaTextAr?: string;
  badgeText?: string;
  badgeTextAr?: string;
  badgeColor?: string;
  borderColor?: string;
  isHighlighted?: boolean;
  animation?: string;
}

function parseFeatures(features: string | string[] | null | undefined): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features;
  try { return JSON.parse(features); } catch { return []; }
}

interface PlanForm {
  name: string;
  displayName: string;
  displayNameAr: string;
  description: string;
  descriptionAr: string;
  monthlyPrice: string;
  yearlyPrice: string;
  pointsAllocation: string;
  contactLimit: string;
  features: string;
  featuresAr: string;
  isFree: boolean;
  hasFreeTrial: boolean;
  freeTrialDays: string;
  paymentRequired: boolean;
  isUpgradable: boolean;
  isActive: boolean;
  sortOrder: string;
  // Landing page display
  ctaText: string;
  ctaTextAr: string;
  badgeText: string;
  badgeTextAr: string;
  badgeColor: string;
  borderColor: string;
  isHighlighted: boolean;
  animation: string;
}

const emptyForm: PlanForm = {
  name: '', displayName: '', displayNameAr: '', description: '', descriptionAr: '',
  monthlyPrice: '0', yearlyPrice: '0', pointsAllocation: '0', contactLimit: '100',
  features: '', featuresAr: '', isFree: false, hasFreeTrial: true, freeTrialDays: '7',
  paymentRequired: true, isUpgradable: true, isActive: true, sortOrder: '0',
  ctaText: '', ctaTextAr: '', badgeText: '', badgeTextAr: '', badgeColor: '#00d084', borderColor: '', isHighlighted: false, animation: '',
};

export default function SuperAdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await getSAPlans();
      setPlans(Array.isArray(data) ? (data as Plan[]) : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      displayName: plan.displayName || '',
      displayNameAr: plan.displayNameAr || '',
      description: plan.description || '',
      descriptionAr: plan.descriptionAr || '',
      monthlyPrice: String(plan.monthlyPrice),
      yearlyPrice: String(plan.yearlyPrice),
      pointsAllocation: String(plan.pointsAllocation),
      contactLimit: String(plan.contactLimit),
      features: parseFeatures(plan.features).join('\n'),
      featuresAr: parseFeatures(plan.featuresAr).join('\n'),
      isFree: plan.isFree ?? false,
      hasFreeTrial: plan.hasFreeTrial ?? false,
      freeTrialDays: String(plan.freeTrialDays ?? 7),
      paymentRequired: plan.paymentRequired ?? false,
      isUpgradable: plan.isUpgradable ?? true,
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder ?? 0),
      ctaText: plan.ctaText || '',
      ctaTextAr: plan.ctaTextAr || '',
      badgeText: plan.badgeText || '',
      badgeTextAr: plan.badgeTextAr || '',
      badgeColor: plan.badgeColor || '#00d084',
      borderColor: plan.borderColor || '',
      isHighlighted: plan.isHighlighted ?? false,
      animation: plan.animation || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        displayName: form.displayName,
        displayNameAr: form.displayNameAr || undefined,
        description: form.description || undefined,
        descriptionAr: form.descriptionAr || undefined,
        monthlyPrice: parseFloat(form.monthlyPrice) || 0,
        yearlyPrice: parseFloat(form.yearlyPrice) || 0,
        pointsAllocation: parseInt(form.pointsAllocation) || 0,
        contactLimit: parseInt(form.contactLimit) || 100,
        features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
        featuresAr: form.featuresAr ? form.featuresAr.split('\n').map(f => f.trim()).filter(Boolean) : undefined,
        isFree: form.isFree,
        hasFreeTrial: form.hasFreeTrial,
        freeTrialDays: parseInt(form.freeTrialDays) || 7,
        paymentRequired: form.paymentRequired,
        isUpgradable: form.isUpgradable,
        isActive: form.isActive,
        sortOrder: parseInt(form.sortOrder) || 0,
        ctaText: form.ctaText || null,
        ctaTextAr: form.ctaTextAr || null,
        badgeText: form.badgeText || null,
        badgeTextAr: form.badgeTextAr || null,
        badgeColor: form.badgeColor || null,
        borderColor: form.borderColor || null,
        isHighlighted: form.isHighlighted,
        animation: form.animation || null,
      };

      if (editingPlan) {
        await updateSAPlan(editingPlan.id, payload);
      } else {
        await createSAPlan(payload);
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditingPlan(null);
      await fetchPlans();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSAPlan(id);
      setDeleteConfirm(null);
      await fetchPlans();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete plan');
    }
  };

  const inputClass = "w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold placeholder-[#52525b] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-white font-bold">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading plans...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-white font-bold">{plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
        <button onClick={openCreate} className="bg-[#DC2626] hover:bg-[#EF4444] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Plan
        </button>
      </div>

      {error && <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-sm text-red-400 mb-4">{error}</div>}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-6 hover:border-[#DC2626]/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-white font-bold">{plan.displayName || plan.name}</h3>
                {plan.displayNameAr && <p className="text-sm text-white font-bold" dir="rtl">{plan.displayNameAr}</p>}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${plan.isActive ? 'bg-green-500 text-black' : 'bg-gray-400 text-black'}`}>
                {plan.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-1">
              {plan.isFree ? (
                <span className="text-2xl font-bold text-green-400">Free</span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-white font-bold">${plan.monthlyPrice}</span>
                  <span className="text-sm text-white font-bold">/month</span>
                </>
              )}
            </div>
            {!plan.isFree && <p className="text-sm text-white font-bold mb-2">${plan.yearlyPrice}/year</p>}

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {plan.isFree && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500 text-black border border-green-500">FREE</span>
              )}
              {plan.hasFreeTrial && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-400 text-black border border-blue-400">{plan.freeTrialDays}d TRIAL</span>
              )}
              {plan.paymentRequired && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-400 text-black border border-red-400">PAYMENT REQ</span>
              )}
              {plan.isUpgradable && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-400 text-black border border-purple-400">UPGRADABLE</span>
              )}
              {plan.isHighlighted && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-400 text-black border border-yellow-400">HIGHLIGHTED</span>
              )}
              {plan.badgeText && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-black border border-emerald-400">{plan.badgeText}</span>
              )}
              {plan.animation && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-400 text-black border border-cyan-400">{plan.animation.toUpperCase()}</span>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-3 mb-4 text-xs text-white font-bold">
              <span>{plan.pointsAllocation} pts</span>
              <span>{plan.contactLimit} contacts</span>
              <span>Order: {plan.sortOrder}</span>
            </div>

            {/* Features */}
            <div className="border-t border-[#2a2a35] pt-3 mb-4">
              <p className="text-xs text-white font-bold uppercase tracking-wider mb-2">Features</p>
              <ul className="space-y-1">
                {parseFeatures(plan.features).slice(0, 5).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white font-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-[#DC2626] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
                {parseFeatures(plan.features).length > 5 && (
                  <li className="text-xs text-white font-bold">+{parseFeatures(plan.features).length - 5} more</li>
                )}
              </ul>
            </div>

            {/* Subscriber count */}
            <div className="border-t border-[#2a2a35] pt-3 mb-4">
              <p className="text-xs text-white font-bold"><span className="text-white font-bold font-semibold">{plan.subscriberCount ?? 0}</span> active subscribers</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={() => openEdit(plan)} className="flex-1 text-xs font-medium text-white font-bold hover:text-white font-bold border border-[#2a2a35] px-3 py-2 rounded-lg hover:bg-[#0a0a0f] transition-colors text-center">
                Edit
              </button>
              {deleteConfirm === plan.id ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDelete(plan.id)} className="text-xs font-medium text-red-400 border border-red-800/50 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors">Confirm</button>
                  <button onClick={() => setDeleteConfirm(null)} className="text-xs font-medium text-white font-bold border border-[#2a2a35] px-3 py-2 rounded-lg hover:bg-[#0a0a0f] transition-colors">No</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(plan.id)} className="text-xs font-medium text-red-400 border border-red-800/50 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && !error && (
        <div className="text-center py-16 text-white font-bold">
          <p className="text-lg mb-2">No plans configured</p>
          <p className="text-sm">Create your first subscription plan to get started.</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); setEditingPlan(null); }}>
          <div className="bg-[#16161e] border border-[#2a2a35] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white font-bold mb-4">{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white font-bold mb-1">Plan Key</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} required placeholder="e.g. BASIC" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white font-bold mb-1">Sort Order</label>
                  <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white font-bold mb-1">Display Name</label>
                  <input type="text" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required placeholder="e.g. Basic" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white font-bold mb-1">Display Name (Arabic)</label>
                  <input type="text" value={form.displayNameAr} onChange={(e) => setForm({ ...form, displayNameAr: e.target.value })} placeholder="e.g. الأساسية" className={inputClass} dir="rtl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white font-bold mb-1">Description</label>
                  <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Plan description" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white font-bold mb-1">Description (Arabic)</label>
                  <input type="text" value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} placeholder="وصف الخطة" className={inputClass} dir="rtl" />
                </div>
              </div>

              {/* Pricing & Limits */}
              <div className="border-t border-[#2a2a35] pt-4">
                <p className="text-xs text-white font-bold uppercase tracking-wider mb-3">Pricing & Limits</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Monthly Price ($)</label>
                    <input type="number" step="0.01" min="0" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Yearly Price ($)</label>
                    <input type="number" step="0.01" min="0" value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Points Allocation</label>
                    <input type="number" min="0" value={form.pointsAllocation} onChange={(e) => setForm({ ...form, pointsAllocation: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Contact Limit</label>
                    <input type="number" min="0" value={form.contactLimit} onChange={(e) => setForm({ ...form, contactLimit: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Plan Controls */}
              <div className="border-t border-[#2a2a35] pt-4">
                <p className="text-xs text-white font-bold uppercase tracking-wider mb-3">Plan Controls</p>
                <div className="space-y-3">
                  {/* Free toggle */}
                  <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-4 py-3 border border-[#2a2a35]">
                    <div>
                      <p className="text-sm font-medium text-white font-bold">Free Plan</p>
                      <p className="text-xs text-white font-bold">No payment needed, user gets full access</p>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, isFree: !form.isFree, paymentRequired: form.isFree ? form.paymentRequired : false })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.isFree ? 'bg-green-600' : 'bg-[#2a2a35]'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${form.isFree ? 'left-5.5' : 'left-0.5'}`} style={{ left: form.isFree ? '22px' : '2px' }} />
                    </button>
                  </div>

                  {/* Free Trial */}
                  <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-4 py-3 border border-[#2a2a35]">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white font-bold">Free Trial</p>
                      <p className="text-xs text-white font-bold">Allow users to try before paying</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {form.hasFreeTrial && (
                        <div className="flex items-center gap-1">
                          <input type="number" min="1" max="90" value={form.freeTrialDays} onChange={(e) => setForm({ ...form, freeTrialDays: e.target.value })}
                            className="w-14 bg-[#16161e] border border-[#2a2a35] rounded px-2 py-1 text-sm text-white font-bold text-center" />
                          <span className="text-xs text-white font-bold">days</span>
                        </div>
                      )}
                      <button type="button" onClick={() => setForm({ ...form, hasFreeTrial: !form.hasFreeTrial })}
                        className={`relative w-11 h-6 rounded-full transition-colors ${form.hasFreeTrial ? 'bg-blue-600' : 'bg-[#2a2a35]'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all`} style={{ left: form.hasFreeTrial ? '22px' : '2px' }} />
                      </button>
                    </div>
                  </div>

                  {/* Payment Required */}
                  <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-4 py-3 border border-[#2a2a35]">
                    <div>
                      <p className="text-sm font-medium text-white font-bold">Payment Mandatory</p>
                      <p className="text-xs text-white font-bold">User must pay or gets locked out after trial</p>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, paymentRequired: !form.paymentRequired })}
                      disabled={form.isFree}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.paymentRequired && !form.isFree ? 'bg-red-600' : 'bg-[#2a2a35]'} ${form.isFree ? 'opacity-30 cursor-not-allowed' : ''}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all`} style={{ left: form.paymentRequired && !form.isFree ? '22px' : '2px' }} />
                    </button>
                  </div>

                  {/* Upgradable */}
                  <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-4 py-3 border border-[#2a2a35]">
                    <div>
                      <p className="text-sm font-medium text-white font-bold">Upgradable</p>
                      <p className="text-xs text-white font-bold">Users on this plan can upgrade to a higher plan</p>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, isUpgradable: !form.isUpgradable })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.isUpgradable ? 'bg-purple-600' : 'bg-[#2a2a35]'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all`} style={{ left: form.isUpgradable ? '22px' : '2px' }} />
                    </button>
                  </div>

                  {/* Active */}
                  <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-4 py-3 border border-[#2a2a35]">
                    <div>
                      <p className="text-sm font-medium text-white font-bold">Active</p>
                      <p className="text-xs text-white font-bold">Show this plan to users and on the landing page</p>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-green-600' : 'bg-[#2a2a35]'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all`} style={{ left: form.isActive ? '22px' : '2px' }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Landing Page Display */}
              <div className="border-t border-[#2a2a35] pt-4">
                <p className="text-xs text-white font-bold uppercase tracking-wider mb-3">Landing Page Display</p>

                {/* Highlighted toggle */}
                <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-4 py-3 border border-[#2a2a35] mb-3">
                  <div>
                    <p className="text-sm font-medium text-white font-bold">Highlighted Plan</p>
                    <p className="text-xs text-white font-bold">Show this plan as the featured/recommended option</p>
                  </div>
                  <button type="button" onClick={() => setForm({ ...form, isHighlighted: !form.isHighlighted })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.isHighlighted ? 'bg-yellow-600' : 'bg-[#2a2a35]'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all`} style={{ left: form.isHighlighted ? '22px' : '2px' }} />
                  </button>
                </div>

                {/* Badge */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Badge Text</label>
                    <input type="text" value={form.badgeText} onChange={(e) => setForm({ ...form, badgeText: e.target.value })} placeholder="e.g. Most Popular" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Badge Text (Arabic)</label>
                    <input type="text" value={form.badgeTextAr} onChange={(e) => setForm({ ...form, badgeTextAr: e.target.value })} placeholder="e.g. الأكثر شعبية" className={inputClass} dir="rtl" />
                  </div>
                </div>

                {/* Badge Color & Border Color */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Badge Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.badgeColor || '#00d084'} onChange={(e) => setForm({ ...form, badgeColor: e.target.value })} className="w-10 h-10 rounded border border-[#2a2a35] cursor-pointer bg-transparent" />
                      <input type="text" value={form.badgeColor} onChange={(e) => setForm({ ...form, badgeColor: e.target.value })} placeholder="#00d084" className={`${inputClass} flex-1`} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Card Border Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.borderColor || '#ffffff'} onChange={(e) => setForm({ ...form, borderColor: e.target.value })} className="w-10 h-10 rounded border border-[#2a2a35] cursor-pointer bg-transparent" />
                      <input type="text" value={form.borderColor} onChange={(e) => setForm({ ...form, borderColor: e.target.value })} placeholder="Leave empty for default" className={`${inputClass} flex-1`} />
                    </div>
                  </div>
                </div>

                {/* CTA Button Text */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">CTA Button Text</label>
                    <input type="text" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} placeholder="e.g. Start Free Trial" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">CTA Button Text (Arabic)</label>
                    <input type="text" value={form.ctaTextAr} onChange={(e) => setForm({ ...form, ctaTextAr: e.target.value })} placeholder="e.g. ابدأ تجربة مجانية" className={inputClass} dir="rtl" />
                  </div>
                </div>

                {/* Animation */}
                <div>
                  <label className="block text-sm font-medium text-white font-bold mb-1">Animation Effect</label>
                  <select value={form.animation} onChange={(e) => setForm({ ...form, animation: e.target.value })} className={inputClass}>
                    <option value="">None</option>
                    <option value="pulse">Pulse (gentle glow)</option>
                    <option value="bounce">Bounce (pumping up)</option>
                    <option value="glow">Glow (border shimmer)</option>
                    <option value="scale">Scale (hover grow)</option>
                  </select>
                </div>

                {/* Preview */}
                {(form.badgeText || form.borderColor || form.animation) && (
                  <div className="mt-3 p-3 bg-[#0a0a0f] rounded-lg border border-[#2a2a35]">
                    <p className="text-xs text-white font-bold mb-2">Preview</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {form.badgeText && (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: (form.badgeColor || '#00d084') + '20', color: form.badgeColor || '#00d084' }}>
                          {form.badgeText}
                        </span>
                      )}
                      {form.borderColor && (
                        <span className="text-xs text-white font-bold">Border: <span className="inline-block w-4 h-4 rounded align-middle" style={{ backgroundColor: form.borderColor }} /></span>
                      )}
                      {form.animation && (
                        <span className="text-xs text-cyan-400">Animation: {form.animation}</span>
                      )}
                      {form.ctaText && (
                        <span className="text-xs text-white font-bold">CTA: &quot;{form.ctaText}&quot;</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="border-t border-[#2a2a35] pt-4">
                <p className="text-xs text-white font-bold uppercase tracking-wider mb-3">Features</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Features (one per line)</label>
                    <textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={5}
                      placeholder={"Unlimited contacts\nAI matching\nPriority support"} className={`${inputClass} resize-none`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white font-bold mb-1">Features Arabic (one per line)</label>
                    <textarea value={form.featuresAr} onChange={(e) => setForm({ ...form, featuresAr: e.target.value })} rows={5}
                      placeholder={"جهات اتصال غير محدودة\nمطابقة ذكاء اصطناعي"} className={`${inputClass} resize-none`} dir="rtl" />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3 pt-2 border-t border-[#2a2a35]">
                <button type="submit" disabled={submitting} className="bg-[#DC2626] hover:bg-[#EF4444] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
                  {submitting ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setEditingPlan(null); setForm(emptyForm); }} className="text-sm text-white font-bold hover:text-white font-bold px-4 py-2 rounded-lg border border-[#2a2a35] hover:bg-[#0a0a0f] transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
