import ContactForm from '@/components/ContactForm'
import PageNavigationClient from '@/components/PageNavigationClient'

// Route Segment Options
export const revalidate = 3600; // 1h - contact info may be updated occasionally
export const dynamic = 'force-static';

export const metadata = {
  title: 'Contact & Support | PromptOK',
  description: 'Get in touch with PromptOK support. Find contact information and support request options.'
}

export default function ContactSupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Contact & Customer Support</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This template provides common sections you can customize. Replace placeholders with your actual details.
        </p>
      </header>

      <section className="space-y-8">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-medium">Support Channels</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li>
              Email: <a className="text-blue-600 underline hover:text-blue-700" href="mailto:support@yourdomain.com">support@yourdomain.com</a>
            </li>
            <li>
              Business Hours: Mon–Fri, 9:00–18:00 [Your Timezone]
            </li>
            <li>
              Average Response Time: 24–48 hours
            </li>
          </ul>
        </div>

        <ContactForm />

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-medium">Status & Incidents</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If you maintain a status page, link it here.
          </p>
          <ul className="mt-3 list-disc pl-6 text-sm text-muted-foreground">
            <li>Status page: <a className="text-primary underline" href="#">https://status.yourdomain.com</a></li>
            <li>Twitter/X updates: <a className="text-primary underline" href="#">@yourhandle</a></li>
          </ul>
        </div>
      </section>
      
      <PageNavigationClient />
    </main>
  )
}
