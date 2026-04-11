import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { DashboardSidebar } from "./dashboard-sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen font-sans">
      <DashboardSidebar userEmail={user.email} />
      <div className="min-h-screen flex-1 overflow-auto bg-white dark:bg-neutral-950">{children}</div>
    </div>
  );
}
