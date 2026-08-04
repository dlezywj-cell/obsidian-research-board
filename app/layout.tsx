import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "投资研究知识看板",
  description: "公司、行业与已处理信息卡片的公开研究看板。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
