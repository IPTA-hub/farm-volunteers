import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import TrainingsVolunteerClient from './TrainingsVolunteerClient'

export default async function VolunteerTrainingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: sessions }, { data: myCerts }, { data: myRegistrations }] = await Promise.all([
    supabase
      .from('training_sessions')
      .select('*, registrations:training_registrations(id, status, volunteer_id)')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),

    supabase
      .from('volunteer_certifications')
      .select('training_type, certified_at')
      .eq('volunteer_id', user.id),

    supabase
      .from('training_registrations')
      .select('session_id, status')
      .eq('volunteer_id', user.id),
  ])

  const certSet = new Set((myCerts ?? []).map(c => c.training_type))
  const regMap = {}
  for (const r of myRegistrations ?? []) {
    regMap[r.session_id] = r.status
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="volunteer" name={profile?.full_name ?? ''} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Trainings</h1>
        <p className="text-stone-500 text-sm mb-6">Complete required trainings to unlock specific shift types.</p>
        <TrainingsVolunteerClient
          sessions={sessions ?? []}
          certifications={myCerts ?? []}
          certSet={Array.from(certSet)}
          regMap={regMap}
          userId={user.id}
        />
      </main>
    </div>
  )
}
