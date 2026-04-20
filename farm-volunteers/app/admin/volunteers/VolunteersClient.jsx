'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function VolunteersClient({ volunteers }) {
  const [search, setSearch] = useState('')

  const filtered = volunteers.filter(v =>
    v.full_name.toLowerCase().includes(search.toLowerCase())
  )

  function exportCSV() {
    const rows = [
      ['Rank', 'Name', 'Phone', 'Total Hours', 'This Year', 'This Month', 'Shifts'],
      ...volunteers.map((v, i) => [
        i + 1,
        v.full_name,
        v.phone ?? '',
        v.totalHours,
        v.yearHours,
        v.monthHours,
        v.shiftCount,
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `volunteer-hours-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalAllHours = volunteers.reduce((sum, v) => sum + v.totalHours, 0)

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Volunteers" value={volunteers.length} />
        <StatCard label="Total Hours Logged" value={totalAllHours.toFixed(1)} />
        <StatCard label="Avg Hours / Volunteer" value={volunteers.length ? (totalAllHours / volunteers.length).toFixed(1) : 0} />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search volunteers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={exportCSV}
          className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors font-medium"
        >
          Export CSV
        </button>
      </div>

      {/* Leaderboard table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Rank</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Volunteer</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">This Month</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">This Year</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">All Time</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Shifts</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-stone-400 text-sm">No volunteers found.</td>
              </tr>
            ) : filtered.map((v, i) => (
              <tr key={v.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-stone-100 text-stone-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'text-stone-400'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-800">{v.full_name}</div>
                  {v.phone && <div className="text-xs text-stone-400">{v.phone}</div>}
                </td>
                <td className="px-4 py-3 text-right text-stone-600">{v.monthHours}h</td>
                <td className="px-4 py-3 text-right text-stone-600">{v.yearHours}h</td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">{v.totalHours}h</td>
                <td className="px-4 py-3 text-right text-stone-500">{v.shiftCount}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/volunteers/${v.id}`} className="text-xs text-green-700 hover:underline">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <p className="text-3xl font-bold text-green-700">{value}</p>
      <p className="text-sm text-stone-500 mt-1">{label}</p>
    </div>
  )
}
