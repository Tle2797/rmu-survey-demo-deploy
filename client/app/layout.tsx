import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบประเมินความพึงพอใจมหาวิทยาลัยราชภัฏมหาสารคาม",
  description: "ระบบประเมินความพึงพอใจ RMU",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
