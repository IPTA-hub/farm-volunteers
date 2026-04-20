'use client'
import { useState } from 'react'

const TYPE_COLORS = {
  sidewalking:     'bg-blue-100 text-blue-800 border-blue-200',
  horse_assisting: 'bg-purple-100 text-purple-800 border-purple-200',
  events:          'bg-amber-100 text-amber-800 border-amber-200',
  weekend_care:    'bg-green-100 text-green-800 border-green-200',
}

const TYPE_LABELS = {
  sidewalking:     'Sidewalking',
  horse_assisting: 'Horse Assist',
  events:          'Events',
  weekend_care:    'Weekend Care',
}

const STATUS_STYLES = {
  pending:  'border-amber-400 bg-amber-50',
  approved: 'border-green-500 bg-green-50',
  rejected: 'border-red-400 bg-red-50',
}

const STATUS_LABELS = {
  pending:  'Pending',
  approved: 'Confirmed',
  rejected: 'Not approved',
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m}${hour >= 12 ? 'pm' : 'am'}`
}

export default function ScheduleCalendar({ signups }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(null)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build map of date → signups
  const signupsByDate = {}
  for (const su of signups) {
    const date = su.shift?.date
    if (!date) continue
    if (!signupsByDate[date]) signupsByDate[date] = []
    signupsByDate[date].push(su)
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelected(null)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const todayStr = today.toISOString().split('T')[0]
  const selectedSignups = selected ? (signupsByDate[selected] ?? []) : []

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-600">
            ← Prev
          </button>
          <h2 className="text-lg font-semibold text-stone-800">{monthName}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-600">
            Next →
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-stone-400 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-stone-50 min-h-[80px]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const daySignups = signupsByDate[dateStr] ?? []
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selected
            const hasApproved = daySignups.some(s => s.status === 'approved')
            const hasPending = daySignups.some(s => s.status === 'pending')

            return (
              <div
                key={dateStr}
                onClick={() => daySignups.length > 0 && setSelected(isSelected ? null : dateStr)}
                className={`bg-white min-h-[80px] p-1.5 transition-colors ${
                  daySignups.length > 0 ? 'cursor-pointer hover:bg-green-50' : ''
                } ${isSelected ? 'ring-2 ring-inset ring-green-500' : ''}`}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-green-700 text-white' : 'text-stone-600'
                }`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {daySignups.slice(0, 2).map(su => (
                    <div
                      key={su.id}
                      className={`text-xs px-1 py-0.5 rounded border truncate ${TYPE_COLORS[su.shift.type]}`}
                    >
                      {TYPE_LABELS[su.shift.type]}
                    </div>
                  ))}
                  {daySignups.length > 2 && (
                    <div className="text-xs text-stone-400 pl-1">+{daySignups.length - 2} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <div key={key} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${TYPE_COLORS[key]}`}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      <div className="lg:w-72">
        {selected ? (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
            <h3 className="font-semibold text-stone-800 mb-3">
              {new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <div className="space-y-3">
              {selectedSignups.map(su => (
                <div key={su.id} className={`rounded-lg border-l-4 p-3 bg-white border border-stone-100 ${STATUS_STYLES[su.status]}`}>
                  <div className="font-medium text-sm text-stone-800">{TYPE_LABELS[su.shift.type]}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{fmt12(su.shift.start_time)} – {fmt12(su.shift.end_time)}</div>
                  <div className={`text-xs font-medium mt-1 ${
                    su.status === 'approved' ? 'text-green-700' :
                    su.status === 'pending' ? 'text-amber-700' : 'text-red-600'
                  }`}>
                    {STATUS_LABELS[su.status]}
                  </div>
                  {su.shift.notes && <div className="text-xs text-stone-400 mt-1">{su.shift.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 text-sm text-stone-400 text-center">
            Click a day with shifts to see details
          </div>
        )}
      </div>
    </div>
  )
}
