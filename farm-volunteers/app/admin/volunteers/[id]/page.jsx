import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import ShiftTypeTag from '@/components/ShiftTypeTag'
import { CertBadges } from '@/components/CertBadges'
import RestoreButton from './RestoreButton'

const TYPE_LABELS = {
  sidewalking:     'Sidewalking',
  horse_assisting: 'Horse Assisting',
  events:          'Events',
  weekend_care:    'Weekend Care',
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })
}

export default async function VolunteerProfilePage({ params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: adminProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') redirect('/volunteer')

  const { data: volunteer } = await supabase
    .from('profiles')
    .select('id, full_name, phone, created_at, archived, archived_at')
    .eq('id', params.id)
    .single()

  if (!volunteer) redirect('/admin/volunteers')

  const [{ data: signups }, { data: certs }] = await Promise.all([
    supabase
      .from('shift_signups')
      .select('id, status, hours, created_at, shift:shifts(id, type, date, start_time, end_time, notes)')
      .eq('volunteer_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('volunteer_certifications')
      .select('training_type, certified_at')
      .eq('volunteer_id', params.id),
  ])

  const certTypes = (certs ?? []).map(c => c.training_type)

  const approved = (signups ?? []).filter(s => s.status === 'approved' && s.shift)
  const totalHours = approved.reduce((sum, s) => sum + (s.hours ?? 0), 0)
  const thisYear = new Date().getFullYear().toString()
  const yearHours = approved.filter(s => s.shift.date?.startsWith(thisYear)).reduce((sum, s) => sum + (s.hours ?? 0), 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthHours = approved.filter(s => s.shift.date?.startsWith(thisMonth)).reduce((sum, s) => sum + (s.hours ?? 0), 0)

  // Hours by shift type
  const byType = {}
  for (const s of approved) {
    const t = s.shift.type
    byType[t] = (byType[t] ?? 0) + (s.hours ?? 0)
  }

  const allSignups = (signups ?? []).filter(s => s.shift).sort((a, b) => b.shift.date.localeCompare(a.shift.date))

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={adminProfile.full_name} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/volunteers" className="text-sm text-green-700 hover:underline">← Back to Volunteers</Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">{volunteer.full_name}</h1>
              {volunteer.phone && <p className="text-stone-500 mt-1">{volunteer.phone}</p>}
              <p className="text-xs text-stone-400 mt-1">Joined {fmtDate(volunteer.created_at?.split('T')[0])}</p>
              {certTypes.length > 0 && (
                <div className="mt-3">
                  <CertBadges certifications={certTypes} />
                </div>
              )}
              {certTypes.length === 0 && (
                <p className="text-xs text-stone-400 mt-2">No certifications yet</p>
              )}
              {volunteer.archived && (
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs bg-stone-100 text-stone-500 border border-stone-200 px-2.5 py-1 rounded-full font-medium">
                    Archived {volunteer.archived_at ? `· ${new Date(volunteer.archived_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                  </span>
                  <RestoreButton volunteerId={volunteer.id} />
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <StatCard label="Total Hours" value={`${totalHours.toFixed(1)}h`} highlight />
            <StatCard label="This Year" value={`${yearHours.toFixed(1)}h`} />
            <StatCard label="This Month" value={`${monthHours.toFixed(1)}h`} />
            <StatCard label="Shifts Completed" value={approved.length} />
          </div>
        </div>

        {/* Hours by type */}
        {Object.keys(byType).length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-stone-800 mb-4">Hours by Type</h2>
            <div className="space-y-3">
              {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, hrs]) => (
                <div key={type} className="flex items-center gap-3">
                  <ShiftTypeTag type={type} />
                  <div className="flex-1 bg-stone-100 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (hrs / totalHours) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-stone-700 w-12 text-right">{hrs.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shift history */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="font-semibold text-stone-800">Shift History</h2>
          </div>
          {allSignups.length === 0 ? (
            <p className="px-6 py-4 text-sm text-stone-400">No shifts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase">Time</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-stone-500 uppercase">Hours</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {allSignups.map(su => (
                  <tr key={su.id} className="hover:bg-stone-50">
                    <td className="px-6 py-3 text-stone-600">{fmtDate(su.shift.date)}</td>
                    <td className="px-6 py-3"><ShiftTypeTag type={su.shift.type} /></td>
                    <td className="px-6 py-3 text-stone-500">{fmt12(su.shift.start_time)} – {fmt12(su.shift.end_time)}</td>
                    <td className="px-6 py-3 text-right font-medium text-green-700">
                      {su.status === 'approved' ? `${(su.hours ?? 0).toFixed(1)}h` : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ring-1 ring-inset ${
                        su.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-200' :
                        su.status === 'pending'  ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                        'bg-red-50 text-red-600 ring-red-200'
                      }`}>{su.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-stone-50'}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-green-700' : 'text-stone-700'}`}>{value}</p>
      <p className="text-xs text-stone-500 mt-1">{label}</p>
    </div>
  )
}
