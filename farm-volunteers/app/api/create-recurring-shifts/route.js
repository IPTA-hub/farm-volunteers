import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request) {
  const { type, date, start_time, end_time, slots_available, notes, recurrence, recurrence_end_date, userId } = await request.json()

  if (!date || !recurrence_end_date || recurrence === 'none') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const intervalDays = recurrence === 'weekly' ? 7 : 14

  // Generate all dates from start to end
  const shifts = []
  let current = new Date(date + 'T00:00:00')
  const end = new Date(recurrence_end_date + 'T00:00:00')

  while (current <= end) {
    shifts.push({
      type,
      date: current.toISOString().split('T')[0],
      start_time,
      end_time,
      slots_available,
      notes: notes || null,
      recurrence,
      recurrence_end_date,
      created_by: userId,
    })
    current.setDate(current.getDate() + intervalDays)
  }

  if (shifts.length === 0) {
    return NextResponse.json({ error: 'No shifts generated — check your dates' }, { status: 400 })
  }

  if (shifts.length > 52) {
    return NextResponse.json({ error: 'Too many shifts — please limit to 1 year' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('shifts').insert(shifts).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify volunteers of the first shift only
  if (data?.length > 0) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notify-new-shift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: data[0].id }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, count: shifts.length })
}
