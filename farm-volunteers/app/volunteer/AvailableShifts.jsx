'use client'
import { useState } from 'react'
import ShiftCard from '@/components/ShiftCard'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// These shift types require a certification before signing up
const CERT_REQUIRED = {
  sidewalking:     'sidewalking',
  horse_assisting: 'horse_assisting',
  weekend_care:    'weekend_care',
}
const TRAINING_LABELS = {
  sidewalking:     'Sidewalk Safety Training',
  horse_assisting: 'Horse Assisting Safety Training',
  weekend_care:    'Weekend Care Training',
}

const TYPE_FILTERS = [
  { value: 'all',             label: 'All' },
  { value: 'sidewalking',     label: 'Sidewalking' },
  { value: 'horse_assisting', label: 'Horse Assisting' },
  { value: 'events',          label: 'Events' },
  { value: 'weekend_care',    label: 'Weekend Care' },
]

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}
function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function AvailableShifts({ shifts: initial, userId, certSet: initialCertSet, nextSessionMap }) {
  const [shifts, setShifts] = useState(initial)
  const [certSet] = useState(new Set(initialCertSet))
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState({})
  const [toast, setToast] = useState(null)
  const [certBlock, setCertBlock] = useState(null) // { trainingType, nextSession }

  const filtered = filter === 'all' ? shifts : shifts.filter(s => s.type === filter)

  async function signUp(shiftId, shiftType) {
    // Check if certification is required
    const requiredCert = CERT_REQUIRED[shiftType]
    if (requiredCert && !certSet.has(requiredCert)) {
      // Block signup and show training info
      const nextSession = nextSessionMap?.[requiredCert] ?? null
      setCertBlock({ trainingType: requiredCert, nextSession })
      // Auto-notify volunteer about training requirement
      fetch('/api/notify-training-required', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingType: requiredCert }),
      }).catch(() => {})
      return
    }

    setLoading(l => ({ ...l, [shiftId]: true }))
    const supabase = createClient()
    const { error } = await supabase
      .from('shift_signups')
      .insert({ shift_id: shiftId, volunteer_id: userId, status: 'pending' })

    if (error) {
      showToast('Something went wrong. Please try again.', 'error')
    } else {
      setShifts(s => s.map(sh => sh.id === shiftId ? { ...sh, my_status: 'pending' } : sh))
      showToast('Sign-up submitted! An admin will confirm your spot.', 'success')
    }
    setLoading(l => ({ ...l, [shiftId]: false }))
  }

  function showToast(msg, type) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${
          toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Certification required modal */}
      {certBlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="text-3xl mb-3">🔒</div>
            <h2 className="font-semibold text-stone-800 text-lg mb-2">Training Required</h2>
            <p className="text-sm text-stone-600 mb-3">
              This shift requires you to complete the <span className="font-medium text-stone-800">{TRAINING_LABELS[certBlock.trainingType]}</span> before signing up.
            </p>
            {certBlock.nextSession ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-green-800 mb-1">Next Training Session</p>
                <p className="text-sm text-green-700 font-medium">{fmtDate(certBlock.nextSession.date)}</p>
                <p className="text-sm text-green-600">{fmt12(certBlock.nextSession.start_time)} – {fmt12(certBlock.nextSession.end_time)}</p>
                {certBlock.nextSession.location && <p className="text-sm text-green-600">{certBlock.nextSession.location}</p>}
                <p className="text-xs text-green-600 mt-1">We've sent you the details by text.</p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-700">No training sessions are scheduled yet. We'll text you as soon as one is posted!</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setCertBlock(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
                Close
              </button>
              <Link href="/volunteer/trainings"
                onClick={() => setCertBlock(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors text-center font-medium">
                View Trainings
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {TYPE_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value ? 'bg-green-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300'
            }`}>
            {f.label}
            {CERT_REQUIRED[f.value] && !certSet.has(CERT_REQUIRED[f.value]) && f.value !== 'all' && (
              <span className="ml-1 text-xs opacity-60">🔒</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-stone-400 text-sm">No shifts available right now — check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(shift => {
            const requiredCert = CERT_REQUIRED[shift.type]
            const needsCert = requiredCert && !certSet.has(requiredCert)
            return (
              <ShiftCard
                key={shift.id}
                shift={shift}
                footer={
                  shift.my_status ? (
                    <StatusChip status={shift.my_status} />
                  ) : shift.slots_left <= 0 ? (
                    <p className="text-xs text-stone-400">This shift is full.</p>
                  ) : needsCert ? (
                    <button onClick={() => signUp(shift.id, shift.type)}
                      className="w-full bg-stone-200 text-stone-600 text-sm font-medium py-2 rounded-lg hover:bg-stone-300 transition-colors flex items-center justify-center gap-1.5">
                      <span>🔒</span> Training Required
                    </button>
                  ) : (
                    <button onClick={() => signUp(shift.id, shift.type)} disabled={loading[shift.id]}
                      className="w-full bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors">
                      {loading[shift.id] ? 'Signing up...' : 'Sign Up'}
                    </button>
                  )
                }
              />
            )
          })}
        </div>
      )}
    </>
  )
}

function StatusChip({ status }) {
  const styles = {
    pending:  { label: 'Pending approval',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: 'You are confirmed!', cls: 'bg-green-50 text-green-700 border-green-200' },
    rejected: { label: 'Not approved',       cls: 'bg-red-50 text-red-600 border-red-200' },
  }
  const s = styles[status] ?? styles.pending
  return (
    <p className={`text-xs font-medium text-center py-1.5 rounded-lg border ${s.cls}`}>{s.label}</p>
  )
}
