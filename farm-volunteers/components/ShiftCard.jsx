import ShiftTypeTag from './ShiftTypeTag'

function fmt12(time) {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${ampm}`
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function ShiftCard({ shift, footer }) {
  const slotsLeft = shift.slots_left ?? shift.slots_available

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <ShiftTypeTag type={shift.type} />
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          slotsLeft > 0 ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-500'
        }`}>
          {slotsLeft > 0 ? `${slotsLeft} spot${slotsLeft !== 1 ? 's' : ''} open` : 'Full'}
        </span>
      </div>

      <p className="font-semibold text-stone-800">{fmtDate(shift.date)}</p>
      <p className="text-sm text-stone-500 mt-0.5">{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</p>

      {shift.notes && (
        <p className="text-sm text-stone-600 mt-3 border-t border-stone-100 pt-3">{shift.notes}</p>
      )}

      {footer && <div className="mt-4">{footer}</div>}
    </div>
  )
}
