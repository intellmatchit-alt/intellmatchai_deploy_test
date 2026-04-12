'use client';

import { useState, useEffect } from 'react';
import { getDashboard, type AdminDashboard } from '@/lib/api/admin';
import { useI18n } from '@/lib/i18n';

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const statCards = [
    { label: t.admin?.totalUsers || 'Total Users', value: data.totalUsers },
    { label: t.admin?.totalPoints || 'Total Points in Circulation', value: data.totalPointsInCirculation },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-th-surface border border-th-border rounded-xl p-5">
            <div className="text-sm text-th-text-s">{stat.label}</div>
            <div className="text-3xl font-bold text-th-text mt-1">{stat.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Subscriptions by Plan */}
      <div className="bg-th-surface border border-th-border rounded-xl p-5">
        <h3 className="text-lg font-semibold text-th-text mb-4">{t.admin?.subscriptionsByPlan || 'Subscriptions by Plan'}</h3>
        <div className="space-y-3">
          {data.subscriptionsByPlan.map((item) => (
            <div key={item.plan} className="flex items-center justify-between py-2 border-b border-th-border last:border-0">
              <span className="text-th-text font-medium">{item.plan}</span>
              <span className="text-th-text-s">{item.count} {t.admin?.users || 'users'}</span>
            </div>
          ))}
          {data.subscriptionsByPlan.length === 0 && (
            <p className="text-th-text-s text-center py-4">No active subscriptions</p>
          )}
        </div>
      </div>
    </div>
  );
}
