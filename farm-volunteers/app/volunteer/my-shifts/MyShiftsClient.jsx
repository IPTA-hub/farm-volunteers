'use client'
import { useState } from 'react'
import ShiftCard from '@/components/ShiftCard'
import ScheduleCalendar from './ScheduleCalendar'

const STATUS_STYLES = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}
const STATUS_LABELS = {
  pending: 'Pending approval',
  approved: 'Confirmed',
  rejected: 'Not approved',
}

function StatusChip({ status }) {
  return (
    <p className={`text-xs font-medium text-center py-1.5 rounded-lg border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </p>
  )
}

export default function MyShiftsClient({ signups }) {
  const [view, setView] = useState('list')

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

      {view === 'list' ? (
        signups.length === 0 ? (
          <p className="text-stone-400 text-sm">You have no upcoming shifts. Browse available shifts to sign up.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signups.map(su => (
              <ShiftCard
                key={su.id}
                shift={{ ...su.shift, slots_left: su.shift.slots_available }}
                footer={<StatusChip status={su.status} />}
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
