import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Users, 
  User, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Timer,
  DollarSign,
  Star
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AutoAssignmentTimerProps {
  taskId: string;
  applicationWindowMinutes: number;
  windowEnd: string;
  status: 'active' | 'completed' | 'cancelled';
  extensionsCount: number;
  maxExtensions: number;
  onTimerUpdate?: () => void;
}

interface TimerData {
  timeLeft: number; // in seconds
  isExpired: boolean;
  isNearExpiry: boolean; // within 5 minutes
}

interface ApplicationData {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_rating: number;
  worker_skills: string[];
  applied_at: string;
  selected: boolean;
}

interface ClientData {
  id: string;
  name: string;
  rating: number;
  total_projects: number;
  hire_rate: number;
}

export function AutoAssignmentTimer({ 
  taskId, 
  applicationWindowMinutes, 
  windowEnd, 
  status, 
  extensionsCount, 
  maxExtensions,
  onTimerUpdate 
}: AutoAssignmentTimerProps) {
  const [timerData, setTimerData] = useState<TimerData>({ timeLeft: 0, isExpired: false, isNearExpiry: false });
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canExtend, setCanExtend] = useState(false);

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

  // Load applications and client data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load applications
        const { data: appsData, error: appsError } = await supabase
          .from('task_applications')
          .select(`
            id,
            worker_id,
            applied_at,
            selected,
            users!inner(
              name,
              rating,
              skills
            )
          `)
          .eq('task_id', taskId)
          .order('applied_at', { ascending: true });

        if (appsError) throw appsError;

        const formattedApps: ApplicationData[] = appsData.map(app => ({
          id: app.id,
          worker_id: app.worker_id,
          worker_name: app.users.name || 'Unknown Worker',
          worker_rating: app.users.rating || 0,
          worker_skills: app.users.skills || [],
          applied_at: app.applied_at,
          selected: app.selected || false
        }));

        setApplications(formattedApps);

        // Load client data
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select(`
            projects!inner(
              client_id,
              users!inner(
                id,
                name,
                rating
              )
            )
          `)
          .eq('id', taskId)
          .single();

        if (taskError) throw taskError;

        // Get client stats
        const { data: clientStats, error: statsError } = await supabase
          .from('projects')
          .select('id')
          .eq('client_id', taskData.projects.client_id);

        if (!statsError && clientStats) {
          setClientData({
            id: taskData.projects.users.id,
            name: taskData.projects.users.name || 'Unknown Client',
            rating: taskData.projects.users.rating || 0,
            total_projects: clientStats.length,
            hire_rate: 85 // This would need to be calculated from actual data
          });
        }

        // Check if timer can be extended
        setCanExtend(extensionsCount < maxExtensions && status === 'active' && applications.length === 0);

      } catch (error) {
        console.error('Error loading timer data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [taskId, extensionsCount, maxExtensions, status]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const handleExtendTimer = async () => {
    try {
      const { error } = await supabase.rpc('extend_auto_assignment_timer', {
        p_task_id: taskId
      });

      if (error) throw error;

      // Refresh data
      if (onTimerUpdate) {
        onTimerUpdate();
      }
    } catch (error) {
      console.error('Error extending timer:', error);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'active':
        return timerData.isExpired ? <XCircle className="h-5 w-5 text-red-500" /> : <Clock className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
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

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Timer className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Auto-Assignment Timer</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              {getStatusIcon()}
              <span>{getStatusText()}</span>
              {status === 'active' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {extensionsCount}/{maxExtensions} extensions used
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timer Display */}
      {status === 'active' && (
        <div className={`mb-6 p-4 rounded-lg border-2 ${
          timerData.isExpired 
            ? 'border-red-200 bg-red-50' 
            : timerData.isNearExpiry 
              ? 'border-orange-200 bg-orange-50' 
              : 'border-green-200 bg-green-50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">Time Remaining</div>
              <div className={`text-2xl font-bold ${
                timerData.isExpired 
                  ? 'text-red-600' 
                  : timerData.isNearExpiry 
                    ? 'text-orange-600' 
                    : 'text-green-600'
              }`}>
                {timerData.isExpired ? 'EXPIRED' : formatTime(timerData.timeLeft)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Application Window</div>
              <div className="text-lg font-semibold text-gray-900">{applicationWindowMinutes} minutes</div>
            </div>
          </div>
          
          {timerData.isExpired && applications.length === 0 && canExtend && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>No applications received. Extend timer?</span>
              </div>
              <button
                onClick={handleExtendTimer}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Extend</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Client Information */}
      {clientData && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Client Information</h4>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{clientData.name}</div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span>{clientData.rating.toFixed(1)}</span>
                </div>
                <span>{clientData.total_projects} projects</span>
                <span>{clientData.hire_rate}% hire rate</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Applications */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">Worker Applications</h4>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>{applications.length} applications</span>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No applications received yet</p>
            <p className="text-sm">Workers can apply during the application window</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {applications.map((app) => (
              <div key={app.id} className={`p-3 rounded-lg border ${
                app.selected ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{app.worker_name}</span>
                      {app.selected && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span>{app.worker_rating.toFixed(1)}</span>
                      </div>
                      <span>{app.worker_skills.length} skills</span>
                      <span>Applied {new Date(app.applied_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Summary */}
      <div className="border-t border-gray-200 pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Status:</span>
            <span className={`ml-2 font-medium ${
              status === 'completed' ? 'text-green-600' :
              status === 'cancelled' ? 'text-red-600' :
              'text-blue-600'
            }`}>
              {getStatusText()}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Applications:</span>
            <span className="ml-2 font-medium text-gray-900">{applications.length}</span>
          </div>
          {status === 'active' && (
            <>
              <div>
                <span className="text-gray-600">Extensions:</span>
                <span className="ml-2 font-medium text-gray-900">{extensionsCount}/{maxExtensions}</span>
              </div>
              <div>
                <span className="text-gray-600">Window:</span>
                <span className="ml-2 font-medium text-gray-900">{applicationWindowMinutes}m</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 