'use client'

import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Check, X, Brain, Zap, Target, TrendingUp, ArrowRight, Sparkles } from "lucide-react"
import InterestSignup from "@/components/InterestSignup"
import Header from "@/components/Header"
import { useScrollAnimation } from "@/hooks/useScrollAnimation"

export default function HomePage() {
  const heroRef = useScrollAnimation()
  const comparisonRef = useScrollAnimation()
  const solutionRef = useScrollAnimation()
  const howItWorksRef = useScrollAnimation()
  const performanceRef = useScrollAnimation()
  const updatesRef = useScrollAnimation()

  // Initialize page load animations
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll('.page-load-animate')
      elements.forEach((el) => el.classList.add('loaded'))
    }, 1)
    
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Global Header */}
      <div className="page-load-animate page-load-stagger-1">
        <Header forcePublicNav={true} />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white py-24 px-6">
        {/* Background Overlay (simplified) */}
        <div className="absolute inset-0 bg-white/10"></div>
        
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="page-load-animate page-load-stagger-2 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8 border border-white/20">
            <Sparkles className="h-4 w-4 text-yellow-300" />
            <span className="text-sm font-medium text-white/90">AI-Powered Prompt Optimization</span>
          </div>
          
          <h1 className="page-load-animate page-load-stagger-3 text-5xl md:text-7xl font-extrabold mb-8 text-balance leading-tight">
            <span className="bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
              Prompt Smarter.
            </span>
            <br />
            <span className="text-white">Not Just Harder.</span>
          </h1>
          
          <p className="page-load-animate page-load-stagger-4 text-xl md:text-2xl mb-10 text-slate-200 max-w-3xl mx-auto text-balance leading-relaxed font-light">
            Transform your AI interactions with intelligent prompt enhancement, real-time analytics, and strategic suggestions based on proven best practices.
          </p>
          
          <div className="page-load-animate page-load-stagger-5 flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <a href="/auth/signin" className="inline-block">
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-10 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>
            <Button variant="outline" className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 px-8 py-4 text-lg rounded-xl">
              Watch Demo
            </Button>
          </div>
          
          <p className="page-load-animate page-load-stagger-5 text-sm text-slate-300 flex items-center justify-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" />
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Comparison Section */}
      <section ref={comparisonRef} className="scroll-animate py-20 px-6 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              Most AI Users Just... <span className="text-orange-600">Prompt</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              But there's a smarter way to unlock AI's full potential
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">What Most Users Do</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">Write basic prompts</span>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">Get okay results</span>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">Trial and error approach</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-xl border-0 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <X className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">What They're Missing</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                    <X className="h-5 w-5 text-red-200 flex-shrink-0" />
                    <span className="text-white font-medium">No optimization strategies</span>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                    <X className="h-5 w-5 text-red-200 flex-shrink-0" />
                    <span className="text-white font-medium">No performance tracking</span>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                    <X className="h-5 w-5 text-red-200 flex-shrink-0" />
                    <span className="text-white font-medium">No intelligent suggestions</span>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                    <X className="h-5 w-5 text-red-200 flex-shrink-0" />
                    <span className="text-white font-medium">Missing best practices</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Smart Solution Section */}
      <section ref={solutionRef} className="scroll-animate py-20 px-6 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Our Smart Solution</h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Advanced AI technology that transforms how you interact with artificial intelligence
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">AI-Powered Enhancement</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Intelligent prompt optimization with context-aware suggestions. Transform basic prompts into powerful, results-driven instructions.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Performance Analytics</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Track prompt effectiveness, response quality, and improvement metrics. Get data-driven insights for better AI interactions.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Chrome Extension</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Seamless integration with ChatGPT, Claude, and other AI tools. Real-time suggestions right where you work.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Smart Templates</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Access proven prompt templates and patterns. Learn from best practices and apply winning strategies instantly.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={howItWorksRef} className="scroll-animate py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Three simple steps to transform your AI interactions
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto shadow-lg group-hover:scale-110 transition-transform">
                  1
                </div>
                <div className="absolute -inset-4 bg-blue-100 rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Write Your Prompt</h3>
              <p className="text-gray-600 leading-relaxed">
                Start with any prompt in our editor or use our Chrome extension with your favorite AI tools like ChatGPT and Claude.
              </p>
            </div>
            
            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto shadow-lg group-hover:scale-110 transition-transform">
                  2
                </div>
                <div className="absolute -inset-4 bg-purple-100 rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">AI Enhancement</h3>
              <p className="text-gray-600 leading-relaxed">
                Our AI analyzes context, intent, and best practices to suggest powerful improvements and optimizations.
              </p>
            </div>
            
            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto shadow-lg group-hover:scale-110 transition-transform">
                  3
                </div>
                <div className="absolute -inset-4 bg-emerald-100 rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Better Results</h3>
              <p className="text-gray-600 leading-relaxed">
                Get enhanced prompts that deliver superior AI responses and track your improvement over time with detailed analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Tracking Section */}
      <section ref={performanceRef} className="scroll-animate py-20 px-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              Track Your AI Performance <span className="text-purple-600">Smarter</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive analytics to measure and improve your AI interactions
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Response Quality Metrics</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Measure response relevance, completeness, and accuracy. Compare before/after prompt optimization results with detailed scoring.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Usage Analytics</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Track your most effective prompts, patterns, and templates. Discover what works best for your specific use cases and goals.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Improvement Insights</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Get personalized recommendations based on your prompt history and performance data to continuously improve your AI interactions.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Updates Section */}
      <section ref={updatesRef} id="updates" className="scroll-animate py-20 px-6 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Stay Updated on PromptOK</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Get notified about new features, updates, and improvements. Join our community of AI power users.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-12">
            <InterestSignup 
              title=""
              description=""
              buttonText="Get Updates"
              type="waiting"
              className="max-w-md mx-auto"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl backdrop-blur-sm">
              <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span className="text-white font-medium">Early access to new features</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl backdrop-blur-sm">
              <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span className="text-white font-medium">Product updates and improvements</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl backdrop-blur-sm">
              <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span className="text-white font-medium">Direct feedback channel with team</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl backdrop-blur-sm">
              <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span className="text-white font-medium">No spam, unsubscribe anytime</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
