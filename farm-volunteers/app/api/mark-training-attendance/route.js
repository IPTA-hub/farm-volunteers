import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

const TYPE_LABELS = {
  sidewalking:     'Sidewalk Safety Training',
  horse_assisting: 'Horse Assisting Safety Training',
  weekend_care:    'Weekend Care Training',
}
const SHIFT_LABELS = {
  sidewalking:     'Sidewalking',
  horse_assisting: 'Horse Assisting',
  weekend_care:    'Weekend Care',
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export async function POST(request) {
  const { sessionId, attendeeIds } = await request.json()
  if (!sessionId || !Array.isArray(attendeeIds)) {
    return NextResponse.json({ error: 'sessionId and attendeeIds required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  const { data: session } = await service.from('training_sessions').select('*').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  if (attendeeIds.length === 0) return NextResponse.json({ ok: true, certified: 0 })

  // Mark registrations as attended
  await service
    .from('training_registrations')
    .update({ status: 'attended' })
    .eq('session_id', sessionId)
    .in('volunteer_id', attendeeIds)

  // Upsert certifications — won't overwrite if already certified
  const certRows = attendeeIds.map(vid => ({
    volunteer_id: vid,
    training_type: session.training_type,
    certified_by: user.id,
    certified_at: new Date().toISOString(),
  }))

  const { error: certError } = await service
    .from('volunteer_certifications')
    .upsert(certRows, { onConflict: 'volunteer_id,training_type', ignoreDuplicates: true })

  if (certError) return NextResponse.json({ error: certError.message }, { status: 500 })

  // Notify newly certified volunteers
  try {
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data: volunteers } = await service
      .from('profiles')
      .select('id, full_name, phone, sms_notifications, email_notifications')
      .in('id', attendeeIds)

    const { data: authUsers } = await service.auth.admin.listUsers({ perPage: 1000 })
    const emailMap = {}
    for (const u of authUsers?.users ?? []) emailMap[u.id] = u.email

    const trainingLabel = TYPE_LABELS[session.training_type] ?? session.training_type
    const shiftLabel = SHIFT_LABELS[session.training_type] ?? session.training_type
    const dateStr = fmtDate(session.date)

    for (const vol of volunteers ?? []) {
      const email = emailMap[vol.id]

      if (vol.sms_notifications && vol.phone) {
        await twilioClient.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: vol.phone,
          body: `Congratulations ${vol.full_name}! You are now certified for ${shiftLabel} shifts at Iron Horse. You can sign up for ${shiftLabel} shifts in the app. Thank you!`,
        }).catch(() => null)
      }

      if (vol.email_notifications && email) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: email,
          subject: `You're certified for ${shiftLabel} at Iron Horse!`,
          text: [
            `Hi ${vol.full_name},`,
            '',
            `Congratulations! You have successfully completed the ${trainingLabel} on ${dateStr}.`,
            '',
            `You are now certified to volunteer for ${shiftLabel} shifts at Iron Horse. Log in to browse available shifts and sign up!`,
            '',
            `${process.env.NEXT_PUBLIC_APP_URL}/volunteer`,
            '',
            `Thank you for your commitment to Iron Horse Therapeutic Farm!`,
            `– Iron Horse Therapeutic Farm`,
          ].join('\n'),
        }).catch(() => null)
      }
    }
  } catch (e) {
    console.error('Notification error:', e)
  }

  return NextResponse.json({ ok: true, certified: attendeeIds.length })
}
