import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // 6 months ago
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const cutoffDate = sixMonthsAgo.toISOString().split('T')[0]
  const cutoffTs = sixMonthsAgo.toISOString()

  // Get all active (non-archived) volunteers
  const { data: volunteers } = await service
    .from('profiles')
    .select('id, full_name, phone, sms_notifications, email_notifications, created_at')
    .eq('role', 'volunteer')
    .eq('archived', false)

  if (!volunteers?.length) return NextResponse.json({ archived: 0 })

  const volunteerIds = volunteers.map(v => v.id)

  // Get the most recent approved shift per volunteer
  const { data: approvedSignups } = await service
    .from('shift_signups')
    .select('volunteer_id, shift:shifts(date)')
    .eq('status', 'approved')
    .in('volunteer_id', volunteerIds)

  // Build map: volunteerId → most recent shift date
  const lastShiftMap = {}
  for (const s of approvedSignups ?? []) {
    const date = s.shift?.date
    if (!date) continue
    if (!lastShiftMap[s.volunteer_id] || date > lastShiftMap[s.volunteer_id]) {
      lastShiftMap[s.volunteer_id] = date
    }
  }

  // Find volunteers to archive:
  // - Last shift was before cutoff, OR
  // - No shifts ever and account is older than 6 months
  const toArchive = volunteers.filter(v => {
    const lastShift = lastShiftMap[v.id]
    if (lastShift) return lastShift < cutoffDate
    return v.created_at < cutoffTs
  })

  if (!toArchive.length) return NextResponse.json({ archived: 0 })

  const archiveIds = toArchive.map(v => v.id)

  // Mark as archived
  await service
    .from('profiles')
    .update({ archived: true, archived_at: new Date().toISOString() })
    .in('id', archiveIds)

  // Notify admins
  try {
    const { data: admins } = await service
      .from('profiles')
      .select('id, full_name, phone, sms_notifications, email_notifications')
      .eq('role', 'admin')
      .eq('archived', false)

    const { data: authUsers } = await service.auth.admin.listUsers({ perPage: 1000 })
    const emailMap = {}
    for (const u of authUsers?.users ?? []) emailMap[u.id] = u.email

    const nameList = toArchive.map(v => `• ${v.full_name}`).join('\n')
    const summary = toArchive.length === 1
      ? `1 volunteer has been archived`
      : `${toArchive.length} volunteers have been archived`

    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    const resend = new Resend(process.env.RESEND_API_KEY)

    for (const admin of admins ?? []) {
      const email = emailMap[admin.id]

      if (admin.sms_notifications && admin.phone) {
        await twilioClient.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: admin.phone,
          body: `Iron Horse Volunteers: ${summary} due to 6 months of inactivity. Log in to review: ${process.env.NEXT_PUBLIC_APP_URL}/admin/volunteers`,
        }).catch(() => null)
      }

      if (admin.email_notifications && email) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: email,
          subject: `${summary} — Iron Horse`,
          text: [
            `Hi ${admin.full_name},`,
            '',
            `The following volunteer${toArchive.length !== 1 ? 's have' : ' has'} been automatically archived after 6 months of inactivity:`,
            '',
            nameList,
            '',
            `Archived volunteers are hidden from the active volunteer list. You can view and restore them any time from the Volunteers page.`,
            '',
            `${process.env.NEXT_PUBLIC_APP_URL}/admin/volunteers`,
            '',
            `– Iron Horse Volunteer App`,
          ].join('\n'),
        }).catch(() => null)
      }
    }
  } catch (e) {
    console.error('Admin notify error:', e)
  }

  return NextResponse.json({ archived: toArchive.length, volunteers: toArchive.map(v => v.full_name) })
}
