'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function Navbar({ role, name }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const adminLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/new-shift', label: 'Post Shift' },
    { href: '/admin/approvals', label: 'Approvals' },
  ]

  const volunteerLinks = [
    { href: '/volunteer', label: 'Available Shifts' },
    { href: '/volunteer/my-shifts', label: 'My Shifts' },
    { href: '/volunteer/settings', label: 'Notifications' },
  ]

  const links = role === 'admin' ? adminLinks : volunteerLinks

  return (
    <nav className="bg-green-800 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-green-100 text-lg tracking-tight">Farm Volunteers</span>
          <div className="hidden sm:flex gap-4 text-sm">
            {links.map(l => (
              <Link key={l.href} href={l.href} className="text-green-200 hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-green-300 hidden sm:block">{name}</span>
          <button
            onClick={handleSignOut}
            className="text-sm bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  )
}
