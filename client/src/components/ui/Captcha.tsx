'use client';

import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { FiRefreshCw } from 'react-icons/fi';

interface CaptchaProps {
  onVerify: (token: string) => void;
  onError?: () => void;
}

export interface CaptchaRef {
  reset: () => void;
}

interface Challenge {
  question: string;
  answer: number;
  id: string;
}

function generateChallenge(): Challenge {
  const operations = ['+', '-', '×'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let num1: number, num2: number, answer: number;
  
  switch (operation) {
    case '+':
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 20) + 1;
      answer = num1 + num2;
      break;
    case '-':
      num1 = Math.floor(Math.random() * 20) + 10;
      num2 = Math.floor(Math.random() * num1);
      answer = num1 - num2;
      break;
    case '×':
      num1 = Math.floor(Math.random() * 10) + 1;
      num2 = Math.floor(Math.random() * 10) + 1;
      answer = num1 * num2;
      break;
    default:
      num1 = 1;
      num2 = 1;
      answer = 2;
  }
  
  const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  return {
    question: `${num1} ${operation} ${num2} = ?`,
    answer,
    id,
  };
}

const Captcha = forwardRef<CaptchaRef, CaptchaProps>(({ onVerify, onError }, ref) => {
  // Initialize as null to avoid hydration mismatch - challenge is generated only on client
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState(false);
  const [mounted, setMounted] = useState(false);
  const startTimeRef = useRef<number>(0);
  const t = useTranslations('captcha');

  const refreshChallenge = useCallback(() => {
    setChallenge(generateChallenge());
    setUserAnswer('');
    setError(false);
    setVerified(false);
    startTimeRef.current = Date.now();
  }, []);

  // Expose reset method to parent components
  useImperativeHandle(ref, () => ({
    reset: refreshChallenge
  }));

  // Only generate challenge on client side after mounting
  useEffect(() => {
    setMounted(true);
    refreshChallenge();
  }, [refreshChallenge]);

  const handleSubmit = () => {
    if (!challenge) return;
    
    const timeTaken = Date.now() - startTimeRef.current;
    const parsedAnswer = parseInt(userAnswer, 10);
    
    // Check if answer is correct
    if (parsedAnswer === challenge.answer) {
      // Check timing (at least 2 seconds to solve - bots are too fast)
      if (timeTaken < 2000) {
        setError(true);
        if (onError) onError();
        refreshChallenge();
        return;
      }
      
      // Generate a verification token
      const token = btoa(JSON.stringify({
        id: challenge.id,
        answer: challenge.answer,
        time: timeTaken,
        ts: Date.now(),
      }));
      
      setVerified(true);
      setError(false);
      onVerify(token);
    } else {
      setError(true);
      setUserAnswer('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Don't render anything until mounted on client to avoid hydration mismatch
  if (!mounted || !challenge) {
    return (
      <div className="my-4">
        <div className="p-4 rounded-xl border border-neon-blue/30 bg-cyber-dark/50 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">{t('securityCheck')}</span>
          </div>
          <div className="h-10 bg-cyber-dark/80 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      {/* Honeypot field - hidden from humans, bots will fill it */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: 'absolute', left: '-9999px' }}
      />
      
      <div className={`p-4 rounded-xl border ${verified ? 'border-green-500 bg-green-500/10' : error ? 'border-red-500 bg-red-500/10' : 'border-neon-blue/30 bg-cyber-dark/50'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">{t('securityCheck')}</span>
          {!verified && (
            <button
              type="button"
              onClick={refreshChallenge}
              className="text-gray-400 hover:text-neon-cyan transition-colors p-1"
              title="New challenge"
            >
              <FiRefreshCw size={16} />
            </button>
          )}
        </div>
        
        {verified ? (
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">{t('verified')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <span className="font-mono text-lg sm:text-xl font-bold text-neon-cyan bg-cyber-dark/80 px-3 py-2 rounded-lg border border-neon-blue/30">
                {challenge.question}
              </span>
            </div>
            <input
              type="number"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSubmit}
              placeholder="?"
              className={`w-20 px-3 py-2 rounded-lg border bg-cyber-dark/80 text-center font-mono text-lg focus:outline-none focus:ring-2 ${
                error 
                  ? 'border-red-500 focus:ring-red-500/50' 
                  : 'border-neon-blue/30 focus:ring-neon-blue/50 focus:border-neon-blue'
              }`}
              autoComplete="off"
            />
          </div>
        )}
        
        {error && (
          <p className="text-red-400 text-xs mt-2">{t('incorrectAnswer')}</p>
        )}
      </div>
    </div>
  );
});

Captcha.displayName = 'Captcha';
export default Captcha;
