import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Futuristic neon palette
        neon: {
          blue: '#00E5FF',
          cyan: '#1DA1FF',
          orange: '#FF6B35',
          purple: '#B829FF',
          magenta: '#FF00FF',
          green: '#00FF9D',
        },
        cyber: {
          dark: '#0A0E27',
          navy: '#131B3A',
          blue: '#1A2847',
          light: '#2A3B5A',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.1)',
          blue: 'rgba(29, 161, 255, 0.1)',
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        exo: ['Exo 2', 'sans-serif'],
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(0, 229, 255, 0.5), 0 0 40px rgba(0, 229, 255, 0.3)',
        'neon-orange': '0 0 20px rgba(255, 107, 53, 0.5), 0 0 40px rgba(255, 107, 53, 0.3)',
        'neon-purple': '0 0 20px rgba(184, 41, 255, 0.5), 0 0 40px rgba(184, 41, 255, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 229, 255, 0.1)',
        'cyber': '0 4px 30px rgba(0, 0, 0, 0.5)',
      },
      backgroundImage: {
        'gradient-cyber': 'linear-gradient(135deg, #131B3A 0%, #0A0E27 100%)',
        'gradient-neon': 'linear-gradient(135deg, #00E5FF 0%, #1DA1FF 50%, #B829FF 100%)',
        'gradient-orange': 'linear-gradient(135deg, #FF6B35 0%, #FF9D5C 100%)',
      },
      animation: {
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-in': 'slideIn 0.5s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'counter-up': 'counterUp 1s ease-out',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 229, 255, 0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 229, 255, 0.8), 0 0 60px rgba(0, 229, 255, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideIn: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        counterUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
}
export default config

