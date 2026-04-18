import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import AvailableShifts from './AvailableShifts'

export default async function VolunteerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: shifts }, { data: mySignups }] = await Promise.all([
    supabase
      .from('shifts')
      .select('*, approved_signups:shift_signups(count)')
      .gte('date', today)
      .order('date')
      .order('start_time'),
    supabase
      .from('shift_signups')
      .select('shift_id, status')
      .eq('volunteer_id', user.id),
  ])

  // Count approved signups per shift to calculate remaining slots
  const { data: approvedCounts } = await supabase
    .from('shift_signups')
    .select('shift_id, count', { count: 'exact' })
    .eq('status', 'approved')

  // Build a map: shiftId → approved count
  const approvedMap = {}
  if (approvedCounts) {
    for (const row of approvedCounts) {
      approvedMap[row.shift_id] = (approvedMap[row.shift_id] ?? 0) + 1
    }
  }

  const mySignupMap = {}
  for (const s of mySignups ?? []) {
    mySignupMap[s.shift_id] = s.status
  }

  const enrichedShifts = (shifts ?? []).map(s => ({
    ...s,
    slots_left: s.slots_available - (approvedMap[s.id] ?? 0),
    my_status: mySignupMap[s.id] ?? null,
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="volunteer" name={profile?.full_name ?? ''} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Available Shifts</h1>
          <p className="text-stone-500 text-sm mt-1">Sign up for a shift — an admin will confirm your spot.</p>
        </div>
        <AvailableShifts shifts={enrichedShifts} userId={user.id} />
      </main>
    </div>
  )
}
