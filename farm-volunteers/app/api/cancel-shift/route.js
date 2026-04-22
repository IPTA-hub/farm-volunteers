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
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function fmt12(t) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { shiftId } = await request.json()
  if (!shiftId) return NextResponse.json({ error: 'shiftId required' }, { status: 400 })

  const service = createServiceClient()

  // Fetch shift + all approved volunteers before deleting
  const { data: shift } = await service.from('shifts').select('*').eq('id', shiftId).single()
  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  const { data: approvedSignups } = await service
    .from('shift_signups')
    .select('volunteer_id, volunteer:profiles(id, full_name, phone, sms_notifications, email_notifications)')
    .eq('shift_id', shiftId)
    .eq('status', 'approved')

  // Delete the shift (cascades to shift_signups)
  const { error } = await service.from('shifts').delete().eq('id', shiftId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify approved volunteers that the shift is cancelled
  if (approvedSignups?.length) {
    try {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      const resend = new Resend(process.env.RESEND_API_KEY)

      const { data: authUsers } = await service.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = {}
      for (const u of authUsers?.users ?? []) emailMap[u.id] = u.email

      const shiftLabel = TYPE_LABELS[shift.type] ?? shift.type
      const dateStr = fmtDate(shift.date)
      const timeStr = `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`

      for (const su of approvedSignups) {
        const vol = su.volunteer
        const email = emailMap[vol?.id]

        if (vol?.sms_notifications && vol?.phone) {
          await twilioClient.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER,
            to: vol.phone,
            body: `Hi ${vol.full_name}, the ${shiftLabel} shift on ${dateStr} (${timeStr}) has been cancelled. Please contact Iron Horse if you have questions.`,
          }).catch(() => null)
        }

        if (vol?.email_notifications && email) {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: email,
            subject: `Shift cancelled: ${shiftLabel} on ${dateStr}`,
            text: [
              `Hi ${vol.full_name},`,
              '',
              `The following shift has been cancelled:`,
              '',
              `Shift: ${shiftLabel}`,
              `Date: ${dateStr}`,
              `Time: ${timeStr}`,
              '',
              `Please contact us if you have any questions.`,
              `– Iron Horse Therapeutic Farm`,
            ].join('\n'),
          }).catch(() => null)
        }
      }
    } catch (e) {
      console.error('Notify error on shift cancel:', e)
    }
  }

  return NextResponse.json({ ok: true, notified: approvedSignups?.length ?? 0 })
}
