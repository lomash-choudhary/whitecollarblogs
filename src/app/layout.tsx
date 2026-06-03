import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recruitment Content Pipeline",
  description: "Next-gen content management pipeline for recruitment operations and candidate engagement.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
