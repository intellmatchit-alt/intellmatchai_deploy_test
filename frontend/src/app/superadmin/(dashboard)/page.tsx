'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSADashboard, getSAAffiliates } from '@/lib/api/superadmin';

interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  newSignups: number;
  activeSubscriptions: number;
  totalRevenue: number;
  systemHealth: string;
  collaboration?: {
    totalRequests: number;
    acceptedRequests: number;
    totalPointsCharged: number;
    totalPointsPaidOut: number;
    platformRevenue: number;
  };
}

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAffiliates, setPendingAffiliates] = useState(0);

  useEffect(() => {
    getSADashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    getSAAffiliates({ status: 'PENDING', limit: 1 })
      .then((d: any) => setPendingAffiliates(d.total || 0))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-white font-bold">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-red-400">
        <p className="font-medium">Failed to load dashboard</p>
        <p className="text-sm mt-1 text-red-400/70">{error}</p>
      </div>
    );
  }

  const stats: StatCard[] = [
    {
      label: 'Total Users',
      value: data?.totalUsers?.toLocaleString() ?? '0',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: 'Active Users (30d)',
      value: data?.activeUsers?.toLocaleString() ?? '0',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      label: 'New Signups (7d)',
      value: data?.newSignups?.toLocaleString() ?? '0',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      ),
    },
    {
      label: 'Active Subscriptions',
      value: data?.activeSubscriptions?.toLocaleString() ?? '0',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Total Revenue',
      value: `$${(data?.totalRevenue ?? 0).toLocaleString()}`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      label: 'System Health',
      value: data?.systemHealth ?? 'OK',
      color: (data?.systemHealth ?? 'OK') === 'OK' || (data?.systemHealth ?? 'healthy') === 'healthy' ? 'text-[#22c55e]' : 'text-[#eab308]',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Pending Affiliates Alert */}
      {pendingAffiliates > 0 && (
        <Link href="/superadmin/affiliates" className="block">
          <div className="bg-yellow-400/10 border-2 border-yellow-400/30 rounded-xl p-4 flex items-center justify-between hover:border-yellow-400/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold text-lg">{pendingAffiliates}</div>
              <div>
                <p className="text-white font-bold">Pending Affiliate Application{pendingAffiliates > 1 ? 's' : ''}</p>
                <p className="text-white font-bold text-sm">{pendingAffiliates} affiliate{pendingAffiliates > 1 ? 's' : ''} waiting for approval. Click to review.</p>
              </div>
            </div>
            <span className="text-yellow-400 font-bold text-sm">Review →</span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-6 hover:border-[#DC2626]/30 transition-colors group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-white font-bold group-hover:text-[#DC2626] transition-colors">
                {stat.icon}
              </div>
            </div>
            <p className={`text-3xl font-bold ${stat.color || 'text-white font-bold'}`}>{stat.value}</p>
            <p className="text-sm text-white font-bold mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Collaboration Revenue */}
      {data?.collaboration && (
        <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Collaboration Revenue</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-white/50">Total Requests</p>
              <p className="text-xl font-bold text-white">{data.collaboration.totalRequests}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Accepted</p>
              <p className="text-xl font-bold text-[#22c55e]">{data.collaboration.acceptedRequests}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Points Charged</p>
              <p className="text-xl font-bold text-white">{data.collaboration.totalPointsCharged} pts</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Paid to Collaborators</p>
              <p className="text-xl font-bold text-amber-400">{data.collaboration.totalPointsPaidOut} pts</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Platform Earnings</p>
              <p className="text-xl font-bold text-[#DC2626]">{data.collaboration.platformRevenue} pts</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
