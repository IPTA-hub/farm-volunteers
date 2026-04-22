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

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function fmt12(t) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export async function POST(request) {
  const { sessionId } = await request.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Fetch session
  const { data: session } = await service.from('training_sessions').select('*').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Check capacity
  const { count } = await service
    .from('training_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('status', 'registered')

  if ((count ?? 0) >= session.capacity) {
    return NextResponse.json({ error: 'This session is full' }, { status: 409 })
  }

  // Register
  const { error } = await service
    .from('training_registrations')
    .upsert({ session_id: sessionId, volunteer_id: user.id, status: 'registered' }, { onConflict: 'session_id,volunteer_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send confirmation to volunteer
  try {
    const { data: profile } = await service.from('profiles').select('*').eq('id', user.id).single()
    const { data: authUser } = await service.auth.admin.getUserById(user.id)
    const email = authUser?.user?.email

    const label = TYPE_LABELS[session.training_type] ?? session.training_type
    const dateStr = fmtDate(session.date)
    const timeStr = `${fmt12(session.start_time)} – ${fmt12(session.end_time)}`
    const loc = session.location ? ` · ${session.location}` : ''

    if (profile?.sms_notifications && profile?.phone) {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      await twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: profile.phone,
        body: `You're registered for ${label} at Iron Horse! ${dateStr}, ${timeStr}${loc}. See you there!`,
      }).catch(() => null)
    }

    if (profile?.email_notifications && email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Training registration confirmed: ${label}`,
        text: [
          `Hi ${profile.full_name},`,
          '',
          `You're registered for the following training at Iron Horse!`,
          '',
          `Training: ${label}`,
          `Date: ${dateStr}`,
          `Time: ${timeStr}`,
          session.location ? `Location: ${session.location}` : '',
          session.notes ? `Notes: ${session.notes}` : '',
          '',
          `We look forward to seeing you!`,
          `– Iron Horse Therapeutic Farm`,
        ].filter(Boolean).join('\n'),
      }).catch(() => null)
    }
  } catch (e) {
    console.error('Notification error:', e)
  }

  return NextResponse.json({ ok: true })
}
