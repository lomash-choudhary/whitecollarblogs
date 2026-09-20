import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Homeowner Marketers Blog CMS",
  description: "Write, schedule and publish blog articles to every Homeowner Marketers website from one place.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
