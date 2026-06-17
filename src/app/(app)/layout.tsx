import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionTimeoutWarning } from "@/components/layout/SessionTimeoutWarning";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <SessionTimeoutWarning />
      <div className="flex h-screen bg-gray-100">
      {/* Sidebar placeholder */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Simple Asana</h2>
        </div>
        <nav className="p-4">
          <a href="/dashboard" className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded">
            Dashboard
          </a>
          <a href="/projects" className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded">
            Projects
          </a>
          {session?.user?.role === "ADMIN" && (
            <>
              <hr className="my-4" />
              <a href="/admin/users" className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded">
                Users
              </a>
              <a href="/admin/audit-log" className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded">
                Audit Log
              </a>
            </>
          )}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow">
          <div className="px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{session.user.email}</span>
              <a href="/api/auth/signout" className="text-sm text-blue-600 hover:text-blue-700">
                Sign Out
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
    </>
  );
}
