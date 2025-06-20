import React, { useState } from 'react';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Briefcase, 
  MessageSquare, 
  DollarSign,
  Bell,
  Search,
  Users
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const clientSteps = [
  {
    title: 'Welcome to FreelanceFlow!',
    description: 'Let\'s get you started with posting your first project and finding the perfect freelancers.',
    icon: Briefcase,
    content: (
      <div className="space-y-4">
        <div className="bg-indigo-50 rounded-lg p-4">
          <h4 className="font-medium text-indigo-900 mb-2">As a Client, you can:</h4>
          <ul className="text-sm text-indigo-800 space-y-1">
            <li>• Post projects and break them into tasks</li>
            <li>• Invite specific freelancers or receive proposals</li>
            <li>• Track progress and communicate in real-time</li>
            <li>• Release payments securely upon completion</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    title: 'Create Your First Project',
    description: 'Projects are the foundation of your work. Break them into manageable tasks for better results.',
    icon: Briefcase,
    content: (
      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Briefcase className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600 mb-3">Click "New Project" to get started</p>
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg inline-block">
            + New Project
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Our AI can help split your project into optimized tasks, or you can create them manually.
        </p>
      </div>
    )
  },
  {
    title: 'Communicate & Collaborate',
    description: 'Stay connected with your team through project-specific chat channels.',
    icon: MessageSquare,
    content: (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <span className="font-medium">Project Chat</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="bg-white rounded p-2">
              <span className="font-medium text-gray-900">You:</span>
              <span className="text-gray-600 ml-2">Welcome to the project!</span>
            </div>
            <div className="bg-indigo-100 rounded p-2">
              <span className="font-medium text-indigo-900">Alex:</span>
              <span className="text-indigo-800 ml-2">Excited to work with you!</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Manage Payments',
    description: 'Release payments securely when tasks are completed to your satisfaction.',
    icon: DollarSign,
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-900">Escrow Protected</p>
            <p className="text-xs text-green-700">Funds held securely</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <Check className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-900">Easy Release</p>
            <p className="text-xs text-blue-700">One-click payments</p>
          </div>
        </div>
      </div>
    )
  }
];

const workerSteps = [
  {
    title: 'Welcome to FreelanceFlow!',
    description: 'Let\'s help you find amazing projects and start earning with your skills.',
    icon: Search,
    content: (
      <div className="space-y-4">
        <div className="bg-indigo-50 rounded-lg p-4">
          <h4 className="font-medium text-indigo-900 mb-2">As a Worker, you can:</h4>
          <ul className="text-sm text-indigo-800 space-y-1">
            <li>• Browse and apply to tasks that match your skills</li>
            <li>• Receive direct invitations from clients</li>
            <li>• Collaborate through project chat channels</li>
            <li>• Track your earnings and withdraw funds</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    title: 'Browse & Apply to Tasks',
    description: 'Find tasks that match your skills and submit compelling proposals.',
    icon: Search,
    content: (
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-medium text-gray-900">E-commerce Website Development</h4>
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">$500</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">Build a modern e-commerce website with React and Node.js...</p>
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">React</span>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Node.js</span>
            </div>
            <button className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Apply</button>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Your Tier System',
    description: 'Advance through tiers to access more opportunities and higher-value tasks.',
    icon: Users,
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <div className="w-8 h-8 bg-amber-500 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="text-white text-sm font-bold">B</span>
            </div>
            <p className="text-sm font-medium text-amber-900">Bronze</p>
            <p className="text-xs text-amber-700">30 min tasks</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center opacity-50">
            <div className="w-8 h-8 bg-gray-400 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Silver</p>
            <p className="text-xs text-gray-600">1 hour tasks</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 text-center">
          Complete tasks successfully to advance your tier and unlock better opportunities!
        </p>
      </div>
    )
  },
  {
    title: 'Track Your Earnings',
    description: 'Monitor your income and withdraw funds when you\'re ready.',
    icon: DollarSign,
    content: (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">$1,250</p>
            <p className="text-sm text-gray-600">Available Balance</p>
          </div>
          <div className="mt-4 bg-white rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">This Month</span>
              <span className="font-medium text-gray-900">$450</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Tasks Completed</span>
              <span className="font-medium text-gray-900">8</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
];

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  
  if (!isOpen || !user) return null;

  const steps = user.role === 'client' ? clientSteps : workerSteps;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      // Mark onboarding as completed
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const currentStepData = steps[currentStep];
  const IconComponent = currentStepData.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <IconComponent className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Getting Started</h2>
              <p className="text-sm text-gray-600">Step {currentStep + 1} of {steps.length}</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            Skip tour
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-gray-600">
              {currentStepData.description}
            </p>
          </div>

          <div className="mb-8">
            {currentStepData.content}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index <= currentStep ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span>{isLastStep ? 'Get Started' : 'Next'}</span>
            {isLastStep ? (
              <Check className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}