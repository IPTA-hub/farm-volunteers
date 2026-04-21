'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ShiftCard from '@/components/ShiftCard'
import ScheduleCalendar from './ScheduleCalendar'

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  approved:  'bg-green-50 text-green-700 border-green-200',
  rejected:  'bg-red-50 text-red-600 border-red-200',
  cancelled: 'bg-stone-50 text-stone-400 border-stone-200',
}
const STATUS_LABELS = {
  pending:   'Pending approval',
  approved:  'Confirmed',
  rejected:  'Not approved',
  cancelled: 'Cancelled',
}

function StatusChip({ status }) {
  return (
    <p className={`text-xs font-medium text-center py-1.5 rounded-lg border ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}>
      {STATUS_LABELS[status] ?? status}
    </p>
  )
}

export default function MyShiftsClient({ signups }) {
  const [view, setView] = useState('list')
  const [cancelling, setCancelling] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const router = useRouter()

  async function handleCancel(signupId) {
    setCancelling(signupId)
    setConfirmId(null)
    try {
      const res = await fetch('/api/cancel-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Failed to cancel')
      } else {
        router.refresh()
      }
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">My Shifts</h1>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === 'list' ? 'bg-white shadow-sm font-medium text-stone-800' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === 'calendar' ? 'bg-white shadow-sm font-medium text-stone-800' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Confirm cancel dialog */}
      {confirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="font-semibold text-stone-800 text-lg mb-2">Cancel this shift?</h2>
            <p className="text-sm text-stone-500 mb-5">
              {signups.find(s => s.id === confirmId)?.status === 'approved'
                ? 'You are confirmed for this shift. Cancelling will open the spot and notify other volunteers.'
                : 'This will remove your signup request.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
              >
                Keep shift
              </button>
              <button
                onClick={() => handleCancel(confirmId)}
                disabled={cancelling === confirmId}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {cancelling === confirmId ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'list' ? (
        signups.length === 0 ? (
          <p className="text-stone-400 text-sm">You have no upcoming shifts. Browse available shifts to sign up.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signups.map(su => (
              <ShiftCard
                key={su.id}
                shift={{ ...su.shift, slots_left: su.shift.slots_available }}
                footer={
                  <div className="space-y-2">
                    <StatusChip status={su.status} />
                    {(su.status === 'pending' || su.status === 'approved') && (
                      <button
                        onClick={() => setConfirmId(su.id)}
                        disabled={cancelling === su.id}
                        className="w-full text-xs text-red-600 hover:text-red-700 hover:underline transition-colors disabled:opacity-50"
                      >
                        {cancelling === su.id ? 'Cancelling…' : 'Cancel shift'}
                      </button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )
      ) : (
        <ScheduleCalendar signups={signups} />
      )}
    </>
  )
}
