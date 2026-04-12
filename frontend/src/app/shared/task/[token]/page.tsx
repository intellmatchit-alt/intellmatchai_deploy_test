'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Flag24Regular,
  Clock24Regular,
  Person24Regular,
  CheckmarkCircle24Regular,
} from '@fluentui/react-icons';

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'text-red-500 bg-red-500/15 border-red-500/30',
  HIGH: 'text-red-400 bg-red-400/15 border-red-400/30',
  MEDIUM: 'text-orange-400 bg-orange-400/15 border-orange-400/30',
  LOW: 'text-green-400 bg-green-400/15 border-green-400/30',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-white/60 bg-gray-400/15 border-gray-400/30',
  IN_PROGRESS: 'text-blue-400 bg-blue-400/15 border-blue-400/30',
  COMPLETED: 'text-green-400 bg-green-400/15 border-green-400/30',
  CANCELLED: 'text-red-400/60 bg-red-400/10 border-red-400/20',
};

interface SharedTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
  sharedBy?: { fullName: string } | null;
}

export default function SharedTaskPage() {
  const params = useParams();
  const token = params.token as string;
  const [task, setTask] = useState<SharedTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchTask = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
        const res = await fetch(`${apiUrl}/tasks/shared/${token}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        setTask(data.data || data);
      } catch (e) {
        console.error('Failed to fetch shared task', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [token]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">404</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Task Not Found</h1>
          <p className="text-white/60 text-sm">
            This shared task link may have expired or been revoked.
          </p>
        </div>
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-600">Powered by IntellMatch</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Shared by header */}
        {task.sharedBy && (
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {task.sharedBy.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs text-white/60">Shared by</p>
              <p className="text-sm font-medium text-white">{task.sharedBy.fullName}</p>
            </div>
          </div>
        )}

        {/* Task Card */}
        <div className="rounded-2xl border border-gray-800 bg-[#12121a] p-6 space-y-5 shadow-2xl">
          {/* Title */}
          <h1 className="text-xl font-bold text-white">{task.title}</h1>

          {/* Status & Priority */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-lg border inline-flex items-center gap-1 ${STATUS_COLORS[task.status] || 'text-white/60 bg-gray-400/15 border-gray-400/30'}`}>
              <CheckmarkCircle24Regular className="w-3.5 h-3.5" />
              {task.status.replace('_', ' ')}
            </span>
            <span className={`px-2.5 py-1 text-xs font-medium rounded-lg border inline-flex items-center gap-1 ${PRIORITY_COLORS[task.priority] || 'text-white/60 bg-gray-400/15 border-gray-400/30'}`}>
              <Flag24Regular className="w-3.5 h-3.5" />
              {task.priority}
            </span>
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-300 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Due Date */}
          {task.dueDate && (
            <div className="flex items-center gap-2 text-sm">
              <Clock24Regular className="w-4 h-4 text-white/50" />
              <span className="text-white/60">Due:</span>
              <span className="text-white">{formatDate(task.dueDate)}</span>
            </div>
          )}

          {/* Created */}
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-800">
            <span className="text-white/50 text-xs">
              Created {formatDate(task.createdAt)}
            </span>
          </div>
        </div>

        {/* Branding */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-600">
            Powered by{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-medium">
              IntellMatch
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
