import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { shiftId, start_time, end_time, slots_available, notes } = await request.json()
  if (!shiftId) return NextResponse.json({ error: 'shiftId required' }, { status: 400 })

  const service = createServiceClient()

  const updates = {}
  if (start_time !== undefined) updates.start_time = start_time
  if (end_time !== undefined) updates.end_time = end_time
  if (slots_available !== undefined) updates.slots_available = slots_available
  if (notes !== undefined) updates.notes = notes || null

  const { data, error } = await service
    .from('shifts')
    .update(updates)
    .eq('id', shiftId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, shift: data })
}
