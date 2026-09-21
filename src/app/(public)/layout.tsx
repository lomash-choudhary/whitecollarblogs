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

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${playfair.variable} ${dmSans.variable} scroll-smooth dark`}
    >
      <body className="min-h-screen bg-[#070D15] text-slate-100 font-body antialiased flex flex-col relative overflow-x-hidden selection:bg-[#C9A84C]/30 selection:text-[#E5C567]">
        {/* Subtle grid pattern background */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div 
            className="absolute inset-0 opacity-[0.03]" 
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.8) 1px, transparent 0)`,
              backgroundSize: '32px 32px'
            }}
          />
        </div>


        <main className="relative z-10 flex-grow w-full flex items-center justify-center p-4 sm:p-6 md:p-8">
          {children}
        </main>

        <footer className="relative z-10 w-full py-6 text-center">
          <p className="text-[11px] text-slate-500 font-medium tracking-wide">
            © {new Date().getFullYear()} <span className="text-slate-400 font-semibold">Homeowner Marketers</span> · All rights reserved.
          </p>
        </footer>
      </body>
    </html>
  )
}

