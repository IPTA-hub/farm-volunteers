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

  const { data: signups } = await supabase
    .from('shift_signups')
    .select(`
      id, status, created_at,
      volunteer:profiles(full_name, phone, id),
      shift:shifts(id, type, date, start_time, end_time)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile.full_name} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Volunteer Sign-ups</h1>
        <ApprovalsClient signups={signups ?? []} />
      </main>
    </div>
  )
}
