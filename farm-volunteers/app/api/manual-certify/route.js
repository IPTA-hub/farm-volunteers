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
    .upsert(
      { volunteer_id: volunteerId, training_type: trainingType, certified_by: user.id, certified_at: new Date().toISOString() },
      { onConflict: 'volunteer_id,training_type' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch the volunteer to return their info for local state update
  const { data: volunteer } = await service
    .from('profiles')
    .select('id, full_name, phone')
    .eq('id', volunteerId)
    .single()

  return NextResponse.json({ ok: true, volunteer })
}
