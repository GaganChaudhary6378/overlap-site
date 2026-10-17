import type { Metadata } from "next";
import { EB_Garamond, IM_Fell_English, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fell = IM_Fell_English({
  variable: "--font-fell",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Overlap — one line, one agent",
  description:
    "A live room where every teammate's coding agents (Claude Code, Codex, Cursor) show what they are editing, and warn each other before they collide.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fell.variable} ${garamond.variable} ${inter.variable} ${jetbrains.variable} antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
