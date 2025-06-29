import React, { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'success', duration = 2000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
          border: 'border-green-400',
          icon: 'text-green-100',
          text: 'text-white'
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-red-500 to-pink-500',
          border: 'border-red-400',
          icon: 'text-red-100',
          text: 'text-white'
        };
      case 'info':
        return {
          bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
          border: 'border-blue-400',
          icon: 'text-blue-100',
          text: 'text-white'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
          border: 'border-green-400',
          icon: 'text-green-100',
          text: 'text-white'
        };
    }
  };

  const styles = getToastStyles();

  return (
    <div
      className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${styles.bg} ${styles.border} border rounded-xl shadow-2xl p-4 max-w-sm backdrop-blur-sm`}>
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <CheckCircle className={`h-6 w-6 ${styles.icon}`} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${styles.text}`}>
              {message}
            </p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className={`flex-shrink-0 ${styles.icon} hover:opacity-80 transition-opacity`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="mt-3 h-1 bg-white bg-opacity-20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white bg-opacity-60 rounded-full transition-all duration-300 ease-linear"
            style={{
              width: isVisible ? '0%' : '100%',
              transitionDuration: `${duration}ms`
            }}
          />
        </div>
      </div>
    </div>
  );
} 