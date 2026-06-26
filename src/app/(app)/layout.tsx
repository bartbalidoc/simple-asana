import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionTimeoutWarning } from "@/components/layout/SessionTimeoutWarning";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { BaliDocLogo } from "@/components/brand/BaliDocLogo";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { ProjectSidebarList } from "@/components/layout/ProjectSidebarList";

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
      <FeedbackButton />
      <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <BaliDocLogo size={34} showText />
        </div>
        <nav className="p-3 space-y-1">
          <a
            href="/dashboard"
            className="block py-2 px-4 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 font-medium transition"
          >
            Dashboard
          </a>
          <a
            href="/projects"
            className="block py-2 px-4 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 font-medium transition"
          >
            Projects
          </a>
          {/* Live, clickable list of the user's projects (Asana-style left nav). */}
          <ProjectSidebarList />
          {session?.user?.role === "ADMIN" && (
            <a
              href="/projects"
              className="block py-1.5 pl-7 pr-4 text-xs text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-700 transition"
            >
              + New project
            </a>
          )}
          {session?.user?.role === "ADMIN" && (
            <>
              <div className="px-4 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                Admin
              </div>
              <a
                href="/admin/staging"
                className="block py-2 px-4 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 font-medium transition"
              >
                Staging (Asana import)
              </a>
              <a
                href="/admin/users"
                className="block py-2 px-4 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 font-medium transition"
              >
                Users
              </a>
              <a
                href="/admin/audit-log"
                className="block py-2 px-4 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 font-medium transition"
              >
                Audit Log
              </a>
              <a
                href="/admin/feedback"
                className="block py-2 px-4 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 font-medium transition"
              >
                Feedback
              </a>
            </>
          )}
        </nav>
        <div className="mt-auto p-4 border-t border-gray-100 text-[10px] text-gray-400 tracking-wide">
          YOUR HEALTH · OUR PRIORITY
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200">
          <div className="h-1 bg-gradient-to-r from-rose-500 via-red-600 to-red-700" />
          <div className="px-6 py-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-500">Project &amp; Task Hub</span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {session.user.email}
                {session.user.role === "ADMIN" && (
                  <span className="ml-2 text-[10px] font-bold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
              </span>
              <SignOutButton />
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
