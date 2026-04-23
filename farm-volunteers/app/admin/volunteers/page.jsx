import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import VolunteersClient from './VolunteersClient'

export default async function VolunteersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/volunteer')

  // Get all volunteers with their approved signups and certifications
  const [{ data: volunteers }, { data: allCerts }] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id, full_name, phone, created_at,
        signups:shift_signups(
          id, status, hours, created_at,
          shift:shifts(type, date, start_time, end_time)
        )
      `)
      .eq('role', 'volunteer')
      .order('full_name'),
    supabase
      .from('volunteer_certifications')
      .select('volunteer_id, training_type'),
  ])

  // Build cert map: volunteerId → [training_type, ...]
  const certMap = {}
  for (const c of allCerts ?? []) {
    if (!certMap[c.volunteer_id]) certMap[c.volunteer_id] = []
    certMap[c.volunteer_id].push(c.training_type)
  }

  const enriched = (volunteers ?? []).map(v => {
    const approved = v.signups?.filter(s => s.status === 'approved') ?? []
    const totalHours = approved.reduce((sum, s) => sum + (s.hours ?? 0), 0)
    const thisMonth = new Date().toISOString().slice(0, 7)
    const monthHours = approved
      .filter(s => s.shift?.date?.startsWith(thisMonth))
      .reduce((sum, s) => sum + (s.hours ?? 0), 0)
    const thisYear = new Date().getFullYear().toString()
    const yearHours = approved
      .filter(s => s.shift?.date?.startsWith(thisYear))
      .reduce((sum, s) => sum + (s.hours ?? 0), 0)
    return {
      id: v.id,
      full_name: v.full_name,
      phone: v.phone,
      created_at: v.created_at,
      totalHours: parseFloat(totalHours.toFixed(2)),
      monthHours: parseFloat(monthHours.toFixed(2)),
      yearHours: parseFloat(yearHours.toFixed(2)),
      shiftCount: approved.length,
      certifications: certMap[v.id] ?? [],
    }
  })

  // Sort by total hours descending for leaderboard
  const leaderboard = [...enriched].sort((a, b) => b.totalHours - a.totalHours)

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile.full_name} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Volunteers</h1>
        <VolunteersClient volunteers={leaderboard} />
      </main>
    </div>
  )
}
