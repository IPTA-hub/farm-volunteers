import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import twilio from 'twilio'
import { createServiceClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

const TYPE_LABELS = {
  sidewalking: 'Sidewalking',
  horse_assisting: 'Horse Assisting',
  events: 'Events',
  weekend_care: 'Weekend Care',
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function fmt12(t) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export async function POST(request) {
  const { volunteerId, shiftId } = await request.json()
  if (!volunteerId || !shiftId) {
    return NextResponse.json({ error: 'volunteerId and shiftId required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const [{ data: profile }, { data: shift }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', volunteerId).single(),
    supabase.from('shifts').select('*').eq('id', shiftId).single(),
  ])

  if (!profile || !shift) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(volunteerId)
  const email = authUser?.user?.email

  const shiftLabel = TYPE_LABELS[shift.type] ?? shift.type
  const dateStr = fmtDate(shift.date)
  const timeStr = `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`

  const tasks = []

  if (profile.email_notifications && email) {
    tasks.push(
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `You're confirmed for ${shiftLabel} on ${dateStr}`,
        text: [
          `Hi ${profile.full_name},`,
          '',
          `Great news — your volunteer sign-up has been approved!`,
          '',
          `Shift: ${shiftLabel}`,
          `Date: ${dateStr}`,
          `Time: ${timeStr}`,
          shift.notes ? `Notes: ${shift.notes}` : '',
          '',
          `We look forward to seeing you at the farm. Please contact us if you need to cancel.`,
        ].filter(Boolean).join('\n'),
      }).catch(() => null)
    )
  }

  if (profile.sms_notifications && profile.phone) {
    tasks.push(
      twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: profile.phone,
        body: `Your farm volunteer shift is confirmed! ${shiftLabel} on ${dateStr}, ${timeStr}. See you there!`,
      }).catch(() => null)
    )
  }

  await Promise.all(tasks)

  return NextResponse.json({ ok: true })
}
