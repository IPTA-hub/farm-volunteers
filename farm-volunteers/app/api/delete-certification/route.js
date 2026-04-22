import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { volunteerId, trainingType } = await request.json()
  if (!volunteerId || !trainingType) {
    return NextResponse.json({ error: 'volunteerId and trainingType required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('volunteer_certifications')
    .delete()
    .eq('volunteer_id', volunteerId)
    .eq('training_type', trainingType)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
