import PageNavigationClient from '@/components/PageNavigationClient'

// Route Segment Options
export const revalidate = 3600; // 1h - FAQ content may be updated more frequently
export const dynamic = 'force-static';

export const metadata = {
  title: 'FAQ | PromptOK',
  description: 'Frequently asked questions about PromptOK. Find quick answers to common questions.'
}

export default function FAQPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Frequently Asked Questions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a starter template. Replace the placeholders below with your actual content.
        </p>
      </header>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-medium">General</h2>
          <div className="mt-4 divide-y rounded-lg border">
            <details className="group p-4" open>
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-medium">What is PromptOK?</span>
                <span className="text-sm text-muted-foreground">(click to toggle)</span>
              </summary>
              <div className="mt-2 text-sm text-muted-foreground">
                Replace this with a concise description of your product/service.
              </div>
            </details>

            <details className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-medium">How do I create an account?</span>
                <span className="text-sm text-muted-foreground">(click to toggle)</span>
              </summary>
              <div className="mt-2 text-sm text-muted-foreground">
                Outline the signup steps and include links where appropriate.
              </div>
            </details>

            <details className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-medium">Is there a free plan?</span>
                <span className="text-sm text-muted-foreground">(click to toggle)</span>
              </summary>
              <div className="mt-2 text-sm text-muted-foreground">
                Describe your pricing tiers or link to pricing page.
              </div>
            </details>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-medium">Billing & Subscription</h2>
          <div className="mt-4 divide-y rounded-lg border">
            <details className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-medium">How do I update my payment method?</span>
                <span className="text-sm text-muted-foreground">(click to toggle)</span>
              </summary>
              <div className="mt-2 text-sm text-muted-foreground">
                Provide steps and where to find billing settings in your app.
              </div>
            </details>

            <details className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-medium">How do I cancel my subscription?</span>
                <span className="text-sm text-muted-foreground">(click to toggle)</span>
              </summary>
              <div className="mt-2 text-sm text-muted-foreground">
                Explain cancellation process and any notice periods.
              </div>
            </details>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-medium">Privacy & Security</h2>
          <div className="mt-4 divide-y rounded-lg border">
            <details className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-medium">How do you handle my data?</span>
                <span className="text-sm text-muted-foreground">(click to toggle)</span>
              </summary>
              <div className="mt-2 text-sm text-muted-foreground">
                Summarize data handling and link to your privacy policy.
              </div>
            </details>
          </div>
        </div>
      </section>
      
      <PageNavigationClient />
    </main>
  )
}
