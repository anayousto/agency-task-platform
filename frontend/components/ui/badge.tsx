import * as React from "react";

import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  working: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  need_information: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
};

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        tone ? tones[tone] ?? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
