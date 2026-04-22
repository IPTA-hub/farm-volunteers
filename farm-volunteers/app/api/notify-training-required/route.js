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
function fmt12(t) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export async function POST(request) {
  const { trainingType } = await request.json()
  if (!trainingType) return NextResponse.json({ error: 'trainingType required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Find the next upcoming session for this training type
  const today = new Date().toISOString().split('T')[0]
  const { data: nextSession } = await service
    .from('training_sessions')
    .select('*')
    .eq('training_type', trainingType)
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(1)
    .single()

  const { data: profile } = await service.from('profiles').select('*').eq('id', user.id).single()
  const { data: authUser } = await service.auth.admin.getUserById(user.id)
  const email = authUser?.user?.email

  const trainingLabel = TYPE_LABELS[trainingType] ?? trainingType
  const shiftLabel = SHIFT_LABELS[trainingType] ?? trainingType

  let smsBody, emailBody

  if (nextSession) {
    const dateStr = fmtDate(nextSession.date)
    const timeStr = `${fmt12(nextSession.start_time)} – ${fmt12(nextSession.end_time)}`
    const loc = nextSession.location ? ` at ${nextSession.location}` : ''
    smsBody = `Hi ${profile?.full_name}! To volunteer for ${shiftLabel} shifts at Iron Horse, you first need to complete the ${trainingLabel}. Next session: ${dateStr}, ${timeStr}${loc}. Register in the app under Trainings!`
    emailBody = [
      `Hi ${profile?.full_name},`,
      '',
      `Thank you for your interest in volunteering for ${shiftLabel} shifts at Iron Horse!`,
      '',
      `Before you can sign up for ${shiftLabel} shifts, you'll need to complete the ${trainingLabel}.`,
      '',
      `Next Training Session:`,
      `Date: ${dateStr}`,
      `Time: ${timeStr}`,
      nextSession.location ? `Location: ${nextSession.location}` : '',
      nextSession.notes ? `Notes: ${nextSession.notes}` : '',
      '',
      `You can register for this training in the app:`,
      `${process.env.NEXT_PUBLIC_APP_URL}/volunteer/trainings`,
      '',
      `We look forward to seeing you!`,
      `– Iron Horse Therapeutic Farm`,
    ].filter(Boolean).join('\n')
  } else {
    smsBody = `Hi ${profile?.full_name}! To volunteer for ${shiftLabel} shifts at Iron Horse, you'll need to complete the ${trainingLabel} first. No sessions are scheduled yet — we'll notify you when one is posted!`
    emailBody = [
      `Hi ${profile?.full_name},`,
      '',
      `Thank you for your interest in volunteering for ${shiftLabel} shifts at Iron Horse!`,
      '',
      `Before you can sign up for ${shiftLabel} shifts, you'll need to complete the ${trainingLabel}.`,
      '',
      `We don't have any training sessions scheduled right now, but we'll notify you as soon as one is posted.`,
      '',
      `– Iron Horse Therapeutic Farm`,
    ].join('\n')
  }

  try {
    if (profile?.sms_notifications && profile?.phone) {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      await twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: profile.phone,
        body: smsBody,
      }).catch(() => null)
    }

    if (profile?.email_notifications && email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Training required: ${trainingLabel}`,
        text: emailBody,
      }).catch(() => null)
    }
  } catch (e) {
    console.error('Notification error:', e)
  }

  return NextResponse.json({ ok: true, hasSession: !!nextSession, session: nextSession ?? null })
}
