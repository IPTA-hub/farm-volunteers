import { NextResponse } from 'next/server'

export async function POST(request) {
  const { code } = await request.json()
  const valid = process.env.INVITE_CODE

  if (!valid) {
    return NextResponse.json({ error: 'Invite codes are not configured.' }, { status: 500 })
  }

  if (!code || code.trim().toLowerCase() !== valid.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Invalid invite code. Please contact Iron Horse to receive one.' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
