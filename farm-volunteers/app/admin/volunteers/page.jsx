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

  const [{ data: volunteers }, { data: allCerts }] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id, full_name, phone, created_at, archived, archived_at,
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

  const certMap = {}
  for (const c of allCerts ?? []) {
    if (!certMap[c.volunteer_id]) certMap[c.volunteer_id] = []
    certMap[c.volunteer_id].push(c.training_type)
  }

  const enrich = (v) => {
    const approved = v.signups?.filter(s => s.status === 'approved') ?? []
    const totalHours = approved.reduce((sum, s) => sum + (s.hours ?? 0), 0)
    const thisMonth = new Date().toISOString().slice(0, 7)
    const monthHours = approved.filter(s => s.shift?.date?.startsWith(thisMonth)).reduce((sum, s) => sum + (s.hours ?? 0), 0)
    const thisYear = new Date().getFullYear().toString()
    const yearHours = approved.filter(s => s.shift?.date?.startsWith(thisYear)).reduce((sum, s) => sum + (s.hours ?? 0), 0)
    return {
      id: v.id,
      full_name: v.full_name,
      phone: v.phone,
      created_at: v.created_at,
      archived: v.archived ?? false,
      archived_at: v.archived_at ?? null,
      totalHours: parseFloat(totalHours.toFixed(2)),
      monthHours: parseFloat(monthHours.toFixed(2)),
      yearHours: parseFloat(yearHours.toFixed(2)),
      shiftCount: approved.length,
      certifications: certMap[v.id] ?? [],
    }
  }

  const all = (volunteers ?? []).map(enrich)
  const active = all.filter(v => !v.archived).sort((a, b) => b.totalHours - a.totalHours)
  const archived = all.filter(v => v.archived).sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile.full_name} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Volunteers</h1>
        <VolunteersClient volunteers={active} archivedVolunteers={archived} />
      </main>
    </div>
  )
}
