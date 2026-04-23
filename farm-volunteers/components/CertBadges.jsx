const CERT_CONFIG = {
  sidewalking: {
    label: 'Sidewalk Certified',
    short: 'Sidewalk',
    color: 'bg-blue-100 text-blue-800 ring-blue-200',
    icon: '🐴',
  },
  horse_assisting: {
    label: 'Horse Assisting Certified',
    short: 'Horse Assist',
    color: 'bg-amber-100 text-amber-800 ring-amber-200',
    icon: '🐎',
  },
  weekend_care: {
    label: 'Weekend Care Certified',
    short: 'Weekend Care',
    color: 'bg-green-100 text-green-800 ring-green-200',
    icon: '🌿',
  },
}

// Full badges — used on profile pages
export function CertBadges({ certifications = [] }) {
  if (!certifications.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {certifications.map(type => {
        const cfg = CERT_CONFIG[type]
        if (!cfg) return null
        return (
          <span
            key={type}
            title={cfg.label}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${cfg.color}`}
          >
            <span>{cfg.icon}</span>
            {cfg.short}
            <span className="text-green-600 font-bold ml-0.5">✓</span>
          </span>
        )
      })}
    </div>
  )
}

// Compact icon-only badges — used in table rows
export function CertBadgesCompact({ certifications = [] }) {
  if (!certifications.length) return null
  return (
    <div className="flex gap-1">
      {certifications.map(type => {
        const cfg = CERT_CONFIG[type]
        if (!cfg) return null
        return (
          <span
            key={type}
            title={cfg.label}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ring-1 ring-inset ${cfg.color}`}
          >
            {cfg.icon}
          </span>
        )
      })}
    </div>
  )
}
