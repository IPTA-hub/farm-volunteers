'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '', invite_code: '' })
  const [smsConsent, setSmsConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    if (form.phone && !smsConsent) {
      setError('Please check the SMS consent box to receive shift reminders, or remove your phone number to skip SMS.')
      setLoading(false)
      return
    }

    // Validate invite code first
    const inviteRes = await fetch('/api/validate-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: form.invite_code }),
    })
    const inviteData = await inviteRes.json()
    if (!inviteRes.ok) {
      setError(inviteData.error ?? 'Invalid invite code.')
      setLoading(false)
      return
    }

    // Create account
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, phone: form.phone },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data?.user) {
      await fetch('/api/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          full_name: form.full_name,
          phone: form.phone,
        }),
      })
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-amber-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-green-900">Create Volunteer Account</h1>
          <p className="text-stone-500 mt-1 text-sm">Iron Horse Therapeutic Farm</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Invite code — first so it's the first gate */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Invite Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.invite_code}
              onChange={set('invite_code')}
              required
              placeholder="Provided by Iron Horse staff"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-stone-400 mt-1">Don't have one? Contact us at ironhorsetherapy.org</p>
          </div>

          <div className="border-t border-stone-100 pt-4">
            <label className="block text-sm font-medium text-stone-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={set('full_name')}
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Phone Number <span className="text-stone-400 font-normal">(for SMS reminders)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+1 555 000 0000"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* SMS consent — shown whenever a phone number is entered */}
          {form.phone && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={e => setSmsConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-500 shrink-0"
                />
                <span className="text-xs text-stone-600 leading-relaxed">
                  I consent to receive SMS text messages from <strong>Iron Horse Therapeutic Farm</strong> for shift
                  reminders, schedule confirmations, and volunteer coordination. Message frequency varies.
                  Message &amp; data rates may apply. Reply <strong>STOP</strong> to opt out at any time.{' '}
                  <a
                    href="https://www.ironhorsetherapy.org/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 underline"
                  >
                    Privacy Policy
                  </a>
                  {' · '}
                  <a
                    href="https://www.ironhorsetherapy.org/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 underline"
                  >
                    Terms
                  </a>
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={6}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={set('confirm')}
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-green-700 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
