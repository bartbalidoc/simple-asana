import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionTimeoutWarning } from "@/components/layout/SessionTimeoutWarning";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { AppShell } from "@/components/layout/AppShell";

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
      <AppShell
        isAdmin={session.user.role === "ADMIN"}
        email={session.user.email || ""}
      >
        {children}
      </AppShell>
    </>
  );
}
