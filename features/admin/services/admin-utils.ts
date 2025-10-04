export class AdminApiHelper {
  static getAuthToken(): string | undefined {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('sb-access-token='))
      ?.split('=')[1]
  }

  static async makeApiCall(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    data?: unknown
  ): Promise<Response> {
    const token = this.getAuthToken()
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }

    if (data !== undefined && method !== 'GET') {
      options.body = JSON.stringify(data)
    }

    return fetch(endpoint, options)
  }

  static async fetchWithAuth(endpoint: string, options?: RequestInit): Promise<Response> {
    const token = this.getAuthToken()
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options?.headers
      }
    }

    return fetch(endpoint, mergedOptions)
  }

  static async downloadFile(url: string, filename: string): Promise<void> {
    const response = await this.makeApiCall(url)
    
    if (!response.ok) {
      throw new Error('Download failed')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(a)
  }

  static handleError(error: unknown, defaultMessage: string = 'Operation failed'): void {
    console.error(error)
    alert(defaultMessage + '. Please try again.')
  }
}
