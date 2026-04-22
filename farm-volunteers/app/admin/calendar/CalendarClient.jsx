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

export default function CalendarClient({ shifts: initial, allVolunteers }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(null)
  const [shifts, setShifts] = useState(initial)

  // Assign volunteer modal
  const [assignShift, setAssignShift] = useState(null)
  const [assignVolId, setAssignVolId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  // Edit shift modal
  const [editShift, setEditShift] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Cancel shift confirm
  const [cancelShiftId, setCancelShiftId] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const shiftsByDate = {}
  for (const s of shifts) {
    if (!shiftsByDate[s.date]) shiftsByDate[s.date] = []
    shiftsByDate[s.date].push(s)
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
    setSelected(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
    setSelected(null)
  }

  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const todayStr = today.toISOString().split('T')[0]
  const selectedShifts = selected ? (shiftsByDate[selected] ?? []) : []

  // ── Assign volunteer ──
  function openAssign(shift) {
    setAssignShift(shift)
    setAssignVolId('')
    setAssignError('')
  }
  async function doAssign() {
    if (!assignVolId) { setAssignError('Please select a volunteer.'); return }
    setAssigning(true); setAssignError('')
    const res = await fetch('/api/assign-volunteer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: assignShift.id, volunteerId: assignVolId }),
    })
    const data = await res.json()
    if (!res.ok) { setAssignError(data.error ?? 'Failed'); setAssigning(false); return }

    const vol = allVolunteers.find(v => v.id === assignVolId)
    setShifts(ss => ss.map(s => s.id === assignShift.id ? {
      ...s,
      approved_count: s.approved_count + 1,
      approved_volunteers: [...s.approved_volunteers, vol?.full_name].filter(Boolean),
      assigned_ids: [...(s.assigned_ids ?? []), assignVolId],
    } : s))
    setAssignShift(null)
    setAssigning(false)
  }

  // ── Edit shift ──
  function openEdit(shift) {
    setEditShift(shift)
    setEditForm({
      start_time: shift.start_time?.slice(0, 5) ?? '',
      end_time:   shift.end_time?.slice(0, 5) ?? '',
      slots_available: shift.slots_available,
      notes: shift.notes ?? '',
    })
    setEditError('')
  }
  async function doEdit() {
    setSaving(true); setEditError('')
    const res = await fetch('/api/update-shift', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: editShift.id, ...editForm }),
    })
    const data = await res.json()
    if (!res.ok) { setEditError(data.error ?? 'Failed to save'); setSaving(false); return }
    setShifts(ss => ss.map(s => s.id === editShift.id ? { ...s, ...data.shift } : s))
    setEditShift(null)
    setSaving(false)
  }

  // ── Cancel shift ──
  async function doCancel() {
    setCancelling(true)
    const res = await fetch('/api/cancel-shift', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: cancelShiftId }),
    })
    if (res.ok) {
      setShifts(ss => ss.filter(s => s.id !== cancelShiftId))
      setCancelShiftId(null)
      // Deselect day if no shifts remain
      const dateOfCancelled = shifts.find(s => s.id === cancelShiftId)?.date
      if (dateOfCancelled) {
        const remaining = shifts.filter(s => s.date === dateOfCancelled && s.id !== cancelShiftId)
        if (remaining.length === 0) setSelected(null)
      }
    }
    setCancelling(false)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Assign Volunteer Modal ── */}
      {assignShift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="font-semibold text-stone-800 text-lg mb-1">Assign Volunteer</h2>
            <p className="text-sm text-stone-500 mb-4">
              {TYPE_LABELS[assignShift.type]} · {new Date(assignShift.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <select
              value={assignVolId}
              onChange={e => setAssignVolId(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select a volunteer…</option>
              {allVolunteers
                .filter(v => !(assignShift.assigned_ids ?? []).includes(v.id))
                .map(v => <option key={v.id} value={v.id}>{v.full_name}</option>)}
            </select>
            {assignError && <p className="text-red-600 text-xs mb-3">{assignError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setAssignShift(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
                Cancel
              </button>
              <button onClick={doAssign} disabled={assigning}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors">
                {assigning ? 'Assigning…' : 'Assign & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Shift Modal ── */}
      {editShift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="font-semibold text-stone-800 text-lg mb-1">Edit Shift</h2>
            <p className="text-sm text-stone-500 mb-4">
              {TYPE_LABELS[editShift.type]} · {new Date(editShift.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Start Time</label>
                  <input type="time" value={editForm.start_time}
                    onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">End Time</label>
                  <input type="time" value={editForm.end_time}
                    onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Slots Available</label>
                <input type="number" min="1" value={editForm.slots_available}
                  onChange={e => setEditForm(f => ({ ...f, slots_available: parseInt(e.target.value) || 1 }))}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Notes</label>
                <textarea rows={2} value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
            </div>
            {editError && <p className="text-red-600 text-xs mt-2">{editError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditShift(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
                Cancel
              </button>
              <button onClick={doEdit} disabled={saving}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Shift Confirm Modal ── */}
      {cancelShiftId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="font-semibold text-stone-800 text-lg mb-2">Cancel this shift?</h2>
            <p className="text-sm text-stone-500 mb-5">
              This will permanently remove the shift and notify any assigned volunteers that it has been cancelled.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelShiftId(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
                Keep Shift
              </button>
              <button onClick={doCancel} disabled={cancelling}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {cancelling ? 'Cancelling…' : 'Yes, Cancel Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar Grid ── */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-600">← Prev</button>
          <h2 className="text-lg font-semibold text-stone-800">{monthName}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-600">Next →</button>
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
            const dayShifts = shiftsByDate[dateStr] ?? []
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selected

            return (
              <div key={dateStr} onClick={() => setSelected(isSelected ? null : dateStr)}
                className={`bg-white min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-green-50 ${isSelected ? 'ring-2 ring-inset ring-green-500' : ''}`}>
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-green-700 text-white' : 'text-stone-600'}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayShifts.slice(0, 2).map(s => {
                    const isFull = s.approved_count >= s.slots_available
                    const hasPending = s.pending_count > 0
                    return (
                      <div key={s.id} className={`text-xs px-1 py-0.5 rounded border truncate flex items-center justify-between gap-1 ${isFull ? 'bg-stone-100 text-stone-400 border-stone-200' : TYPE_COLORS[s.type]}`}>
                        <span className="truncate">{TYPE_LABELS[s.type]}</span>
                        {isFull
                          ? <span className="shrink-0 w-2 h-2 rounded-full bg-green-500" />
                          : hasPending
                          ? <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400" />
                          : <span className="shrink-0 w-2 h-2 rounded-full bg-red-500" />}
                      </div>
                    )
                  })}
                  {dayShifts.length > 2 && <div className="text-xs text-stone-400 pl-1">+{dayShifts.length - 2} more</div>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <div key={key} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${TYPE_COLORS[key]}`}>{label}</div>
          ))}
          <div className="flex items-center gap-3 ml-2 border-l border-stone-200 pl-3">
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Open</div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Pending</div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Full</div>
          </div>
        </div>
      </div>

      {/* ── Side Panel ── */}
      <div className="lg:w-80">
        {selected ? (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
            <h3 className="font-semibold text-stone-800 mb-3">
              {new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {selectedShifts.length === 0 ? (
              <div className="text-sm text-stone-400">No shifts this day.</div>
            ) : (
              <div className="space-y-4">
                {selectedShifts.map(s => {
                  const isFull = s.approved_count >= s.slots_available
                  return (
                    <div key={s.id} className={`rounded-lg border p-3 ${TYPE_COLORS[s.type]}`}>
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="font-medium text-sm">{TYPE_LABELS[s.type]}</div>
                        {isFull && <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-medium shrink-0">Full</span>}
                      </div>
                      <div className="text-xs">{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                      <div className="text-xs mt-0.5">
                        {s.approved_count}/{s.slots_available} filled
                        {s.pending_count > 0 && ` · ${s.pending_count} pending`}
                      </div>

                      {/* Assigned volunteers */}
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

                      {/* Action buttons */}
                      <div className="flex gap-1.5 mt-3 pt-2 border-t border-current border-opacity-20">
                        <button
                          onClick={e => { e.stopPropagation(); openAssign(s) }}
                          className="flex-1 text-xs py-1 px-2 rounded bg-white bg-opacity-60 hover:bg-opacity-100 font-medium transition-colors"
                        >
                          + Assign
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(s) }}
                          className="flex-1 text-xs py-1 px-2 rounded bg-white bg-opacity-60 hover:bg-opacity-100 font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setCancelShiftId(s.id) }}
                          className="flex-1 text-xs py-1 px-2 rounded bg-white bg-opacity-60 hover:bg-opacity-100 font-medium text-red-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )
                })}
                <Link href="/admin/approvals" className="block text-center text-xs text-green-700 hover:underline mt-1">
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
