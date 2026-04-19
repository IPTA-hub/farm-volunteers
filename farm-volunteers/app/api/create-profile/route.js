import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request) {
  const { userId, full_name, phone } = await request.json()
  if (!userId || !full_name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, full_name, phone: phone || null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
