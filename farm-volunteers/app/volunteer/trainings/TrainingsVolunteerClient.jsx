'use client'
import { useState } from 'react'

const TRAINING_TYPES = [
  {
    value: 'sidewalking',
    label: 'Sidewalk Safety Training',
    shift: 'Sidewalking shifts',
    color: 'bg-blue-100 text-blue-800 ring-blue-200',
    icon: '🐴',
  },
  {
    value: 'horse_assisting',
    label: 'Horse Assisting Safety Training',
    shift: 'Horse Assisting shifts',
    color: 'bg-amber-100 text-amber-800 ring-amber-200',
    icon: '🐎',
  },
  {
    value: 'weekend_care',
    label: 'Weekend Care Training',
    shift: 'Weekend Care shifts',
    color: 'bg-green-100 text-green-800 ring-green-200',
    icon: '🌿',
  },
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
function fmtShort(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TrainingsVolunteerClient({ sessions, certifications, certSet: initialCertSet, regMap: initialRegMap, userId }) {
  const [certSet, setCertSet] = useState(new Set(initialCertSet))
  const [regMap, setRegMap] = useState(initialRegMap)
  const [loading, setLoading] = useState({})
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function register(sessionId) {
    setLoading(l => ({ ...l, [sessionId]: true }))
    const res = await fetch('/api/register-training', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error ?? 'Failed to register', 'error')
    } else {
      setRegMap(m => ({ ...m, [sessionId]: 'registered' }))
      showToast("You're registered! Check your phone for a confirmation text.")
    }
    setLoading(l => ({ ...l, [sessionId]: false }))
  }

  async function cancelReg(sessionId) {
    setLoading(l => ({ ...l, [sessionId]: true }))
    // Update via supabase directly (volunteer can update their own)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase
      .from('training_registrations')
      .update({ status: 'cancelled' })
      .eq('session_id', sessionId)
      .eq('volunteer_id', userId)
    setRegMap(m => ({ ...m, [sessionId]: 'cancelled' }))
    showToast('Registration cancelled.')
    setLoading(l => ({ ...l, [sessionId]: false }))
  }

  const certList = certifications ?? []

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

      {/* My Certifications */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">My Certifications</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TRAINING_TYPES.map(t => {
            const certified = certSet.has(t.value)
            const certRecord = certList.find(c => c.training_type === t.value)
            return (
              <div key={t.value} className={`rounded-xl border p-4 ${certified ? 'border-green-200 bg-green-50' : 'border-stone-200 bg-white'}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{t.icon}</span>
                  {certified
                    ? <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">Certified ✓</span>
                    : <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">🔒 Required</span>
                  }
                </div>
                <p className={`text-sm font-semibold ${certified ? 'text-green-800' : 'text-stone-700'}`}>{t.label}</p>
                <p className={`text-xs mt-1 ${certified ? 'text-green-600' : 'text-stone-400'}`}>
                  {certified
                    ? `Unlocks ${t.shift}${certRecord?.certified_at ? ` · ${fmtShort(certRecord.certified_at)}` : ''}`
                    : `Required for ${t.shift}`}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Training Sessions */}
      <div>
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Upcoming Training Sessions</h2>
        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-6 text-center">
            <p className="text-stone-400 text-sm">No training sessions are scheduled right now.</p>
            <p className="text-stone-400 text-sm mt-1">Check back soon — you'll be notified when new sessions are posted.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => {
              const typeConfig = TRAINING_TYPES.find(t => t.value === s.training_type)
              const regCount = s.registrations?.filter(r => r.status === 'registered').length ?? 0
              const spotsLeft = s.capacity - regCount
              const myStatus = regMap[s.id]
              const alreadyCertified = certSet.has(s.training_type)

              return (
                <div key={s.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${typeConfig?.color}`}>
                          {typeConfig?.icon} {typeConfig?.label}
                        </span>
                        {alreadyCertified && (
                          <span className="text-xs bg-green-50 text-green-700 ring-1 ring-green-200 px-2 py-0.5 rounded-full font-medium">Already certified</span>
                        )}
                        {spotsLeft <= 0 && (
                          <span className="text-xs bg-red-50 text-red-600 ring-1 ring-red-200 px-2 py-0.5 rounded-full font-medium">Full</span>
                        )}
                      </div>
                      <p className="font-semibold text-stone-800">{fmtDate(s.date)}</p>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {fmt12(s.start_time)} – {fmt12(s.end_time)}
                        {s.location ? ` · ${s.location}` : ''}
                      </p>
                      <p className="text-xs text-stone-400 mt-1">{spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining` : 'No spots left'}</p>
                      {s.notes && <NotesWithLinks text={s.notes} />}
                    </div>

                    <div className="shrink-0 min-w-[120px]">
                      {myStatus === 'registered' ? (
                        <div className="space-y-2">
                          <p className="text-xs text-center font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg py-1.5 px-3">Registered ✓</p>
                          <button onClick={() => cancelReg(s.id)} disabled={loading[s.id]}
                            className="w-full text-xs text-stone-400 hover:text-red-600 transition-colors">
                            Cancel registration
                          </button>
                        </div>
                      ) : myStatus === 'attended' ? (
                        <p className="text-xs text-center font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg py-1.5 px-3">Attended ✓</p>
                      ) : alreadyCertified ? (
                        <p className="text-xs text-center font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg py-1.5 px-3">Certified ✓</p>
                      ) : spotsLeft <= 0 ? (
                        <p className="text-xs text-center text-stone-400">Full</p>
                      ) : (
                        <button onClick={() => register(s.id)} disabled={loading[s.id]}
                          className="w-full bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors">
                          {loading[s.id] ? 'Registering…' : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function NotesWithLinks({ text }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return (
    <div className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-green-700 underline font-medium break-all hover:text-green-800">
            {part}
          </a>
        ) : part
      )}
    </div>
  )
}
