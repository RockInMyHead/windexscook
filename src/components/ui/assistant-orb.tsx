import React from 'react';
import { ChefHat, Mic, Volume2 } from 'lucide-react';

interface AssistantOrbProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  className?: string;
}

export const AssistantOrb: React.FC<AssistantOrbProps> = ({ state, className = '' }) => {
  const getOrbStyles = () => {
    switch (state) {
      case 'listening':
        return 'bg-green-500 shadow-green-500/50 shadow-lg';
      case 'processing':
        return 'bg-blue-500 shadow-blue-500/50 shadow-lg';
      case 'speaking':
        return 'bg-purple-500 shadow-purple-500/50 shadow-lg';
      default:
        return 'bg-gray-400 shadow-gray-400/30 shadow-md';
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'listening':
        return <Mic className="w-8 h-8 text-white" />;
      case 'speaking':
        return <Volume2 className="w-8 h-8 text-white" />;
      default:
        return <ChefHat className="w-8 h-8 text-white" />;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Outer glow ring */}
      <div className={`absolute inset-0 rounded-full ${getOrbStyles()} opacity-20 scale-150`} />

      {/* Main orb */}
      <div className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full ${getOrbStyles()} flex items-center justify-center transition-all duration-300`}>
        {getIcon()}
      </div>

      {/* Inner highlight */}
      <div className="absolute top-2 left-2 w-4 h-4 bg-white/20 rounded-full" />
    </div>
  );
};

export default AssistantOrb;
