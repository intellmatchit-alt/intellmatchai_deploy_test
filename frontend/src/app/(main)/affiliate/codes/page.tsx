'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { getAffiliateCodes, createAffiliateCode, updateAffiliateCodeStatus, getMyAffiliate } from '@/lib/api/affiliate';
import {
  Add24Regular,
  Copy24Regular,
  Pause24Regular,
  Play24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';

export default function AffiliateCodesPage() {
  const { t } = useI18n();
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [codeName, setCodeName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [discount, setDiscount] = useState(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'REF-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setNewCode(code);
  };
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);

  const loadCodes = () => {
    setLoading(true);
    Promise.all([getAffiliateCodes(), getMyAffiliate()]).then(([codesRes, affRes]) => {
      setCodes(codesRes || []);
      setSettings(affRes?.settings);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadCodes(); }, []);

  const handleCreate = async () => {
    if (!newCode.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createAffiliateCode(newCode.trim(), discount, codeName.trim() || undefined);
      setShowCreate(false);
      setNewCode('');
      setCodeName('');
      setDiscount(settings?.minDiscountPercentage || 5);
      loadCodes();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create code');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateAffiliateCodeStatus(id, newStatus);
      loadCodes();
    } catch {}
  };

  const copyLink = (code: string, id: string) => {
    const link = `${window.location.origin}/register?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Create Button */}
      <button
        onClick={() => { setShowCreate(true); setDiscount(settings?.minDiscountPercentage || 5); }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-emerald-400/30 text-white font-bold hover:bg-teal-500/10 transition-colors"
      >
        <Add24Regular className="w-5 h-5" />
        <span className="font-medium">Create New Code</span>
      </button>

      {/* Create Modal */}
      {showCreate && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h3 className="font-bold text-white text-lg">Create Referral Code</h3>
          <div>
            <label className="text-sm text-white font-bold mb-1 block">Code Name</label>
            <input
              value={codeName}
              onChange={(e) => setCodeName(e.target.value)}
              placeholder="e.g. Summer Campaign, YouTube Promo"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white font-bold focus:border-emerald-400/50 focus:outline-none"
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-sm text-white font-bold mb-1 block">Code</label>
            <div className="flex gap-2">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                placeholder="e.g. MYCODE20"
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white font-bold focus:border-emerald-400/50 focus:outline-none font-mono"
                maxLength={30}
              />
              <button type="button" onClick={generateCode} className="px-4 py-2.5 rounded-xl bg-emerald-400 text-[#042820] font-bold text-sm hover:bg-emerald-500 transition-colors whitespace-nowrap">
                Generate
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-white font-bold mb-1 block">
              Discount: {discount}% (Range: {settings?.minDiscountPercentage || 5}% - {settings?.maxDiscountPercentage || 15}%)
            </label>
            <input
              type="range"
              min={settings?.minDiscountPercentage || 5}
              max={settings?.maxDiscountPercentage || 15}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-xs text-white font-bold mt-1">
              <span>Your commission: {(settings?.commissionPercentage || 20) - discount}%</span>
              <span>Customer discount: {discount}%</span>
            </div>
          </div>
          {error && (
            <div className="bg-red-400/10 border border-red-400/30 rounded-xl p-3">
              <p className="text-sm text-white font-bold">{error}</p>
              {error.toLowerCase().includes('already taken') && (
                <button type="button" onClick={generateCode} className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-400 text-[#042820] font-bold text-xs hover:bg-emerald-500 transition-colors">
                  Generate a unique code instead
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5">Cancel</button>
            <button onClick={handleCreate} disabled={creating || !newCode.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-400 text-[#042820] font-bold font-medium disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Codes List */}
      {codes.length === 0 ? (
        <div className="text-center py-12 text-white font-bold">
          <p className="text-lg mb-1">No codes yet</p>
          <p className="text-sm">Create your first referral code to start earning</p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((code: any) => (
            <div key={code.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col gap-1">
                  {code.name && <span className="text-sm font-bold text-white">{code.name}</span>}
                  <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white text-lg">{code.code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    code.status === 'ACTIVE' ? 'bg-green-500 text-black font-bold' : 'bg-yellow-400 text-black font-bold'
                  }`}>{code.status}</span>
                </div></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyLink(code.code, code.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-400 text-[#042820] font-bold text-xs hover:bg-emerald-500 transition-colors">
                    {copiedId === code.id ? <><Checkmark24Regular className="w-4 h-4" />Copied!</> : <><Copy24Regular className="w-4 h-4" />Copy Link</>}
                  </button>
                  <button onClick={() => handleToggleStatus(code.id, code.status)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-colors ${code.status === 'ACTIVE' ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-green-500 text-black hover:bg-green-600'}`}>
                    {code.status === 'ACTIVE' ? <><Pause24Regular className="w-4 h-4" />Pause</> : <><Play24Regular className="w-4 h-4" />Resume</>}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg py-2">
                  <p className="text-xs text-white font-bold">Discount</p>
                  <p className="text-sm font-medium text-white">{Number(code.discountPercent)}%</p>
                </div>
                <div className="bg-white/5 rounded-lg py-2">
                  <p className="text-xs text-white font-bold">Commission</p>
                  <p className="text-sm font-medium text-white font-bold">{code.commissionPercent}%</p>
                </div>
                <div className="bg-white/5 rounded-lg py-2">
                  <p className="text-xs text-white font-bold">Uses</p>
                  <p className="text-sm font-medium text-white">{code.usageCount || code._count?.referrals || 0}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
