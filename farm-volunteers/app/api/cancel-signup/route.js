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
  const { signupId } = await request.json()
  if (!signupId) return NextResponse.json({ error: 'signupId required' }, { status: 400 })

  // Verify the user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()

  // Fetch the signup with shift details
  const { data: signup } = await serviceSupabase
    .from('shift_signups')
    .select('id, status, volunteer_id, shift:shifts(id, type, date, start_time, end_time, slots_available)')
    .eq('id', signupId)
    .single()

  if (!signup) return NextResponse.json({ error: 'Signup not found' }, { status: 404 })
  if (signup.volunteer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const wasApproved = signup.status === 'approved'
  const shift = signup.shift

  // Cancel the signup
  const { error: updateError } = await serviceSupabase
    .from('shift_signups')
    .update({ status: 'cancelled' })
    .eq('id', signupId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // If the volunteer was approved, notify others that a spot opened
  if (wasApproved && shift) {
    try {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      const resend = new Resend(process.env.RESEND_API_KEY)

      // Fetch all volunteers with notifications enabled (excluding the one who cancelled)
      const { data: volunteers } = await serviceSupabase
        .from('profiles')
        .select('id, full_name, phone, email_notifications, sms_notifications')
        .eq('role', 'volunteer')
        .neq('id', user.id)

      // Get emails from auth.users
      const { data: authUsers } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = {}
      for (const u of authUsers?.users ?? []) {
        emailMap[u.id] = u.email
      }

      const shiftLabel = TYPE_LABELS[shift.type] ?? shift.type
      const dateStr = fmtDate(shift.date)
      const timeStr = `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`
      const smsBody = `A spot just opened on the farm! ${shiftLabel} on ${dateStr}, ${timeStr}. Log in to sign up: ${process.env.NEXT_PUBLIC_APP_URL}/volunteer`

      const promises = []
      for (const vol of volunteers ?? []) {
        const email = emailMap[vol.id]

        if (vol.email_notifications && email) {
          promises.push(
            resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL,
              to: email,
              subject: `Open spot: ${shiftLabel} on ${dateStr}`,
              text: [
                `Hi ${vol.full_name},`,
                '',
                `A volunteer spot just opened up at the farm!`,
                '',
                `Type: ${shiftLabel}`,
                `Date: ${dateStr}`,
                `Time: ${timeStr}`,
                '',
                `Log in to sign up: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app'}/volunteer`,
              ].join('\n'),
            }).catch(() => null)
          )
        }

        if (vol.sms_notifications && vol.phone) {
          promises.push(
            twilioClient.messages.create({
              from: process.env.TWILIO_PHONE_NUMBER,
              to: vol.phone,
              body: smsBody,
            }).catch(() => null)
          )
        }
      }

      await Promise.all(promises)
    } catch (e) {
      // Don't fail the cancellation if notifications fail
      console.error('Notification error on cancel:', e)
    }
  }

  return NextResponse.json({ ok: true, notified: wasApproved })
}
