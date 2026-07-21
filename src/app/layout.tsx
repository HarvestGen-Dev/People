import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HarvestGen People",
    template: "%s | HarvestGen People",
  },
  description:
    "The people and relationship platform for Harvest Generation Church—profiles, smart lists, workflows, events, and connected church systems.",
};

export const viewport: Viewport = {
  themeColor: "#064e3b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
