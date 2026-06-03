import { redirect } from 'next/navigation'

export default function RootRedirect() {
  // Public users are automatically redirected to the blogs listing page.
  // The internal team dashboard is available at /dashboard
  redirect('/blogs')
}
