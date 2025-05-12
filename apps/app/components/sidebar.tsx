"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Lock } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r border-neutral-800">
      <SidebarHeader className="border-b border-neutral-800 p-4 items-center">
        <div className="flex items-center gap-2">
        <img src="/img/bunkercoin-icon.svg" alt="Logo" className="h-6 w-auto mr-2" />
        <h2 className="text-lg font-semibold">WebApp</h2>
        </div>
        <span className="text-xs text-neutral-700">v0.0.1</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/dashboard"}
              tooltip="Transparency Dashboard"
              className="h-10 mt-2"
            >
              <Link href="/dashboard" className="">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled
              tooltip="Staking (Coming Soon)"
              className="h-10"
            >
              <Lock className="h-4 w-4" />
              <span>Staking</span>
              <span className="ml-2 text-xs text-emerald-500">Coming Soon</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
} 