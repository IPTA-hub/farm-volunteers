const TYPE_CONFIG = {
  sidewalking:    { label: 'Sidewalking',    color: 'bg-blue-100 text-blue-800 ring-blue-200' },
  horse_assisting:{ label: 'Horse Assisting',color: 'bg-amber-100 text-amber-800 ring-amber-200' },
  events:         { label: 'Events',         color: 'bg-purple-100 text-purple-800 ring-purple-200' },
  weekend_care:   { label: 'Weekend Care',   color: 'bg-green-100 text-green-800 ring-green-200' },
}

export default function ShiftTypeTag({ type }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, color: 'bg-stone-100 text-stone-700 ring-stone-200' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}
