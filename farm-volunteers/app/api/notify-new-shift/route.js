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
  const { shiftId } = await request.json()
  if (!shiftId) return NextResponse.json({ error: 'shiftId required' }, { status: 400 })

  const supabase = createServiceClient()

  // Fetch the shift
  const { data: shift } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .single()

  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  // Fetch all volunteers with notifications enabled
  const { data: volunteers } = await supabase
    .from('profiles')
    .select('full_name, phone, email_notifications, sms_notifications, id')
    .eq('role', 'volunteer')

  if (!volunteers?.length) return NextResponse.json({ sent: 0 })

  // Get emails from auth.users via service role
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = {}
  for (const u of authUsers?.users ?? []) {
    emailMap[u.id] = u.email
  }

  const shiftLabel = TYPE_LABELS[shift.type] ?? shift.type
  const dateStr = fmtDate(shift.date)
  const timeStr = `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`
  const notesLine = shift.notes ? `\n\nNotes: ${shift.notes}` : ''

  const emailPromises = []
  const smsPromises = []

  for (const vol of volunteers) {
    const email = emailMap[vol.id]

    if (vol.email_notifications && email) {
      emailPromises.push(
        resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: email,
          subject: `New volunteer shift: ${shiftLabel} on ${dateStr}`,
          text: [
            `Hi ${vol.full_name},`,
            '',
            `A new volunteer shift is available at the farm!`,
            '',
            `Type: ${shiftLabel}`,
            `Date: ${dateStr}`,
            `Time: ${timeStr}`,
            `Spots available: ${shift.slots_available}${notesLine}`,
            '',
            `Log in to sign up: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app'}/volunteer`,
          ].join('\n'),
        }).catch(() => null)
      )
    }

    if (vol.sms_notifications && vol.phone) {
      smsPromises.push(
        twilioClient.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: vol.phone,
          body: `New farm volunteer shift: ${shiftLabel} on ${dateStr}, ${timeStr}. Log in to sign up!`,
        }).catch(() => null)
      )
    }
  }

  await Promise.all([...emailPromises, ...smsPromises])

  return NextResponse.json({ sent: emailPromises.length + smsPromises.length })
}
