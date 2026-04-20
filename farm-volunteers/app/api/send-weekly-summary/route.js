/**
 * Weekly summary endpoint — runs every Sunday at 6 PM UTC (vercel.json).
 * Sends each volunteer a summary of their approved shifts for the upcoming week.
 */
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

function fmt12(t) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get Monday–Sunday of the upcoming week
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const startStr = monday.toISOString().split('T')[0]
  const endStr = sunday.toISOString().split('T')[0]

  // Get all approved signups for next week
  const { data: signups } = await supabase
    .from('shift_signups')
    .select(`
      volunteer_id,
      volunteer:profiles(full_name, phone, email_notifications, sms_notifications),
      shift:shifts(type, date, start_time, end_time, notes)
    `)
    .eq('status', 'approved')
    .gte('shift.date', startStr)
    .lte('shift.date', endStr)

  if (!signups?.length) return NextResponse.json({ summaries: 0 })

  // Group by volunteer
  const byVolunteer = {}
  for (const su of signups) {
    if (!su.shift || !su.volunteer) continue
    const id = su.volunteer_id
    if (!byVolunteer[id]) byVolunteer[id] = { volunteer: su.volunteer, shifts: [] }
    byVolunteer[id].shifts.push(su.shift)
  }

  // Sort each volunteer's shifts by date
  for (const v of Object.values(byVolunteer)) {
    v.shifts.sort((a, b) => a.date.localeCompare(b.date))
  }

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = {}
  for (const u of authUsers?.users ?? []) emailMap[u.id] = u.email

  const tasks = []
  const weekRange = `${fmtDate(startStr)} – ${fmtDate(endStr)}`

  for (const [volunteerId, { volunteer: vol, shifts }] of Object.entries(byVolunteer)) {
    const email = emailMap[volunteerId]
    const shiftLines = shifts.map(s =>
      `• ${fmtDate(s.date)}: ${TYPE_LABELS[s.type] ?? s.type}, ${fmt12(s.start_time)} – ${fmt12(s.end_time)}`
    )

    if (vol.email_notifications && email) {
      tasks.push(
        new Resend(process.env.RESEND_API_KEY).emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: email,
          subject: `Your volunteer schedule for the week of ${fmtDate(startStr)}`,
          text: [
            `Hi ${vol.full_name},`,
            '',
            `Here's your volunteer schedule for next week (${weekRange}):`,
            '',
            ...shiftLines,
            '',
            `Thank you for volunteering at Iron Horse Therapeutic Farm!`,
            `Reply STOP to opt out of SMS, or update your notification preferences in the volunteer portal.`,
          ].join('\n'),
        }).catch(() => null)
      )
    }

    if (vol.sms_notifications && vol.phone) {
      const smsBody = [
        `Iron Horse Volunteers — your schedule for next week:`,
        ...shiftLines,
        `Reply STOP to opt out.`,
      ].join('\n')

      tasks.push(
        twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: vol.phone,
          body: smsBody,
        }).catch(() => null)
      )
    }
  }

  await Promise.all(tasks)
  return NextResponse.json({ summaries: Object.keys(byVolunteer).length, notifications: tasks.length })
}
