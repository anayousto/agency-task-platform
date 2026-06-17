"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock3, ListChecks, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type DashboardStats } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const stats = [
  { key: "total_tasks", label: "Total Tasks", icon: ListChecks },
  { key: "pending_tasks", label: "Pending", icon: Clock3 },
  { key: "working_tasks", label: "Working", icon: Loader2 },
  { key: "completed_tasks", label: "Completed", icon: CheckCircle2 },
  { key: "total_agencies", label: "Agencies", icon: Building2 }
] as const;

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardStats>("/dashboard")).data
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading dashboard...</p>;
  if (query.isError || !query.data) return <p className="text-sm text-destructive">Dashboard could not be loaded.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live operating view across tasks, agencies, and activity.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{query.data[item.key]}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">Recent Activity</h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          {query.data.recent_activity.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y">
              {query.data.recent_activity.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.user?.name ?? "System"}</p>
                  </div>
                  <Badge>{formatDate(item.created_at)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
