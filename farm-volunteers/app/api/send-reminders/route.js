/**
 * Shift reminder endpoint — call this daily via Vercel Cron (see vercel.json).
 * Sends reminders to volunteers who have approved signups for shifts tomorrow.
 */
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

function fmt12(t) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export async function GET(request) {
  // Protect with a secret so only Vercel Cron can call this
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Find all approved signups for shifts tomorrow
  const { data: signups } = await supabase
    .from('shift_signups')
    .select(`
      volunteer_id,
      volunteer:profiles(full_name, phone, email_notifications, sms_notifications),
      shift:shifts(type, date, start_time, end_time, notes)
    `)
    .eq('status', 'approved')
    .eq('shift.date', tomorrowStr)

  if (!signups?.length) return NextResponse.json({ reminders: 0 })

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = {}
  for (const u of authUsers?.users ?? []) emailMap[u.id] = u.email

  const tasks = []

  for (const su of signups) {
    const { volunteer: vol, shift, volunteer_id } = su
    if (!shift || !vol) continue

    const label = TYPE_LABELS[shift.type] ?? shift.type
    const timeStr = `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`
    const email = emailMap[volunteer_id]

    if (vol.email_notifications && email) {
      tasks.push(
        resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: email,
          subject: `Reminder: ${label} shift tomorrow`,
          text: [
            `Hi ${vol.full_name},`,
            '',
            `Just a reminder that you have a volunteer shift tomorrow!`,
            '',
            `Shift: ${label}`,
            `Time: ${timeStr}`,
            shift.notes ? `Notes: ${shift.notes}` : '',
            '',
            `We look forward to seeing you!`,
          ].filter(Boolean).join('\n'),
        }).catch(() => null)
      )
    }

    if (vol.sms_notifications && vol.phone) {
      tasks.push(
        twilioClient.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: vol.phone,
          body: `Reminder: You have a ${label} shift tomorrow, ${timeStr}. See you at the farm!`,
        }).catch(() => null)
      )
    }
  }

  await Promise.all(tasks)

  return NextResponse.json({ reminders: tasks.length })
}
