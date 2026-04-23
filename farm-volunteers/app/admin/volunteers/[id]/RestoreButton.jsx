'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RestoreButton({ volunteerId }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function restore() {
    setLoading(true)
    const res = await fetch('/api/unarchive-volunteer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteerId }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      alert('Failed to restore volunteer')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={restore}
      disabled={loading}
      className="text-xs text-green-700 font-medium hover:underline disabled:opacity-50 transition-colors"
    >
      {loading ? 'Restoring…' : 'Restore to Active'}
    </button>
  )
}
