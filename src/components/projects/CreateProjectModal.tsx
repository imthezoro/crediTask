import React, { useState } from 'react';
import { X, Plus, Loader2, Wand2, FileText, DollarSign, Tag } from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_TAGS = [
  'Web Development', 'Mobile App', 'UI/UX Design', 'Backend', 'Frontend',
  'React', 'Node.js', 'Python', 'Design', 'Marketing', 'Content Writing',
  'Data Analysis', 'Machine Learning', 'DevOps', 'Testing'
];

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [requirementQuestions, setRequirementQuestions] = useState<string[]>([]);
  const [requirementAnswers, setRequirementAnswers] = useState<{[key: string]: string}>({});
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: '',
    tags: [] as string[],
    splitMode: 'manual' as 'ai' | 'manual'
  });

  const { createProject } = useProjects();

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = (tag: string) => {
    if (!formData.tags.includes(tag)) {
      handleInputChange('tags', [...formData.tags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    handleInputChange('tags', formData.tags.filter(t => t !== tag));
  };

const analyzeRequirements = async () => {
  setIsAnalyzing(true);
  try {
    const response = await fetch('http://localhost:5000/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        description: `Title: ${formData.title}\n\nDescription: ${formData.description}` 
      }),
    });
    console.log('Response from analyze requirement gathering:', response)

    const data = await response.json();
    
    if (data.follow_up_questions) {
      setRequirementQuestions(data.follow_up_questions);
      const initialAnswers: {[key: string]: string} = {};
      data.follow_up_questions.forEach((question: string, index: number) => {
        initialAnswers[`question_${index}`] = '';
      });
      console.log('Initial answers:', initialAnswers);
      setRequirementAnswers(initialAnswers);
    }
  } catch (error) {
    console.error('Error analyzing requirements:', error);
    setRequirementQuestions([]);
  } finally {
    setIsAnalyzing(false);
  }
};

const handleRequirementAnswerChange = (questionIndex: number, answer: string) => {
  setRequirementAnswers(prev => ({
    ...prev,
    [`question_${questionIndex}`]: answer
  }));
};

  const handleSubmit = async () => {
    if (!formData.title || !formData.description || !formData.budget) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Combine requirement answers with form data
      const detailedDescription = formData.description;


      const project = await createProject({
        title: formData.title,
        description: detailedDescription,
        budget: parseFloat(formData.budget),
        tags: formData.tags,
        requirements_form: requirementQuestions.map((q, i) => ({
    question: q,
    answer: requirementAnswers[`question_${i}`] || ''
  }))

      });

      if (project) {
        onClose();
        // Reset form
        setFormData({
          title: '',
          description: '',
          budget: '',
          tags: [],
          splitMode: 'manual'
        });
        setCurrentStep(1);
        setRequirementQuestions([]);
        setRequirementAnswers({});
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

const nextStep = async () => {
  if (currentStep === 1) {
    await analyzeRequirements();
  }
  if (currentStep < 4) {
    setCurrentStep(currentStep + 1);
  }
};

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.title && formData.description;
      case 2:
        return true; // Requirements form is optional
      case 3:
        return formData.budget && parseFloat(formData.budget) > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
            <p className="text-gray-600 mt-1">Step {currentStep} of 4</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={`w-12 h-1 mx-2 ${
                      step < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <FileText className="h-6 w-6 text-indigo-600" />
                <h3 className="text-lg font-semibold">Basic Information</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., E-commerce Website Development"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Describe your project requirements, goals, and expectations..."
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
  <div className="space-y-6">
    <div className="flex items-center space-x-3 mb-6">
      <Wand2 className="h-6 w-6 text-indigo-600" />
      <h3 className="text-lg font-semibold">Requirements Form</h3>
    </div>

    {isAnalyzing ? (
      <div className="text-center py-8">
        <div className="inline-flex items-center space-x-2 text-indigo-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Analyzing your project and generating requirements...</span>
        </div>
      </div>
    ) : requirementQuestions.length > 0 ? (
      <div className="space-y-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Wand2 className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">AI-Generated Requirements</span>
          </div>
          <p className="text-sm text-indigo-700 mt-2">
            Based on your project description, here are some important questions to help clarify your requirements:
          </p>
        </div>

        {requirementQuestions.map((question, index) => (
          <div key={index} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {index + 1}. {question}
            </label>
            <textarea
              value={requirementAnswers[`question_${index}`] || ''}
              onChange={(e) => handleRequirementAnswerChange(index, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="Please provide your answer..."
            />
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-8">
        <div className="text-gray-500">
          <p>No requirements questions generated. You can proceed to the next step.</p>
        </div>
      </div>
    )}
  </div>
)}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <DollarSign className="h-6 w-6 text-indigo-600" />
                <h3 className="text-lg font-semibold">Budget & Tags</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Budget (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="5000"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-2 hover:text-indigo-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_TAGS.filter(tag => !formData.tags.includes(tag)).slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => addTag(tag)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="h-3 w-3 inline mr-1" />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <Tag className="h-6 w-6 text-indigo-600" />
                <h3 className="text-lg font-semibold">Task Splitting</h3>
              </div>

              <div className="space-y-4">
                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.splitMode === 'ai'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleInputChange('splitMode', 'ai')}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      formData.splitMode === 'ai' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                    }`} />
                    <div>
                      <h4 className="font-medium">AI-Powered Task Splitting</h4>
                      <p className="text-sm text-gray-600">Let our AI analyze your project and automatically create optimized tasks</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.splitMode === 'manual'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleInputChange('splitMode', 'manual')}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      formData.splitMode === 'manual' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                    }`} />
                    <div>
                      <h4 className="font-medium">Manual Task Creation</h4>
                      <p className="text-sm text-gray-600">Create and manage tasks yourself with full control</p>
                    </div>
                  </div>
                </div>
              </div>

              {formData.splitMode === 'ai' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> AI task splitting will be available in the next update. For now, you can create tasks manually after project creation.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            
            {currentStep < 4 ? (
              <button
  onClick={nextStep}
  disabled={!canProceed() || isAnalyzing}
  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
>
  {isAnalyzing ? 'Analyzing...' : 'Next'}
</button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !canProceed()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Project</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}