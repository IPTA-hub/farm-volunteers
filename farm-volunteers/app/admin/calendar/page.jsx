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

  // Fetch shifts for the next 6 months
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(today.getFullYear(), today.getMonth() + 6, 0).toISOString().split('T')[0]

  const { data: shifts } = await supabase
    .from('shifts')
    .select(`
      *,
      signups:shift_signups(
        status,
        volunteer:profiles(full_name)
      )
    `)
    .gte('date', start)
    .lte('date', end)
    .order('date')
    .order('start_time')

  const enriched = (shifts ?? []).map(s => ({
    ...s,
    approved_count: s.signups?.filter(su => su.status === 'approved').length ?? 0,
    pending_count: s.signups?.filter(su => su.status === 'pending').length ?? 0,
    approved_volunteers: s.signups
      ?.filter(su => su.status === 'approved')
      .map(su => su.volunteer?.full_name)
      .filter(Boolean) ?? [],
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile.full_name} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Shift Calendar</h1>
        <CalendarClient shifts={enriched} />
      </main>
    </div>
  )
}
