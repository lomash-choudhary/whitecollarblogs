import React from 'react'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import '../globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

/**
 * Login is the only public page. It used to sit inside the old marketing
 * chrome — a nav bar, a five-link footer and a company blurb, all of it for a
 * website this app no longer serves — so removing the `/resources` blog on
 * 2026-09-20 left that shell wrapping a single password box. What a signed-out
 * visitor needs is the form and the brand, so that is all this is.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // `data-scroll-behavior` is what makes Next turn the smooth scrolling in
    // `globals.css` off for the length of a route change. Without it a
    // navigation animates its way back to the top instead of arriving there,
    // and Next 16 warns in the console rather than assuming.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${playfair.variable} ${dmSans.variable} scroll-smooth`}
    >
      <body className="min-h-screen bg-[#F5F0E8] text-[#0D1B2A] font-body antialiased flex flex-col">
        <main className="flex-grow w-full flex items-center justify-center">
          {children}
        </main>

        <footer className="w-full py-6 text-center">
          <p className="text-[11px] text-[#0D1B2A]/35 font-semibold">
            © {new Date().getFullYear()} Homeowner Marketers. All rights reserved.
          </p>
        </footer>
      </body>
    </html>
  )
}
