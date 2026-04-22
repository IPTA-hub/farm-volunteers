import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import TrainingsAdminClient from './TrainingsAdminClient'

export default async function AdminTrainingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/volunteer')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: sessions }, { data: certifications }, { data: allVolunteers }] = await Promise.all([
    supabase
      .from('training_sessions')
      .select(`
        *,
        registrations:training_registrations(
          id, status,
          volunteer:profiles(id, full_name, phone)
        )
      `)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),

    supabase
      .from('volunteer_certifications')
      .select('*, volunteer:profiles(id, full_name, phone)')
      .order('certified_at', { ascending: false }),

    supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'volunteer')
      .order('full_name'),
  ])

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile.full_name} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Trainings</h1>
        <TrainingsAdminClient
          sessions={sessions ?? []}
          certifications={certifications ?? []}
          allVolunteers={allVolunteers ?? []}
          today={today}
          adminId={user.id}
        />
      </main>
    </div>
  )
}
