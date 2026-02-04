import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import ClientLayout from "@/components/client-layout";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const defaultCollapsed = cookieStore.get("sidebar:state")?.value === "true";

  return <ClientLayout defaultCollapsed={defaultCollapsed}>{children}</ClientLayout>;
}
