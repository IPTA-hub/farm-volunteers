'use client'
import { useState } from 'react'
import Link from 'next/link'

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

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m}${hour >= 12 ? 'pm' : 'am'}`
}

export default function CalendarClient({ shifts }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(null)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const shiftsByDate = {}
  for (const s of shifts) {
    if (!shiftsByDate[s.date]) shiftsByDate[s.date] = []
    shiftsByDate[s.date].push(s)
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

  const selectedShifts = selected ? (shiftsByDate[selected] ?? []) : []

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Calendar grid */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-600">
            ← Prev
          </button>
          <h2 className="text-lg font-semibold text-stone-800">{monthName}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-600">
            Next →
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-stone-400 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-stone-50 min-h-[80px]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const dayShifts = shiftsByDate[dateStr] ?? []
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selected

            return (
              <div
                key={dateStr}
                onClick={() => setSelected(isSelected ? null : dateStr)}
                className={`bg-white min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-green-50 ${
                  isSelected ? 'ring-2 ring-inset ring-green-500' : ''
                }`}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-green-700 text-white' : 'text-stone-600'
                }`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayShifts.slice(0, 2).map(s => {
                    const isFull = s.approved_count >= s.slots_available
                    const hasPending = s.pending_count > 0
                    return (
                      <div
                        key={s.id}
                        className={`text-xs px-1 py-0.5 rounded border truncate flex items-center justify-between gap-1 ${
                          isFull
                            ? 'bg-stone-100 text-stone-400 border-stone-200'
                            : TYPE_COLORS[s.type]
                        }`}
                      >
                        <span className="truncate">{TYPE_LABELS[s.type]}</span>
                        {isFull
                          ? <span className="shrink-0 w-2 h-2 rounded-full bg-green-500" title="Full" />
                          : hasPending
                          ? <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400" title="Has pending" />
                          : <span className="shrink-0 w-2 h-2 rounded-full bg-red-500" title="Open" />
                        }
                      </div>
                    )
                  })}
                  {dayShifts.length > 2 && (
                    <div className="text-xs text-stone-400 pl-1">+{dayShifts.length - 2} more</div>
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
          <div className="flex items-center gap-3 ml-2 border-l border-stone-200 pl-3">
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Open</div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Pending</div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Full</div>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <div className="lg:w-72">
        {selected ? (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
            <h3 className="font-semibold text-stone-800 mb-3">
              {new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {selectedShifts.length === 0 ? (
              <div className="text-sm text-stone-400">No shifts this day.</div>
            ) : (
              <div className="space-y-3">
                {selectedShifts.map(s => {
                  const isFull = s.approved_count >= s.slots_available
                  return (
                    <div key={s.id} className={`rounded-lg border p-3 ${TYPE_COLORS[s.type]}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">{TYPE_LABELS[s.type]}</div>
                        {isFull && (
                          <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            Full
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5">{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                      <div className="text-xs mt-1">
                        {s.approved_count}/{s.slots_available} filled
                        {s.pending_count > 0 && ` · ${s.pending_count} pending`}
                      </div>
                      {s.approved_volunteers?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-current border-opacity-20 space-y-1">
                          {s.approved_volunteers.map((name, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs">
                              <span className="text-green-600 font-bold">✓</span>
                              <span>{name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {s.notes && <div className="text-xs mt-1.5 opacity-70 italic">{s.notes}</div>}
                    </div>
                  )
                })}
                <Link
                  href="/admin/approvals"
                  className="block text-center text-xs text-green-700 hover:underline mt-2"
                >
                  View approvals →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 text-sm text-stone-400 text-center">
            Click a day to see shifts
          </div>
        )}
      </div>
    </div>
  )
}
