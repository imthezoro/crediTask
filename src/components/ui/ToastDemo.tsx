import React, { useState } from 'react';
import { Toast } from './Toast';

export function ToastDemo() {
  const [showToast, setShowToast] = useState(false);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Toast Notification Demo</h2>
      <button
        onClick={() => setShowToast(true)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        Show Success Toast
      </button>

      {showToast && (
        <Toast
          message="🎉 Work submitted successfully! Task is now under review."
          type="success"
          duration={2000}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
} 