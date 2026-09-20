import { redirect } from 'next/navigation'

export default function RootRedirect() {
  // This app is a CMS and nothing else. The public `/resources` blog it used to
  // serve was removed on 2026-09-20, so the root has no reader-facing page to
  // send anyone to — the dashboard is the product, and its layout bounces an
  // unauthenticated visitor to `/login`.
  redirect('/dashboard')
}
