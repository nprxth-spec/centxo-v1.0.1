"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Rocket,
  Settings,
  Megaphone,
  Building2,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create-ads", label: "Create Ads", icon: Rocket },
  { href: "/campaigns", label: "All Campaigns", icon: Megaphone },
  { href: "/accounts", label: "Ad Accounts", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  // Strip locale prefix for comparison
  const pathnameWithoutLocale = pathname.replace(/^\/(en|th)/, '') || '/';

  return (
    <SidebarMenu>
      {links.map((link) => (
        <SidebarMenuItem key={link.href}>
          <SidebarMenuButton
            asChild
            isActive={
              link.href === "/dashboard"
                ? pathnameWithoutLocale === link.href
                : pathnameWithoutLocale.startsWith(link.href)
            }
            tooltip={link.label}
          >
            <Link href={link.href}>
              <link.icon />
              <span>{link.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
