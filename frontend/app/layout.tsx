import type { Metadata } from "next";

import "@/app/globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: "Agency Ops",
  description: "Internal agency and partner task management platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
