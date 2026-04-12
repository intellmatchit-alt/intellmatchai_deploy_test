import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IntellMatch Admin Console',
  description: 'Super Admin Dashboard',
  robots: 'noindex, nofollow',
};

export default function SuperAdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-bold">
      {children}
    </div>
  );
}
