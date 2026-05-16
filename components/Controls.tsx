
import React from 'react';
import { AgentState } from '../types';

interface ControlsProps {
  currentState: AgentState;
  onStateChange: (state: AgentState) => void;
}

export const Controls: React.FC<ControlsProps> = ({ currentState, onStateChange }) => {
  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-40 w-full">
      
      {/* Current State Display */}
      <div className="flex flex-col items-center animate-fade-in pointer-events-none">
        <h2 className="text-white/50 text-xs tracking-[0.5em] uppercase mb-2">System Status</h2>
        <div className="text-4xl font-light text-white tracking-widest uppercase transition-all duration-500" style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
          {currentState}
        </div>
      </div>

      {/* Inputs Guide - Now Interactive */}
      <div className="flex gap-2 mt-8">
        {[
            { key: '1', label: 'Idle', val: AgentState.IDLE },
            { key: '2', label: 'Listen', val: AgentState.LISTENING },
            { key: '3', label: 'Speak', val: AgentState.SPEAKING },
            { key: '4', label: 'Think', val: AgentState.THINKING },
            { key: '5', label: 'Alert', val: AgentState.ALERT }
        ].map((item) => (
            <button 
                key={item.key} 
                onClick={() => onStateChange(item.val)}
                className={`flex flex-col items-center px-4 py-2 border border-white/20 rounded backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/50 hover:scale-105 active:scale-95 ${currentState === item.val ? 'bg-white/20 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : ''}`}
            >
                <span className="text-xs font-bold text-white mb-1">[{item.key}]</span>
                <span className="text-[10px] text-white/70 uppercase">{item.label}</span>
            </button>
        ))}
      </div>
      
      <div className="flex gap-4 text-white/30 text-[10px] tracking-widest mt-2 uppercase pointer-events-none">
        <span>Mouse Move: Rotate</span>
        <span>•</span>
        <span>Click: Pulse</span>
        <span>•</span>
        <span>Hold [W]: Dynamic Spread</span>
        <span>•</span>
        <span>[X/Y]: Surface Waves</span>
      </div>
    </div>
  );
};
