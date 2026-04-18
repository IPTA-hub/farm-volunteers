import './globals.css'

export const metadata = {
  title: 'Farm Volunteer Portal',
  description: 'Volunteer shift scheduling for therapeutic farm',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 min-h-screen text-stone-800 antialiased">
        {children}
      </body>
    </html>
  )
}
