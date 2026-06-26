import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionTimeoutWarning } from "@/components/layout/SessionTimeoutWarning";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { BaliDocLogo } from "@/components/brand/BaliDocLogo";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { SidebarNav } from "@/components/layout/SidebarNav";

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
        <SidebarNav isAdmin={session?.user?.role === "ADMIN"} />
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
