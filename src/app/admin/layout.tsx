import React from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import AdminAuthGuard from '@/components/AdminAuthGuard';
import GuestModeBanner from '@/components/GuestModeBanner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
        <GuestModeBanner />
        <AdminSidebar />
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </AdminAuthGuard>
  );
}
