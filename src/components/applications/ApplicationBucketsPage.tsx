import React, { useState } from 'react';
import { 
  Briefcase, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  Eye,
  Star,
  DollarSign,
  Calendar,
  User,
  MessageSquare,
  Loader2,
  Filter,
  Search,
  AlertCircle,
  Ban,
  Shield
} from 'lucide-react';
import { useApplicationBuckets } from '../../hooks/useApplicationBuckets';
import { useAuth } from '../../contexts/AuthContext';

export function ApplicationBucketsPage() {
  const { user } = useAuth();
  const { 
    buckets, 
    isLoading, 
    error, 
    approveApplication, 
    rejectApplication, 
    markBucketAsReviewing,
    fetchSingleApplicationStatus 
  } = useApplicationBuckets();
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  if (user?.role !== 'client') {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
        <p className="text-gray-600">Only clients can view application buckets</p>
      </div>
    );
  }

  const filteredBuckets = buckets.filter(bucket => {
    const matchesSearch = bucket.task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bucket.project.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bucket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'reviewing': return 'bg-amber-100 text-amber-800';
      case 'closed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getApplicationStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getApplicationStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return CheckCircle;
      case 'rejected': return XCircle;
      case 'pending': return Clock;
      default: return Clock;
    }
  };

  const getApplicationStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  };

  const handleViewApplication = async (application: any) => {
    // Show loading state
    setSelectedApplication({
      ...application,
      isLoading: true
    });
    setShowApplicationModal(true);

    // Fetch fresh data from database
    const freshApplication = await fetchSingleApplicationStatus(application.id);
    
    if (freshApplication) {
      const updatedApplication = {
        ...freshApplication,
        isLoading: false
      };
      setSelectedApplication(updatedApplication);
    } else {
      // Fallback to cached data if fetch fails
      const fallbackApplication = {...application, isLoading: false};
      setSelectedApplication(fallbackApplication);
    }
  };

  const handleApproveApplication = async (bucketId: string, applicationId: string, workerId: string) => {
    const success = await approveApplication(bucketId, applicationId, workerId);
    if (success) {
      setShowApplicationModal(false);
      setSelectedApplication(null);
    }
  };

  const handleRejectApplication = async (applicationId: string) => {
    const success = await rejectApplication(applicationId);
    if (success) {
      setShowApplicationModal(false);
      setSelectedApplication(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Error Loading Applications</h3>
        <p className="text-gray-600 mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Application Buckets</h1>
          <p className="text-gray-600 mt-1">Review and manage task applications</p>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="bg-blue-50 px-3 py-2 rounded-lg">
            <span className="text-blue-600 font-medium">{buckets.filter(b => b.status === 'open').length}</span>
            <span className="text-blue-700 ml-1">Open</span>
          </div>
          <div className="bg-amber-50 px-3 py-2 rounded-lg">
            <span className="text-amber-600 font-medium">{buckets.filter(b => b.status === 'reviewing').length}</span>
            <span className="text-amber-700 ml-1">Reviewing</span>
          </div>
          <div className="bg-green-50 px-3 py-2 rounded-lg">
            <span className="text-green-600 font-medium">{buckets.filter(b => b.status === 'closed').length}</span>
            <span className="text-green-700 ml-1">Closed</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by task or project name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="closed">Closed</option>
            </select>
            
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>More Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Application Buckets */}
      {filteredBuckets.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No application buckets found</h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'Application buckets will appear here when workers apply to your tasks'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBuckets.map((bucket) => (
            <div key={bucket.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Bucket Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{bucket.task.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bucket.status)}`}>
                        {bucket.status}
                      </span>
                      {bucket.task.autoAssign && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          Auto-Assign
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-3">{bucket.project.title}</p>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-medium">${bucket.task.payout}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span>{bucket.totalApplications} applications</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>{bucket.approvedApplications} approved</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>{bucket.rejectedApplications} rejected</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{bucket.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {bucket.status === 'open' && bucket.totalApplications > 0 && (
                      <button
                        onClick={() => markBucketAsReviewing(bucket.id)}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                      >
                        Start Review
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedBucket(selectedBucket === bucket.id ? null : bucket.id)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center space-x-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>{selectedBucket === bucket.id ? 'Hide' : 'View'} Applications</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Applications List */}
              {selectedBucket === bucket.id && (
                <div className="p-6">
                  {bucket.applications.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No applications yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bucket.applications.map((application) => {
                        const StatusIcon = getApplicationStatusIcon(application.status);
                        return (
                          <div key={application.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-4 flex-1">
                                {/* Worker Avatar */}
                                <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  {application.worker.avatar ? (
                                    <img
                                      src={application.worker.avatar}
                                      alt={application.worker.name}
                                      className="w-12 h-12 rounded-full object-cover"
                                    />
                                  ) : (
                                    <User className="h-6 w-6 text-white" />
                                  )}
                                </div>
                                
                                {/* Worker Info */}
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h4 className="font-medium text-gray-900">{application.worker.name}</h4>
                                    <div className="flex items-center space-x-1">
                                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                      <span className="text-sm text-gray-600">{application.worker.rating.toFixed(1)}</span>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center space-x-1 ${getApplicationStatusColor(application.status)}`}>
                                      <StatusIcon className="h-3 w-3" />
                                      <span>{getApplicationStatusLabel(application.status)}</span>
                                    </span>
                                  </div>
                                  
                                  {/* Skills */}
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {application.worker.skills.slice(0, 4).map((skill) => (
                                      <span
                                        key={skill}
                                        className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                    {application.worker.skills.length > 4 && (
                                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                        +{application.worker.skills.length - 4} more
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Proposal Info */}
                                  {application.proposal && (
                                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                                      <div className="flex items-center space-x-1">
                                        <DollarSign className="h-4 w-4" />
                                        <span>${application.proposal.proposedRate}</span>
                                      </div>
                                      {application.proposal.estimatedHours && (
                                        <div className="flex items-center space-x-1">
                                          <Clock className="h-4 w-4" />
                                          <span>{application.proposal.estimatedHours}h</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  <p className="text-xs text-gray-500 mt-2">
                                    Applied {application.appliedAt.toLocaleDateString()} at {application.appliedAt.toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex space-x-2 ml-4">
                                <button
                                  onClick={() => handleViewApplication(application)}
                                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center space-x-1"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  <span>View</span>
                                </button>
                                
                                {/* Only show action buttons for pending applications */}
                                {application.status === 'pending' && bucket.status !== 'closed' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveApplication(bucket.id, application.id, application.workerId)}
                                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center space-x-1"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                      <span>Approve</span>
                                    </button>
                                    
                                    <button
                                      onClick={() => handleRejectApplication(application.id)}
                                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center space-x-1"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                )}
                                
                                {/* Show status for processed applications */}
                                {application.status !== 'pending' && (
                                  <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                                    <Shield className="h-4 w-4 mr-1" />
                                    <span>Processed</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Application Detail Modal */}
      {showApplicationModal && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">Application Details</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center space-x-1 ${getApplicationStatusColor(selectedApplication.status)}`}>
                    {React.createElement(getApplicationStatusIcon(selectedApplication.status), { className: "h-3 w-3" })}
                    <span>{getApplicationStatusLabel(selectedApplication.status)}</span>
                  </span>
                </div>
                <button
                  onClick={() => setShowApplicationModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {selectedApplication.isLoading ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="ml-2 text-gray-600">Loading latest status...</span>
              </div>
            ) : (
              <>
                <div className="p-6 overflow-y-auto max-h-96">
                  <div className="space-y-6">
                    {/* Worker Info */}
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center">
                        {selectedApplication.worker.avatar ? (
                          <img
                            src={selectedApplication.worker.avatar}
                            alt={selectedApplication.worker.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-8 w-8 text-white" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xl font-semibold text-gray-900">{selectedApplication.worker.name}</h4>
                        <p className="text-gray-600">{selectedApplication.worker.email}</p>
                        <div className="flex items-center space-x-1 mt-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600">{selectedApplication.worker.rating.toFixed(1)} rating</span>
                        </div>
                      </div>
                    </div>

                    {/* Cover Letter */}
                    {selectedApplication.proposal && (
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">Cover Letter</h5>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-gray-700 whitespace-pre-wrap">{selectedApplication.proposal.coverLetter}</p>
                        </div>
                      </div>
                    )}

                    {/* Skills */}
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Skills</h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedApplication.worker.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Proposal Details */}
                    {selectedApplication.proposal && (
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">Proposal Details</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-green-50 rounded-lg p-4">
                            <div className="flex items-center space-x-2">
                              <DollarSign className="h-5 w-5 text-green-600" />
                              <span className="font-medium text-green-900">Proposed Rate</span>
                            </div>
                            <p className="text-2xl font-bold text-green-900 mt-1">
                              ${selectedApplication.proposal.proposedRate}
                            </p>
                          </div>
                          
                          {selectedApplication.proposal.estimatedHours && (
                            <div className="bg-blue-50 rounded-lg p-4">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-5 w-5 text-blue-600" />
                                <span className="font-medium text-blue-900">Estimated Hours</span>
                              </div>
                              <p className="text-2xl font-bold text-blue-900 mt-1">
                                {selectedApplication.proposal.estimatedHours}h
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status Information */}
                    {selectedApplication.status !== 'pending' && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-2">Application Status</h5>
                        <div className="flex items-center space-x-2">
                          {React.createElement(getApplicationStatusIcon(selectedApplication.status), { 
                            className: `h-5 w-5 ${selectedApplication.status === 'approved' ? 'text-green-600' : 'text-red-600'}` 
                          })}
                          <span className="text-lg font-medium text-gray-900">
                            {getApplicationStatusLabel(selectedApplication.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          This application has been processed and cannot be modified.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                  {(() => {
                    return (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => setShowApplicationModal(false)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Close
                        </button>
                        
                        {/* Only show action buttons for pending applications */}
                        {selectedApplication.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => {
                                const bucket = buckets.find(b => b.applications.some(a => a.id === selectedApplication.id));
                                if (bucket) {
                                  handleApproveApplication(bucket.id, selectedApplication.id, selectedApplication.workerId);
                                }
                              }}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Approve Application
                            </button>
                            <button
                              onClick={() => handleRejectApplication(selectedApplication.id)}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          /* Show status for processed applications */
                          <div className="flex-1 px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-center font-medium cursor-not-allowed">
                            {selectedApplication.status === 'approved' ? 'Application Approved' : 'Application Rejected'}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}