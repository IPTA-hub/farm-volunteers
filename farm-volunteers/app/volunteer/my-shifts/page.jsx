import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import MyShiftsClient from './MyShiftsClient'

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
      <main className="max-w-5xl mx-auto px-4 py-8">
        <MyShiftsClient signups={upcoming} />
      </main>
    </div>
  )
}
