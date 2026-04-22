'use client'
import { useState } from 'react'

const TRAINING_TYPES = [
  { value: 'sidewalking',     label: 'Sidewalk Safety Training',        color: 'bg-blue-100 text-blue-800 ring-blue-200' },
  { value: 'horse_assisting', label: 'Horse Assisting Safety Training', color: 'bg-amber-100 text-amber-800 ring-amber-200' },
  { value: 'weekend_care',    label: 'Weekend Care Training',           color: 'bg-green-100 text-green-800 ring-green-200' },
]

const UNLOCKS = {
  sidewalking:     'Sidewalking shifts',
  horse_assisting: 'Horse Assisting shifts',
  weekend_care:    'Weekend Care shifts',
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}
function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TypeBadge({ type }) {
  const cfg = TRAINING_TYPES.find(t => t.value === type) ?? { label: type, color: 'bg-stone-100 text-stone-700 ring-stone-200' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export default function TrainingsAdminClient({ sessions: initial, certifications: initialCerts, allVolunteers, today, adminId }) {
  const [tab, setTab] = useState('sessions')
  const [sessions, setSessions] = useState(initial)
  const [certifications, setCertifications] = useState(initialCerts)

  // New session form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ training_type: 'sidewalking', date: '', start_time: '', end_time: '', location: '', capacity: 10, notes: '' })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  // Mark attendance modal
  const [attendanceSession, setAttendanceSession] = useState(null)
  const [checked, setChecked] = useState({})
  const [saving, setSaving] = useState(false)

  // Manual certify
  const [showManualCert, setShowManualCert] = useState(false)
  const [manualCertType, setManualCertType] = useState('sidewalking')
  const [manualCertVolunteer, setManualCertVolunteer] = useState('')
  const [manualCertSaving, setManualCertSaving] = useState(false)

  const upcoming = sessions.filter(s => s.date >= today)
  const past = sessions.filter(s => s.date < today)

  async function createSession() {
    if (!form.date || !form.start_time || !form.end_time) { setFormError('Date and times are required.'); return }
    setCreating(true); setFormError('')
    const res = await fetch('/api/create-training-session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error ?? 'Failed to create'); setCreating(false); return }
    setSessions(s => [...s, { ...data.session, registrations: [] }].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)))
    setForm({ training_type: 'sidewalking', date: '', start_time: '', end_time: '', location: '', capacity: 10, notes: '' })
    setShowForm(false)
    setCreating(false)
  }

  function openAttendance(session) {
    const pre = {}
    for (const r of session.registrations ?? []) {
      if (r.status === 'registered' || r.status === 'attended') pre[r.volunteer.id] = true
    }
    setChecked(pre)
    setAttendanceSession(session)
  }

  async function saveAttendance() {
    const attendeeIds = Object.entries(checked).filter(([, v]) => v).map(([id]) => id)
    setSaving(true)
    const res = await fetch('/api/mark-training-attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: attendanceSession.id, attendeeIds }),
    })
    if (res.ok) {
      // Refresh page data locally — mark attended
      setSessions(s => s.map(sess => sess.id === attendanceSession.id
        ? { ...sess, registrations: sess.registrations.map(r => attendeeIds.includes(r.volunteer.id) ? { ...r, status: 'attended' } : r) }
        : sess
      ))
      // Add new certs locally
      const newCerts = attendeeIds
        .filter(id => !certifications.some(c => c.volunteer_id === id && c.training_type === attendanceSession.training_type))
        .map(id => {
          const vol = allVolunteers.find(v => v.id === id)
          return { volunteer_id: id, training_type: attendanceSession.training_type, certified_at: new Date().toISOString(), volunteer: vol }
        })
      setCertifications(c => [...newCerts, ...c])
      setAttendanceSession(null)
    }
    setSaving(false)
  }

  async function manualCertify() {
    if (!manualCertVolunteer) return
    setManualCertSaving(true)
    const res = await fetch('/api/manual-certify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteerId: manualCertVolunteer, trainingType: manualCertType }),
    })
    const data = await res.json()
    if (res.ok && data.volunteer) {
      const alreadyExists = certifications.some(
        c => c.volunteer_id === manualCertVolunteer && c.training_type === manualCertType
      )
      if (!alreadyExists) {
        setCertifications(c => [{
          id: Date.now().toString(),
          volunteer_id: manualCertVolunteer,
          training_type: manualCertType,
          certified_at: new Date().toISOString(),
          volunteer: data.volunteer,
        }, ...c])
      }
      setManualCertVolunteer('')
      setManualCertType('sidewalking')
      setShowManualCert(false)
    } else {
      alert(data.error ?? 'Failed to certify volunteer')
    }
    setManualCertSaving(false)
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[['sessions', 'Training Sessions'], ['certified', 'Certified Volunteers']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === v ? 'bg-green-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── SESSIONS TAB ── */}
      {tab === 'sessions' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowForm(f => !f)}
              className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors">
              {showForm ? 'Cancel' : '+ New Training Session'}
            </button>
          </div>

          {/* New session form */}
          {showForm && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 mb-6">
              <h2 className="font-semibold text-stone-800 mb-4">New Training Session</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-600 mb-1">Training Type</label>
                  <select value={form.training_type} onChange={e => setForm(f => ({ ...f, training_type: e.target.value }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {TRAINING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Capacity</label>
                  <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 10 }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Start Time</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">End Time</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-600 mb-1">Location</label>
                  <input type="text" placeholder="e.g. Barn A, Main Arena" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-600 mb-1">Notes (optional)</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>
              </div>
              {formError && <p className="text-red-600 text-sm mt-2">{formError}</p>}
              <div className="flex justify-end mt-4">
                <button onClick={createSession} disabled={creating}
                  className="px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors">
                  {creating ? 'Creating…' : 'Create Session'}
                </button>
              </div>
            </div>
          )}

          {/* Upcoming sessions */}
          <SessionGroup title="Upcoming" sessions={upcoming} onMarkAttendance={openAttendance} />

          {/* Past sessions */}
          {past.length > 0 && <SessionGroup title="Past" sessions={past} onMarkAttendance={openAttendance} />}

          {sessions.length === 0 && !showForm && (
            <p className="text-stone-400 text-sm text-center py-8">No training sessions yet. Create one to get started.</p>
          )}
        </div>
      )}

      {/* ── CERTIFIED VOLUNTEERS TAB ── */}
      {tab === 'certified' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowManualCert(f => !f)}
              className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors">
              {showManualCert ? 'Cancel' : '+ Manually Certify Volunteer'}
            </button>
          </div>

          {/* Manual certify form */}
          {showManualCert && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 mb-6">
              <h2 className="font-semibold text-stone-800 mb-4">Manually Certify a Volunteer</h2>
              <p className="text-sm text-stone-500 mb-4">Use this for volunteers who completed training outside the app.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Volunteer</label>
                  <select value={manualCertVolunteer} onChange={e => setManualCertVolunteer(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Select volunteer…</option>
                    {allVolunteers.map(v => <option key={v.id} value={v.id}>{v.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Training Type</label>
                  <select value={manualCertType} onChange={e => setManualCertType(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {TRAINING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={manualCertify} disabled={!manualCertVolunteer || manualCertSaving}
                  className="px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors">
                  {manualCertSaving ? 'Saving…' : 'Certify Volunteer'}
                </button>
              </div>
            </div>
          )}

          {TRAINING_TYPES.map(type => {
            const typeCerts = certifications.filter(c => c.training_type === type.value)
            return (
              <div key={type.value} className="bg-white rounded-xl border border-stone-200 shadow-sm mb-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TypeBadge type={type.value} />
                    <span className="text-sm text-stone-500">unlocks {UNLOCKS[type.value]}</span>
                  </div>
                  <span className="text-sm font-medium text-stone-700">{typeCerts.length} certified</span>
                </div>
                {typeCerts.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-stone-400">No volunteers certified yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {typeCerts.map(c => (
                      <li key={c.id} className="px-6 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-stone-800">{c.volunteer?.full_name}</p>
                          {c.volunteer?.phone && <p className="text-xs text-stone-400">{c.volunteer.phone}</p>}
                        </div>
                        <span className="text-xs text-stone-400">Certified {fmtDateTime(c.certified_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── MARK ATTENDANCE MODAL ── */}
      {attendanceSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-stone-100">
              <h2 className="font-semibold text-stone-800 text-lg">Mark Attendance</h2>
              <p className="text-sm text-stone-500 mt-1">
                {TRAINING_TYPES.find(t => t.value === attendanceSession.training_type)?.label}
              </p>
              <p className="text-sm text-stone-500">{fmtDate(attendanceSession.date)} · {fmt12(attendanceSession.start_time)} – {fmt12(attendanceSession.end_time)}</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-xs font-medium text-stone-500 uppercase mb-3">Check everyone who attended</p>

              {/* Pre-registered volunteers */}
              {attendanceSession.registrations?.filter(r => r.status !== 'cancelled').length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-stone-400 mb-2">Registered</p>
                  <div className="space-y-2">
                    {attendanceSession.registrations
                      .filter(r => r.status !== 'cancelled')
                      .map(r => (
                        <label key={r.volunteer.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-stone-50 cursor-pointer">
                          <input type="checkbox" checked={!!checked[r.volunteer.id]} onChange={e => setChecked(c => ({ ...c, [r.volunteer.id]: e.target.checked }))}
                            className="w-4 h-4 rounded accent-green-700" />
                          <span className="text-sm text-stone-800">{r.volunteer.full_name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {/* Walk-ins — all other volunteers */}
              {(() => {
                const regIds = new Set((attendanceSession.registrations ?? []).map(r => r.volunteer.id))
                const walkIns = allVolunteers.filter(v => !regIds.has(v.id))
                return walkIns.length > 0 ? (
                  <div>
                    <p className="text-xs text-stone-400 mb-2">Walk-ins (not pre-registered)</p>
                    <div className="space-y-2">
                      {walkIns.map(v => (
                        <label key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-stone-50 cursor-pointer">
                          <input type="checkbox" checked={!!checked[v.id]} onChange={e => setChecked(c => ({ ...c, [v.id]: e.target.checked }))}
                            className="w-4 h-4 rounded accent-green-700" />
                          <span className="text-sm text-stone-800">{v.full_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}

              {(attendanceSession.registrations?.length === 0 && allVolunteers.length === 0) && (
                <p className="text-stone-400 text-sm">No volunteers to show.</p>
              )}
            </div>

            <div className="p-6 border-t border-stone-100 flex gap-3">
              <button onClick={() => setAttendanceSession(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
                Cancel
              </button>
              <button onClick={saveAttendance} disabled={saving}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : `Save & Certify (${Object.values(checked).filter(Boolean).length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionGroup({ title, sessions, onMarkAttendance }) {
  if (sessions.length === 0) return null
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">{title}</h2>
      <div className="space-y-3">
        {sessions.map(s => {
          const regCount = s.registrations?.filter(r => r.status === 'registered').length ?? 0
          const attendedCount = s.registrations?.filter(r => r.status === 'attended').length ?? 0
          const isFull = regCount >= s.capacity
          return (
            <div key={s.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <TypeBadge type={s.training_type} />
                    {isFull && <span className="text-xs bg-red-100 text-red-700 ring-1 ring-red-200 px-2 py-0.5 rounded-full font-medium">Full</span>}
                    {attendedCount > 0 && <span className="text-xs bg-green-100 text-green-700 ring-1 ring-green-200 px-2 py-0.5 rounded-full font-medium">{attendedCount} certified</span>}
                  </div>
                  <p className="font-semibold text-stone-800">{new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  <p className="text-sm text-stone-500 mt-0.5">{fmt12(s.start_time)} – {fmt12(s.end_time)}{s.location ? ` · ${s.location}` : ''}</p>
                  <p className="text-sm text-stone-400 mt-0.5">{regCount} / {s.capacity} registered</p>
                  {s.notes && <p className="text-sm text-stone-500 mt-1 italic">{s.notes}</p>}
                </div>
                <button onClick={() => onMarkAttendance(s)}
                  className="shrink-0 px-4 py-2 text-sm font-medium border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors">
                  Mark Attendance
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
