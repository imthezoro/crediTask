import React, { useState, useEffect } from 'react';
import { triggerAutoAssign, getCronStatus } from '../../services/autoAssignCron';

export function AutoAssignDebug() {
  const [status, setStatus] = useState(getCronStatus());
  const [isTriggering, setIsTriggering] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getCronStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleManualTrigger = async () => {
    setIsTriggering(true);
    try {
      await triggerAutoAssign();
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border">
      <h3 className="text-lg font-semibold mb-3">Auto-Assign Debug</h3>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Status:</span>
          <span className={`px-2 py-1 text-xs rounded-full ${
            status.isRunning ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status.isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
        
        <div className="text-sm text-gray-600">
          Last Run: {status.lastRun ? new Date(status.lastRun).toLocaleTimeString() : 'Never'}
        </div>
        
        <div className="text-sm text-gray-600">
          Interval: {status.intervalMs / 1000}s
        </div>
      </div>

      <button
        onClick={handleManualTrigger}
        disabled={isTriggering}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isTriggering ? 'Processing...' : 'Trigger Auto-Assign Now'}
      </button>
    </div>
  );
} 