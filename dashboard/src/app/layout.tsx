import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TanStackProvider } from "@/providers/TanStackProvider";
import { AuthProvider } from "@/context/AuthContext";
import { CrmProvider } from "@/context/CrmContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Geo Timeline CRM",
  description: "Employee location timeline CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TanStackProvider>
          <AuthProvider>
            <CrmProvider>{children}</CrmProvider>
          </AuthProvider>
        </TanStackProvider>
      </body>
    </html>
  );
}
