import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { DashboardLayoutClient } from "./dashboard-layout-client";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardLayoutClient userEmail={user.email} userRole={user.role}>
      {children}
    </DashboardLayoutClient>
  );
}
