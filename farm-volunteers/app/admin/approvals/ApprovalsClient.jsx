'use client'
import { useState } from 'react'
import ShiftTypeTag from '@/components/ShiftTypeTag'
import { createClient } from '@/lib/supabase/client'

const STATUS_FILTER = ['all', 'pending', 'approved', 'rejected']

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function ApprovalsClient({ signups: initial }) {
  const [signups, setSignups] = useState(initial)
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState({})

  async function updateStatus(signupId, newStatus, volunteerId, shiftId) {
    // Block approval if shift is already full
    if (newStatus === 'approved') {
      const shift = signups.find(s => s.id === signupId)?.shift
      const approvedCount = signups.filter(s => s.shift.id === shiftId && s.status === 'approved').length
      if (shift && approvedCount >= shift.slots_available) {
        alert(`This shift is full (${shift.slots_available} slot${shift.slots_available !== 1 ? 's' : ''}). Reject others before approving more.`)
        return
      }
    }

    setLoading(l => ({ ...l, [signupId]: true }))
    const supabase = createClient()

    // Calculate hours when approving
    let hours = null
    if (newStatus === 'approved') {
      const shift = signups.find(s => s.id === signupId)?.shift
      if (shift?.start_time && shift?.end_time) {
        const [sh, sm] = shift.start_time.split(':').map(Number)
        const [eh, em] = shift.end_time.split(':').map(Number)
        hours = parseFloat(((eh * 60 + em - sh * 60 - sm) / 60).toFixed(2))
      }
    }

    await supabase.from('shift_signups').update({ status: newStatus, ...(hours !== null ? { hours } : {}) }).eq('id', signupId)

    if (newStatus === 'approved') {
      fetch('/api/notify-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId, shiftId }),
      }).catch(() => {})
    }

    setSignups(s => s.map(su => su.id === signupId ? { ...su, status: newStatus } : su))
    setLoading(l => ({ ...l, [signupId]: false }))
  }

  const filtered = filter === 'all' ? signups : signups.filter(s => s.status === filter)

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTER.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-green-700 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300'
            }`}
          >
            {f}
            {f !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({signups.filter(s => s.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-stone-400 text-sm">No {filter === 'all' ? '' : filter} sign-ups.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(su => (
            <div key={su.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <ShiftTypeTag type={su.shift.type} />
                    <StatusBadge status={su.status} />
                    {(() => {
                      const approvedCount = signups.filter(s => s.shift.id === su.shift.id && s.status === 'approved').length
                      return approvedCount >= su.shift.slots_available ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 ring-1 ring-inset ring-red-200">Full</span>
                      ) : null
                    })()}
                  </div>
                  <p className="font-semibold text-stone-800 mt-1">{su.volunteer.full_name}</p>
                  {su.volunteer.phone && (
                    <p className="text-xs text-stone-400 mt-0.5">{su.volunteer.phone}</p>
                  )}
                  <p className="text-sm text-stone-500 mt-1">
                    {fmtDate(su.shift.date)} &middot; {fmt12(su.shift.start_time)} – {fmt12(su.shift.end_time)}
                  </p>
                </div>

                {su.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(su.id, 'rejected', su.volunteer.id, su.shift.id)}
                      disabled={loading[su.id]}
                      className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updateStatus(su.id, 'approved', su.volunteer.id, su.shift.id)}
                      disabled={loading[su.id]}
                      className="px-3 py-1.5 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    pending:  'bg-amber-50 text-amber-700 ring-amber-200',
    approved: 'bg-green-50 text-green-700 ring-green-200',
    rejected: 'bg-red-50 text-red-600 ring-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset capitalize ${styles[status]}`}>
      {status}
    </span>
  )
}
