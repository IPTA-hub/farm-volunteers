'use client'
import { useState } from 'react'
import ShiftCard from '@/components/ShiftCard'
import { createClient } from '@/lib/supabase/client'

const TYPE_FILTERS = [
  { value: 'all',             label: 'All' },
  { value: 'sidewalking',     label: 'Sidewalking' },
  { value: 'horse_assisting', label: 'Horse Assisting' },
  { value: 'events',          label: 'Events' },
  { value: 'weekend_care',    label: 'Weekend Care' },
]

export default function AvailableShifts({ shifts: initial, userId }) {
  const [shifts, setShifts] = useState(initial)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState({})
  const [toast, setToast] = useState(null)

  const filtered = filter === 'all' ? shifts : shifts.filter(s => s.type === filter)

  async function signUp(shiftId) {
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
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-green-700 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-stone-400 text-sm">No shifts available right now — check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(shift => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              footer={
                shift.my_status ? (
                  <StatusChip status={shift.my_status} />
                ) : shift.slots_left <= 0 ? (
                  <p className="text-xs text-stone-400">This shift is full.</p>
                ) : (
                  <button
                    onClick={() => signUp(shift.id)}
                    disabled={loading[shift.id]}
                    className="w-full bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
                  >
                    {loading[shift.id] ? 'Signing up...' : 'Sign Up'}
                  </button>
                )
              }
            />
          ))}
        </div>
      )}
    </>
  )
}

function StatusChip({ status }) {
  const styles = {
    pending:  { label: 'Pending approval', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: 'You are confirmed!', cls: 'bg-green-50 text-green-700 border-green-200' },
    rejected: { label: 'Not approved', cls: 'bg-red-50 text-red-600 border-red-200' },
  }
  const s = styles[status]
  return (
    <p className={`text-xs font-medium text-center py-1.5 rounded-lg border ${s.cls}`}>
      {s.label}
    </p>
  )
}
