import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/shell/AppShell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SmartPurchasing", template: "%s · SmartPurchasing" },
  description: "Count your stock, see the cheapest vendor for every item, and turn delivery invoices into up-to-date prices.",
  applicationName: "SmartPurchasing",
  appleWebApp: { capable: true, title: "SmartPurchasing", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
};

// White unless dark was picked in the menu, whatever the device's own setting is.
const themeScript =
  "(function(){try{if(localStorage.getItem('sp-theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
