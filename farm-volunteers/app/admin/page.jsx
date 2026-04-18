import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import ShiftCard from '@/components/ShiftCard'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/volunteer')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: shifts }, { data: signups }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('shifts')
      .select('*, signups:shift_signups(status)')
      .gte('date', today)
      .order('date')
      .order('start_time')
      .limit(6),
    supabase.from('shift_signups').select('id', { count: 'exact' }),
    supabase.from('shift_signups').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const shiftsWithSlots = (shifts ?? []).map(s => ({
    ...s,
    slots_left: s.slots_available - (s.signups?.filter(su => su.status === 'approved').length ?? 0),
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile.full_name} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-stone-900">Admin Dashboard</h1>
          <Link
            href="/admin/new-shift"
            className="bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
          >
            + Post New Shift
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Upcoming Shifts" value={shifts?.length ?? 0} />
          <StatCard label="Total Sign-ups" value={signups?.length ?? 0} />
          <StatCard
            label="Pending Approvals"
            value={pendingCount ?? 0}
            highlight={pendingCount > 0}
            href="/admin/approvals"
          />
        </div>

        {/* Upcoming shifts */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-800">Upcoming Shifts</h2>
          <Link href="/admin/approvals" className="text-sm text-green-700 hover:underline">
            View approvals →
          </Link>
        </div>

        {shiftsWithSlots.length === 0 ? (
          <p className="text-stone-400 text-sm">No upcoming shifts posted yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shiftsWithSlots.map(shift => (
              <ShiftCard key={shift.id} shift={shift} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, highlight, href }) {
  const inner = (
    <div className={`bg-white rounded-xl border p-5 ${highlight ? 'border-amber-300 bg-amber-50' : 'border-stone-200'}`}>
      <p className={`text-3xl font-bold ${highlight ? 'text-amber-700' : 'text-green-700'}`}>{value}</p>
      <p className="text-sm text-stone-500 mt-1">{label}</p>
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}
