'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  Camera24Regular,
  PersonAdd24Regular,
  ArrowUpload24Regular,
  ArrowLeft24Regular,
} from '@fluentui/react-icons';

export default function AddContactPage() {
  const { t } = useI18n();

  const options = [
    {
      href: '/scan',
      icon: <Camera24Regular className="w-8 h-8" />,
      color: 'bg-[#0077b6]',
      title: t.dashboard.scanCard || 'Scan Card',
      description: t.addContact?.scanDescription || 'Use your camera to scan a business card and automatically extract contact details',
    },
    {
      href: '/contacts/new',
      icon: <PersonAdd24Regular className="w-8 h-8" />,
      color: 'bg-[#00b4d8]',
      title: t.addContact?.manual || 'Add Manually',
      description: t.addContact?.manualDescription || 'Enter contact details by hand including name, email, phone, and more',
    },
    {
      href: '/contacts/import',
      icon: <ArrowUpload24Regular className="w-8 h-8" />,
      color: 'bg-[#52b69a]',
      title: t.addContact?.import || 'Import Contacts',
      description: t.addContact?.importDescription || 'Import multiple contacts at once from a CSV file or other sources',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-th-text">{t.dashboard.addContact || 'Add Contact'}</h1>
          <p className="text-sm text-th-text-t">{t.addContact?.subtitle || 'Choose how you want to add a new contact'}</p>
        </div>
      </div>

      <div className="space-y-3">
        {options.map((option, i) => (
          <Link key={option.href} href={option.href} className="block group">
            <div
              className="relative bg-th-surface border border-th-border rounded-xl p-5 hover:bg-th-surface-h transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg animate-slide-up-fade"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 ${option.color} rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg`}>
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-th-text group-hover:text-emerald-400 transition-colors">
                    {option.title}
                  </h3>
                  <p className="text-sm text-th-text-t mt-1 leading-relaxed">
                    {option.description}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
