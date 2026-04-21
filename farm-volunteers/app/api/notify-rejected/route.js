import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import twilio from 'twilio'
import { createServiceClient } from '@/lib/supabase/server'

const TYPE_LABELS = {
  sidewalking:     'Sidewalking',
  horse_assisting: 'Horse Assisting',
  events:          'Events',
  weekend_care:    'Weekend Care',
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
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

  const message = `Hi ${profile.full_name}, thank you so much for reaching out to volunteer. At this time we have filled this spot but appreciate your willingness to support Iron Horse. We hope to see you at the farm soon!`

  const results = {}

  if (profile.sms_notifications && profile.phone) {
    try {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      const smsResult = await twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: profile.phone,
        body: message,
      })
      results.sms = smsResult.sid
    } catch (err) {
      console.error('SMS error:', err.message)
      results.smsError = err.message
    }
  }

  if (profile.email_notifications && email) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const emailResult = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Thank you for volunteering at Iron Horse`,
        text: [
          `Hi ${profile.full_name},`,
          '',
          `Thank you so much for reaching out to volunteer. At this time we have filled this spot but appreciate your willingness to support Iron Horse.`,
          '',
          `Shift: ${shiftLabel}`,
          `Date: ${dateStr}`,
          '',
          `We hope to see you at the farm soon!`,
          '',
          `– Iron Horse Therapeutic Farm`,
        ].join('\n'),
      })
      results.email = emailResult
    } catch (err) {
      console.error('Email error:', err.message)
      results.emailError = err.message
    }
  }

  return NextResponse.json({ ok: true, results })
}
