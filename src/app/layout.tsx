import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DesktopTitleBar } from "@/components/desktop-titlebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "APInaut",
  description: "Cliente API desktop APInaut",
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
      <body className="h-full min-h-0 flex flex-col overflow-hidden">
        <DesktopTitleBar />
        {children}
      </body>
    </html>
  );
}
