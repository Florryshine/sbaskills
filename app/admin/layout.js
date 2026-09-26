import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <AdminSidebar />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pt-20 lg:pt-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
