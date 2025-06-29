import React, { useState, useEffect } from 'react';
import { Clock, Users, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CompactTimerProps {
  taskId: string;
  applicationWindowMinutes: number;
  windowEnd: string;
  status: 'active' | 'completed' | 'cancelled';
  extensionsCount: number;
  maxExtensions: number;
}

interface TimerData {
  timeLeft: number; // in seconds
  isExpired: boolean;
  isNearExpiry: boolean; // within 5 minutes
}

interface ApplicationCount {
  count: number;
}

export function CompactTimer({ 
  taskId, 
  applicationWindowMinutes, 
  windowEnd, 
  status, 
  extensionsCount, 
  maxExtensions 
}: CompactTimerProps) {
  const [timerData, setTimerData] = useState<TimerData>({ timeLeft: 0, isExpired: false, isNearExpiry: false });
  const [applicationCount, setApplicationCount] = useState<ApplicationCount>({ count: 0 });

  // Calculate time remaining
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const endTime = new Date(windowEnd).getTime();
      const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
      const isExpired = timeLeft <= 0;
      const isNearExpiry = timeLeft <= 300 && timeLeft > 0; // 5 minutes

      setTimerData({ timeLeft, isExpired, isNearExpiry });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [windowEnd]);

  // Load application count
  useEffect(() => {
    const loadApplicationCount = async () => {
      try {
        const { count, error } = await supabase
          .from('task_applications')
          .select('*', { count: 'exact', head: true })
          .eq('task_id', taskId);

        if (error) throw error;
        setApplicationCount({ count: count || 0 });
      } catch (error) {
        console.error('Error loading application count:', error);
      }
    };

    loadApplicationCount();
  }, [taskId]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'active':
        return timerData.isExpired ? <XCircle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'active':
        return timerData.isExpired ? 'Expired' : 'Active';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const getTimerColor = () => {
    if (status !== 'active') return 'text-gray-600';
    if (timerData.isExpired) return 'text-red-600';
    if (timerData.isNearExpiry) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className={`flex items-center space-x-3 text-sm ${
      status === 'active' && timerData.isExpired ? 'bg-red-50 border border-red-200' : 
      status === 'active' && timerData.isNearExpiry ? 'bg-orange-50 border border-orange-200' : 
      'bg-purple-50 border border-purple-200'
    } rounded-lg p-2`}>
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <span className="font-medium text-gray-700">{getStatusText()}</span>
      </div>
      
      {status === 'active' && (
        <>
          <div className={`font-mono font-bold ${getTimerColor()}`}>
            {timerData.isExpired ? 'EXPIRED' : formatTime(timerData.timeLeft)}
          </div>
          <div className="flex items-center space-x-1 text-gray-600">
            <Users className="h-3 w-3" />
            <span>{applicationCount.count} apps</span>
          </div>
          {timerData.isExpired && applicationCount.count === 0 && (
            <div className="flex items-center space-x-1 text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">No apps</span>
            </div>
          )}
        </>
      )}
      
      {status === 'completed' && (
        <div className="flex items-center space-x-1 text-green-600">
          <span className="text-xs">Assigned</span>
        </div>
      )}
      
      {status === 'cancelled' && (
        <div className="flex items-center space-x-1 text-gray-600">
          <span className="text-xs">Cancelled</span>
        </div>
      )}
    </div>
  );
} 