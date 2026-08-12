import AdminSidebar from '@/components/AdminSidebar';
import AdminNavbar from '@/components/AdminNavbar';

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      {/* pt-20 on mobile clears the fixed hamburger button in the top-left
          corner; lg:pt-0 removes that spacing on desktop where the sidebar
          is static (in-flow) and there's no floating button to clear. */}
      <div className="flex-1 flex flex-col overflow-y-auto pt-20 lg:pt-0">
        <AdminNavbar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
