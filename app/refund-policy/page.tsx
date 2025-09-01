import PageNavigation from '@/components/PageNavigation'

export const metadata = {
  title: 'Refund Policy | PromptOK',
  description: 'Refund policy template describing eligibility, timelines, and how to request a refund.'
}

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Refund Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a template. Replace placeholders with your actual policy and legal language.
        </p>
      </header>

      <article className="prose prose-neutral max-w-none dark:prose-invert">
        <h2>1. Overview</h2>
        <p>
          Briefly explain your refund approach (e.g., satisfaction guarantee, conditions, and exclusions).
        </p>

        <h2>2. Eligibility</h2>
        <ul>
          <li>Time window for requesting a refund (e.g., within 14 days of purchase)</li>
          <li>Eligible plans/products</li>
          <li>Ineligible cases (e.g., abuse, excessive usage, promotional credits)</li>
        </ul>

        <h2>3. How to Request</h2>
        <ol>
          <li>Contact support at <a href="mailto:billing@yourdomain.com">billing@yourdomain.com</a></li>
          <li>Include order ID, account email, and reason</li>
          <li>Allow X business days for review</li>
        </ol>

        <h2>4. Processing & Timelines</h2>
        <p>
          State processing time (e.g., refunds processed within 5–10 business days) and note bank/card delays.
        </p>

        <h2>5. Partial Refunds & Prorations</h2>
        <p>
          Define rules for partial refunds, mid-cycle cancellations, and prorations.
        </p>

        <h2>6. Chargebacks</h2>
        <p>
          Explain how you handle chargebacks and the preferred resolution path via support.
        </p>

        <h2>7. Contact</h2>
        <p>
          Billing questions: <a href="mailto:billing@yourdomain.com">billing@yourdomain.com</a>
        </p>

        <p className="text-sm text-muted-foreground mt-8">Last updated: {new Date().toLocaleDateString()}</p>
      </article>

      <PageNavigation />
    </main>
  )
}
