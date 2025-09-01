import Link from 'next/link'

export default function ExtensionInstructions() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-blue-900 mb-4">
        PromptOK Chrome Extension
      </h2>
      
      <div className="space-y-4 text-blue-800">
        <p>
          The PromptOK extension enhances your AI prompts directly in your browser. 
          Here&apos;s how to get started:
        </p>
        
        <ol className="list-decimal list-inside space-y-2">
          <li>Install the extension from the Chrome Web Store</li>
          <li>Pin the extension to your browser toolbar</li>
          <li>Visit any AI platform (ChatGPT, Claude, etc.)</li>
          <li>Click the PromptOK icon to enhance your prompts</li>
          <li>View your usage statistics in your <Link href="/dashboard" className="underline font-medium">dashboard</Link></li>
        </ol>
        
        <div className="bg-blue-100 rounded-lg p-4 mt-4">
          <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
          <ul className="text-sm space-y-1">
            <li>• The extension captures your prompt text</li>
            <li>• Sends it securely to our API for enhancement</li>
            <li>• Returns an improved version with better structure and clarity</li>
            <li>• Stores session data for analytics and improvement</li>
          </ul>
        </div>
        
        <div className="flex space-x-4 mt-6">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Install Extension
          </button>
          <Link 
            href="/dashboard" 
            className="bg-white text-blue-600 px-4 py-2 rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
          >
            View Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
