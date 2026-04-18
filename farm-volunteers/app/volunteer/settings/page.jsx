'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'

export default function NotificationSettings() {
  const [profile, setProfile] = useState(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [router])

  async function handleSave(e) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({
        email_notifications: profile.email_notifications,
        sms_notifications: profile.sms_notifications,
      })
      .eq('id', profile.id)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!profile) return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">Loading...</div>

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar role="volunteer" name={profile.full_name} />
      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Notification Settings</h1>

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              Settings saved.
            </div>
          )}

          <div className="space-y-4">
            <Toggle
              label="Email notifications"
              description="Get emailed when new shifts are posted and when your sign-up is approved."
              checked={profile.email_notifications}
              onChange={v => setProfile(p => ({ ...p, email_notifications: v }))}
            />
            <Toggle
              label="SMS text notifications"
              description="Get a text message when new shifts are available and reminders before your shift."
              checked={profile.sms_notifications}
              onChange={v => setProfile(p => ({ ...p, sms_notifications: v }))}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </main>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-4 cursor-pointer">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <div
          className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-stone-300'}`}
          onClick={() => onChange(!checked)}
        >
          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800">{label}</p>
        <p className="text-xs text-stone-500 mt-0.5">{description}</p>
      </div>
    </label>
  )
}
