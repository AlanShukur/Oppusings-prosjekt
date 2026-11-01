import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Romly – ditt oppussingsprosjekt",
  description: "Planlegg oppussingen, lagre dine prosjekter og samle plantegninger og bilder på ett sted.",
  icons: {
    icon: "/studio/favicon.svg",
    shortcut: "/studio/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb">
      <body className="antialiased">{children}</body>
    </html>
  );
}
