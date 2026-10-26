import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumen — a calmer way to think with AI",
  description:
    "Lumen is a warm, focused AI thinking partner powered by Google Gemini. Ideas, code, and writing — with your history kept private.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the persisted theme before first paint to prevent flashing.
 * Uses the same storage key as the ThemeProvider (ai-chat.theme).
 */
const themeInitScript = `
try {
  var stored = localStorage.getItem("ai-chat.theme");
  var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
