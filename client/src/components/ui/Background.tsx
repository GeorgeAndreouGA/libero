'use client';

import { useEffect, useRef, useState } from 'react';

export default function Background() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for mobile and reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const motionHandler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    motionQuery.addEventListener('change', motionHandler);

    return () => {
      window.removeEventListener('resize', checkMobile);
      motionQuery.removeEventListener('change', motionHandler);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Skip particles on mobile or when reduced motion is preferred
    if (isMobile || prefersReducedMotion) return;

    // Reduced particle count for better performance
    const particleCount = 20; // Reduced from 50
    const particles: HTMLDivElement[] = [];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.width = `${Math.random() * 3 + 1}px`;
      particle.style.height = particle.style.width;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 15}s`;
      particle.style.animationDuration = `${Math.random() * 10 + 10}s`;
      
      canvasRef.current.appendChild(particle);
      particles.push(particle);
    }

    return () => {
      particles.forEach(p => p.remove());
    };
  }, [isMobile, prefersReducedMotion]);

  // Simplified background for mobile
  if (isMobile || prefersReducedMotion) {
    return (
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Simple gradient background - no blur orbs */}
        <div className="absolute inset-0 bg-gradient-cyber" />
        
        {/* Simplified grid overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 229, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 229, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-cyber" />
      
      {/* Animated gradients - reduced blur for better performance */}
      <div className="absolute inset-0 opacity-30">
        <div 
          className="absolute top-0 left-0 w-72 h-72 bg-neon-blue/20 rounded-full blur-[80px] animate-float will-change-transform" 
          style={{ contain: 'layout paint' }}
        />
        <div 
          className="absolute bottom-0 right-0 w-72 h-72 bg-neon-purple/20 rounded-full blur-[80px] animate-float will-change-transform" 
          style={{ animationDelay: '1s', contain: 'layout paint' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 w-72 h-72 bg-neon-cyan/15 rounded-full blur-[80px] animate-float will-change-transform" 
          style={{ animationDelay: '2s', contain: 'layout paint' }}
        />
      </div>
      
      {/* Particles container */}
      <div ref={canvasRef} className="particles" />
      
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 229, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
}
