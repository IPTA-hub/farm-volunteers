import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import ShiftCard from '@/components/ShiftCard'

function StatusChip({ status }) {
  const styles = {
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
  }
  const labels = { pending: 'Pending approval', approved: 'Confirmed', rejected: 'Not approved' }
  return (
    <p className={`text-xs font-medium text-center py-1.5 rounded-lg border ${styles[status]}`}>
      {labels[status]}
    </p>
  )
}

export default async function MyShiftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const today = new Date().toISOString().split('T')[0]

  const { data: signups } = await supabase
    .from('shift_signups')
    .select('id, status, shift:shifts(id, type, date, start_time, end_time, slots_available, notes)')
    .eq('volunteer_id', user.id)
    .gte('shift.date', today)
    .order('created_at', { ascending: false })

  const upcoming = (signups ?? [])
    .filter(s => s.shift)
    .sort((a, b) => a.shift.date.localeCompare(b.shift.date))

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="volunteer" name={profile?.full_name ?? ''} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">My Shifts</h1>

        {upcoming.length === 0 ? (
          <p className="text-stone-400 text-sm">You have no upcoming shifts. Browse available shifts to sign up.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map(su => (
              <ShiftCard
                key={su.id}
                shift={{ ...su.shift, slots_left: su.shift.slots_available }}
                footer={<StatusChip status={su.status} />}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
