import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      {/* pt-20 on mobile clears the fixed hamburger button in the top-left
          corner; lg:pt-0 removes that spacing on desktop where the sidebar
          is static (in-flow) and there's no floating button to clear. */}
      <main className="flex-1 overflow-y-auto pt-20 lg:pt-0">{children}</main>
    </div>
  );
}
