import React from 'react'
import Link from 'next/link'
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
    <html lang="en" className={`${playfair.variable} ${dmSans.variable} scroll-smooth`}>
      <body className="min-h-full bg-[#F5F0E8] text-[#0D1B2A] font-body antialiased flex flex-col">

        {/* ── Navigation ── */}
        <nav className="sticky top-0 z-50 bg-[#0d1b2a] border-b border-[#C9A84C]/20">
          <div className="max-w-[1280px] mx-auto px-[clamp(1.25rem,4vw,2.5rem)]">
            <div className="flex justify-between items-center h-[72px]">

              {/* Logo */}
              <Link
                className="flex flex-col leading-tight group"
                href="https://website-ten-sigma-61.vercel.app/"
                aria-label="White Collar Advice — home"
              >
                <span className="font-headline text-[22px] font-bold tracking-tight text-white group-hover:text-[#C9A84C] transition-colors duration-300">
                  White Collar Advice
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[4px] text-[#C9A84C]/70 mt-0.5">
                  Est. 2008
                </span>
              </Link>

              {/* Desktop Nav Links */}
              <div className="hidden lg:flex items-center gap-8">
                {[
                  { label: 'The Work', href: 'https://website-ten-sigma-61.vercel.app/#the-work' },
                  { label: 'The Record', href: 'https://website-ten-sigma-61.vercel.app/#the-record' },
                  { label: 'Tools', href: 'https://website-ten-sigma-61.vercel.app/#tools' },
                  { label: 'The Archive', href: '/blogs' },
                  { label: 'Prison Professors', href: 'https://website-ten-sigma-61.vercel.app/#prison-professors' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="relative text-[11px] font-bold uppercase tracking-widest text-white/80 hover:text-[#C9A84C] transition-colors duration-300 nav-link py-1"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              {/* Desktop CTA */}
              <Link
                href="https://website-ten-sigma-61.vercel.app/"
                className="hidden lg:inline-flex items-center bg-[#C9A84C] text-[#0D1B2A] font-bold px-8 py-3.5 text-[11px] uppercase tracking-widest hover:brightness-105 transition-all duration-300 border border-[#C9A84C] hover:border-[#B29135] rounded-xl shadow-md hover:scale-[1.02]"
              >
                Book Strategy Session
              </Link>

              {/* Mobile Hamburger */}
              <MobileMenuButton />
            </div>
          </div>

          {/* Mobile Menu */}
          <div id="mobile-menu" className="lg:hidden bg-[#0d1b2a] border-t border-white/5 overflow-hidden transition-all duration-300 max-h-0 opacity-0">
            <div className="px-[clamp(1.25rem,4vw,2.5rem)] py-6 flex flex-col gap-0">
              {[
                { label: 'The Work', href: 'https://website-ten-sigma-61.vercel.app/#the-work' },
                { label: 'The Record', href: 'https://website-ten-sigma-61.vercel.app/#the-record' },
                { label: 'Tools', href: 'https://website-ten-sigma-61.vercel.app/#tools' },
                { label: 'The Archive', href: '/blogs' },
                { label: 'Prison Professors', href: 'https://website-ten-sigma-61.vercel.app/#prison-professors' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[11px] font-bold uppercase tracking-widest text-white/80 hover:text-[#C9A84C] transition-colors duration-200 py-4 border-b border-white/5"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="https://website-ten-sigma-61.vercel.app/"
                className="mt-6 inline-flex justify-center bg-[#C9A84C] text-[#0D1B2A] font-bold px-8 py-4 text-[11px] uppercase tracking-widest hover:brightness-105 transition-all duration-300 rounded-xl shadow-md"
              >
                Book Strategy Session
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Main Content ── */}
        <main className="flex-grow w-full">
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="bg-[#0D1B2A] text-white/60">
          <div className="max-w-[1280px] mx-auto px-[clamp(1.25rem,4vw,2.5rem)] pt-16 pb-8">
            {/* Top grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-12 border-b border-white/[0.08]">

              {/* Brand column */}
              <div className="space-y-6 lg:col-span-1">
                <div>
                  <p className="font-headline text-[26px] font-bold text-white tracking-tight uppercase leading-tight">
                    White Collar Advice
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-[4px] text-[#C9A84C]/70 mt-1">
                    Est. 2008
                  </p>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  Building records that change outcomes. Est. 2008.
                </p>
                {/* Social Icons */}
                <div className="flex items-center gap-3">
                  {/* YouTube */}
                  <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-all duration-200">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </a>
                  {/* LinkedIn */}
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-all duration-200">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                  {/* Instagram */}
                  <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-all duration-200">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                  </a>
                  {/* TikTok */}
                  <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-all duration-200">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                  </a>
                  {/* X / Twitter */}
                  <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-all duration-200">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                </div>
              </div>

              {/* Resources */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[4px] text-[#C9A84C] mb-6">Resources</h4>
                <ul className="space-y-3">
                  {[
                    { label: 'The Playbook', href: 'https://website-ten-sigma-61.vercel.app/' },
                    { label: 'Video Library', href: 'https://website-ten-sigma-61.vercel.app/' },
                    { label: 'BOP Directory', href: 'https://website-ten-sigma-61.vercel.app/' },
                    { label: 'Blog', href: '/blogs' },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-white/50 hover:text-white transition-colors duration-200">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[4px] text-[#C9A84C] mb-6">Company</h4>
                <ul className="space-y-3">
                  {[
                    { label: 'About Justin', href: 'https://website-ten-sigma-61.vercel.app/' },
                    { label: 'Prison Professors', href: 'https://website-ten-sigma-61.vercel.app/' },
                    { label: 'Media Kit', href: 'https://website-ten-sigma-61.vercel.app/' },
                    { label: 'Contact', href: 'https://website-ten-sigma-61.vercel.app/' },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-white/50 hover:text-white transition-colors duration-200">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[4px] text-[#C9A84C] mb-6">Legal</h4>
                <ul className="space-y-3">
                  {[
                    { label: 'Privacy Policy', href: 'https://website-ten-sigma-61.vercel.app/' },
                    { label: 'Terms of Service', href: 'https://website-ten-sigma-61.vercel.app/' },
                    { label: 'Disclaimer', href: 'https://website-ten-sigma-61.vercel.app/' },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-white/50 hover:text-white transition-colors duration-200">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[12px] text-white/30">
                © {new Date().getFullYear()} White Collar Advice. All rights reserved.
              </p>
              <p className="text-[11px] text-white/25">
                Call or text: <a href="tel:9497993277" className="text-[#C9A84C]/60 hover:text-[#C9A84C] transition-colors">949-799-3277</a>
              </p>
            </div>
          </div>
        </footer>

        {/* Mobile menu toggle script */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var btn = document.querySelector('[data-mobile-toggle]');
              var menu = document.getElementById('mobile-menu');
              var bars = document.querySelectorAll('[data-bar]');
              if (btn && menu) {
                btn.addEventListener('click', function() {
                  var open = menu.style.maxHeight && menu.style.maxHeight !== '0px';
                  if (open) {
                    menu.style.maxHeight = '0px';
                    menu.style.opacity = '0';
                    bars[0].style.transform = '';
                    bars[1].style.opacity = '1';
                    bars[2].style.transform = '';
                  } else {
                    menu.style.maxHeight = '400px';
                    menu.style.opacity = '1';
                    bars[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                    bars[1].style.opacity = '0';
                    bars[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
                  }
                });
              }
            })();
          `
        }} />
      </body>
    </html>
  )
}

function MobileMenuButton() {
  return (
    <button
      data-mobile-toggle
      className="lg:hidden flex flex-col justify-center items-center w-10 h-10 gap-[6px] group"
      aria-label="Open menu"
    >
      <span data-bar className="block w-6 h-[1.5px] bg-white transition-all duration-300 origin-center"></span>
      <span data-bar className="block w-6 h-[1.5px] bg-white transition-all duration-300"></span>
      <span data-bar className="block w-6 h-[1.5px] bg-white transition-all duration-300 origin-center"></span>
    </button>
  )
}
