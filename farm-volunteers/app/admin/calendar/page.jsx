import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import CalendarClient from './CalendarClient'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/volunteer')

  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(today.getFullYear(), today.getMonth() + 6, 0).toISOString().split('T')[0]

  const [{ data: shifts }, { data: allVolunteers }] = await Promise.all([
    supabase
      .from('shifts')
      .select(`
        *,
        signups:shift_signups(
          id, status, volunteer_id,
          volunteer:profiles(id, full_name)
        )
      `)
      .gte('date', start)
      .lte('date', end)
      .order('date')
      .order('start_time'),

    supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'volunteer')
      .order('full_name'),
  ])

  const enriched = (shifts ?? []).map(s => ({
    ...s,
    approved_count: s.signups?.filter(su => su.status === 'approved').length ?? 0,
    pending_count:  s.signups?.filter(su => su.status === 'pending').length ?? 0,
    approved_volunteers: s.signups
      ?.filter(su => su.status === 'approved')
      .map(su => su.volunteer?.full_name)
      .filter(Boolean) ?? [],
    assigned_ids: s.signups
      ?.filter(su => su.status === 'approved')
      .map(su => su.volunteer_id)
      .filter(Boolean) ?? [],
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile.full_name} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Shift Calendar</h1>
        <CalendarClient shifts={enriched} allVolunteers={allVolunteers ?? []} />
      </main>
    </div>
  )
}
