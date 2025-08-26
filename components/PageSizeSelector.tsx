'use client'

import React from 'react'

type Props = {
  action: string
  pageSize: number
  params: Record<string, string | number | undefined>
}

export default function PageSizeSelector({ action, pageSize, params }: Props) {
  const formRef = React.useRef<HTMLFormElement>(null)

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Always reset to page 1 on page size change
    if (formRef.current) {
      const pageInput = formRef.current.querySelector<HTMLInputElement>('input[name="page"]')
      if (pageInput) pageInput.value = '1'
      try { window.dispatchEvent(new Event('admin:loading:start')) } catch {}
      formRef.current.submit()
    }
  }

  // Build hidden inputs from params
  const entries = Object.entries(params || {})

  return (
    <form ref={formRef} method="GET" action={action} className="flex items-center gap-2" title="Rows per page">
      {entries.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value === undefined ? '' : String(value)} />
      ))}
      <span className="text-gray-500 text-xs mr-1" aria-hidden>📄</span>
      <select name="pageSize" defaultValue={String(pageSize)} onChange={onChange} className="px-2 py-1 border border-gray-300 rounded-md text-xs">
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
      </select>
    </form>
  )
}
