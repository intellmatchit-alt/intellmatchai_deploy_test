import { api } from './client';

export function getAffiliateTerms() {
  return api.get<{ termsContent: string; policyContent: string; enabled: boolean }>('/affiliate/terms');
}

export function validateAffiliateCode(code: string) {
  return api.get<{ valid: boolean; code?: string; discountPercent?: number }>(`/affiliate/validate/${code}`);
}

export function applyAsAffiliate() {
  return api.post<any>('/affiliate/apply');
}

export function getMyAffiliate() {
  return api.get<any>('/affiliate/me');
}

export function createAffiliateCode(code: string, discountPercent: number, name?: string) {
  return api.post<any>('/affiliate/codes', { code, discountPercent, name });
}

export function getAffiliateCodes() {
  return api.get<any[]>('/affiliate/codes');
}

export function updateAffiliateCodeStatus(id: string, status: 'ACTIVE' | 'PAUSED') {
  return api.patch<any>(`/affiliate/codes/${id}/status`, { status });
}

export function getAffiliateReferrals(params?: { codeId?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.codeId) query.set('codeId', params.codeId);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return api.get<any>(`/affiliate/referrals${qs ? '?' + qs : ''}`);
}

export function getAffiliateStats() {
  return api.get<any>('/affiliate/stats');
}

export function getAffiliatePayouts(page?: number) {
  return api.get<any>(`/affiliate/payouts${page ? '?page=' + page : ''}`);
}

export function requestAffiliatePayout() {
  return api.post<any>('/affiliate/payouts');
}
