import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import ApprovalsClient from './ApprovalsClient'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/volunteer')

  const [{ data: signups }, { data: allCerts }] = await Promise.all([
    supabase
      .from('shift_signups')
      .select(`
        id, status, created_at,
        volunteer:profiles(full_name, phone, id),
        shift:shifts(id, type, date, start_time, end_time, slots_available),
        hours
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('volunteer_certifications')
      .select('volunteer_id, training_type'),
  ])

  const certMap = {}
  for (const c of allCerts ?? []) {
    if (!certMap[c.volunteer_id]) certMap[c.volunteer_id] = []
    certMap[c.volunteer_id].push(c.training_type)
  }

  const signupsWithCerts = (signups ?? []).map(s => ({
    ...s,
    volunteer: { ...s.volunteer, certifications: certMap[s.volunteer?.id] ?? [] },
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile.full_name} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Volunteer Sign-ups</h1>
        <ApprovalsClient signups={signupsWithCerts} />
      </main>
    </div>
  )
}
