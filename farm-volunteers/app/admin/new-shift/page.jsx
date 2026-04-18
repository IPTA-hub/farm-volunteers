'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'

const SHIFT_TYPES = [
  { value: 'sidewalking',     label: 'Sidewalking' },
  { value: 'horse_assisting', label: 'Horse Assisting' },
  { value: 'events',          label: 'Events' },
  { value: 'weekend_care',    label: 'Weekend Care' },
]

export default function NewShiftPage() {
  const [form, setForm] = useState({
    type: 'sidewalking',
    date: '',
    start_time: '',
    end_time: '',
    slots_available: 1,
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const router = useRouter()

  // Load profile once on mount to get name for navbar
  useState(() => {
    createClient()
      .from('profiles')
      .select('full_name, role')
      .single()
      .then(({ data }) => setProfile(data))
  })

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: shift, error: insertError } = await supabase
      .from('shifts')
      .insert({ ...form, slots_available: Number(form.slots_available), created_by: user.id })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Fire-and-forget: notify all volunteers
    fetch('/api/notify-new-shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notifications-secret': process.env.NEXT_PUBLIC_NOTIFICATIONS_SECRET ?? '' },
      body: JSON.stringify({ shiftId: shift.id }),
    }).catch(() => {})

    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="admin" name={profile?.full_name ?? ''} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Post New Shift</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Volunteer Type</label>
            <div className="grid grid-cols-2 gap-2">
              {SHIFT_TYPES.map(t => (
                <label
                  key={t.value}
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors text-sm ${
                    form.type === t.value
                      ? 'border-green-600 bg-green-50 text-green-800 font-medium'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={form.type === t.value}
                    onChange={set('type')}
                    className="accent-green-700"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={set('date')}
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={set('start_time')}
                required
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={set('end_time')}
                required
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Volunteer Spots Available</label>
            <input
              type="number"
              min={1}
              max={50}
              value={form.slots_available}
              onChange={set('slots_available')}
              required
              className="w-32 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Notes <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              placeholder="Any special instructions, attire, or requirements..."
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Posting...' : 'Post Shift & Notify Volunteers'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
