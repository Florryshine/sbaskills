import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }) {
  return (
    <main className="min-h-screen bg-slate-50 lg:flex">
      <AdminSidebar />
      <section className="flex-1 p-4 sm:p-6 lg:p-10">{children}</section>
    </main>
  );
}
