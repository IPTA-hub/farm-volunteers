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

  // Verify the caller is an admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const serviceSupabase = createServiceClient()

  // Fetch the signup with volunteer + shift details
  const { data: signup } = await serviceSupabase
    .from('shift_signups')
    .select(`
      id, status, volunteer_id,
      volunteer:profiles(id, full_name, phone, sms_notifications, email_notifications),
      shift:shifts(id, type, date, start_time, end_time, slots_available)
    `)
    .eq('id', signupId)
    .single()

  if (!signup) return NextResponse.json({ error: 'Signup not found' }, { status: 404 })

  const wasApproved = signup.status === 'approved'
  const shift = signup.shift

  // Cancel the signup
  const { error: updateError } = await serviceSupabase
    .from('shift_signups')
    .update({ status: 'cancelled', hours: null })
    .eq('id', signupId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Notify the cancelled volunteer that they've been removed
  if (shift) {
    const shiftLabel = TYPE_LABELS[shift.type] ?? shift.type
    const dateStr = fmtDate(shift.date)
    const timeStr = `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`

    try {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      const resend = new Resend(process.env.RESEND_API_KEY)

      // Tell the removed volunteer
      const vol = signup.volunteer
      const { data: authUsers } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = {}
      for (const u of authUsers?.users ?? []) emailMap[u.id] = u.email

      if (vol?.sms_notifications && vol?.phone) {
        await twilioClient.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: vol.phone,
          body: `Hi ${vol.full_name}, you've been removed from the ${shiftLabel} shift on ${dateStr}. Please contact the farm if you have questions.`,
        }).catch(() => null)
      }

      const volEmail = emailMap[vol?.id]
      if (vol?.email_notifications && volEmail) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: volEmail,
          subject: `Shift cancellation: ${shiftLabel} on ${dateStr}`,
          text: [
            `Hi ${vol.full_name},`,
            '',
            `You have been removed from the following shift. Please contact the farm if you have questions.`,
            '',
            `Type: ${shiftLabel}`,
            `Date: ${dateStr}`,
            `Time: ${timeStr}`,
          ].join('\n'),
        }).catch(() => null)
      }

      // If the shift was approved (spot is now open), notify all other volunteers
      if (wasApproved) {
        const { data: allVolunteers } = await serviceSupabase
          .from('profiles')
          .select('id, full_name, phone, sms_notifications, email_notifications')
          .eq('role', 'volunteer')
          .neq('id', signup.volunteer_id)

        const openSpotSms = `A spot just opened at the farm! ${shiftLabel} on ${dateStr}, ${timeStr}. Log in to sign up: ${process.env.NEXT_PUBLIC_APP_URL}/volunteer`

        const promises = []
        for (const v of allVolunteers ?? []) {
          const email = emailMap[v.id]

          if (v.email_notifications && email) {
            promises.push(
              resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL,
                to: email,
                subject: `Open spot: ${shiftLabel} on ${dateStr}`,
                text: [
                  `Hi ${v.full_name},`,
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

          if (v.sms_notifications && v.phone) {
            promises.push(
              twilioClient.messages.create({
                from: process.env.TWILIO_PHONE_NUMBER,
                to: v.phone,
                body: openSpotSms,
              }).catch(() => null)
            )
          }
        }

        await Promise.all(promises)
      }
    } catch (e) {
      console.error('Notification error on admin cancel:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
