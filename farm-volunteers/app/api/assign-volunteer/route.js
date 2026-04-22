import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

const TYPE_LABELS = {
  sidewalking:     'Sidewalking',
  horse_assisting: 'Horse Assisting',
  events:          'Events',
  weekend_care:    'Weekend Care',
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function fmt12(t) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { shiftId, volunteerId } = await request.json()
  if (!shiftId || !volunteerId) return NextResponse.json({ error: 'shiftId and volunteerId required' }, { status: 400 })

  const service = createServiceClient()

  // Fetch shift details
  const { data: shift } = await service.from('shifts').select('*').eq('id', shiftId).single()
  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  // Check if already signed up
  const { data: existing } = await service
    .from('shift_signups')
    .select('id, status')
    .eq('shift_id', shiftId)
    .eq('volunteer_id', volunteerId)
    .single()

  if (existing) {
    if (existing.status === 'approved') return NextResponse.json({ error: 'Volunteer is already assigned to this shift' }, { status: 409 })
    // Re-activate a rejected/cancelled signup
    const [sh, sm] = shift.start_time.split(':').map(Number)
    const [eh, em] = shift.end_time.split(':').map(Number)
    const hours = parseFloat(((eh * 60 + em - sh * 60 - sm) / 60).toFixed(2))
    await service.from('shift_signups').update({ status: 'approved', hours }).eq('id', existing.id)
  } else {
    // Calculate hours
    const [sh, sm] = shift.start_time.split(':').map(Number)
    const [eh, em] = shift.end_time.split(':').map(Number)
    const hours = parseFloat(((eh * 60 + em - sh * 60 - sm) / 60).toFixed(2))
    const { error } = await service.from('shift_signups').insert({
      shift_id: shiftId,
      volunteer_id: volunteerId,
      status: 'approved',
      hours,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify the volunteer
  try {
    const { data: vol } = await service.from('profiles').select('*').eq('id', volunteerId).single()
    const { data: authUser } = await service.auth.admin.getUserById(volunteerId)
    const email = authUser?.user?.email

    const shiftLabel = TYPE_LABELS[shift.type] ?? shift.type
    const dateStr = fmtDate(shift.date)
    const timeStr = `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`

    if (vol?.sms_notifications && vol?.phone) {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      await twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: vol.phone,
        body: `Hi ${vol.full_name}, you've been scheduled for a ${shiftLabel} shift at Iron Horse on ${dateStr}, ${timeStr}. See you there!`,
      }).catch(() => null)
    }

    if (vol?.email_notifications && email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `You're scheduled: ${shiftLabel} on ${dateStr}`,
        text: [
          `Hi ${vol.full_name},`,
          '',
          `You've been scheduled for a volunteer shift at Iron Horse!`,
          '',
          `Shift: ${shiftLabel}`,
          `Date: ${dateStr}`,
          `Time: ${timeStr}`,
          shift.notes ? `Notes: ${shift.notes}` : '',
          '',
          `Please contact us if you have any questions.`,
          `– Iron Horse Therapeutic Farm`,
        ].filter(Boolean).join('\n'),
      }).catch(() => null)
    }
  } catch (e) {
    console.error('Notify error:', e)
  }

  return NextResponse.json({ ok: true })
}
