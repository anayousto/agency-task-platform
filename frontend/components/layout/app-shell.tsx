"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BriefcaseBusiness, Building2, CheckSquare, LayoutDashboard, LogOut, Moon, Sun, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, type Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const baseNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare }
];

const adminNav = [
  { href: "/agencies", label: "Agencies", icon: Building2 },
  { href: "/users", label: "Users", icon: Users }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const nav = useMemo(() => (user?.role === "admin" ? [...baseNav, ...adminNav] : baseNav), [user?.role]);

  const notifications = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => (await api.get<Notification[]>("/notifications?unread_only=true")).data,
    enabled: Boolean(user),
    refetchInterval: 30_000
  });

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Agency Ops</p>
            <p className="text-xs text-muted-foreground">Internal platform</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-secondary text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{user.role.replace("_", " ")}</p>
            </div>
            <nav className="flex gap-1 lg:hidden">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="rounded-md p-2 hover:bg-muted" title={item.label}>
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              <div className="relative rounded-md p-2" title="Unread notifications">
                <Bell className="h-4 w-4" />
                {(notifications.data?.length ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1 text-center text-xs font-semibold text-accent-foreground">
                    {notifications.data?.length}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDark((value) => !value)} title="Toggle theme">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
