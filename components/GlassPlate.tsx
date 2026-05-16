
import React, { forwardRef } from 'react';
import { VisualMode } from '../types';

interface GlassPlateProps {
  index: number;
  total: number;
  visualMode?: VisualMode;
}

export const GlassPlate = forwardRef<HTMLDivElement, GlassPlateProps>(({ index, total, visualMode }, ref) => {
  const isRadiance = visualMode === VisualMode.RADIANCE;

  return (
    <div
      ref={ref}
      className="absolute top-1/2 left-1/2 origin-center pointer-events-none will-change-transform overflow-hidden border"
      style={{
        transform: 'translate(-50%, -50%)',
        // Dynamic border color handled by parent via style.borderColor
        // But we set a base border style here.
        borderWidth: isRadiance ? '0px' : '1px',
        // Background logic:
        // Standard: Glassy gradient
        // Radiance: Gold/Black gradient with high contrast
        background: isRadiance 
            ? 'linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(255, 215, 0, 0.1) 40%, rgba(255, 223, 100, 0.4) 100%)'
            : 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(2px)', 
        boxShadow: isRadiance 
            ? '0 0 30px rgba(255, 200, 50, 0.1)' 
            : '0 0 15px rgba(255,255,255,0.05)',
        mixBlendMode: 'screen', 
      }}
    >
      {/* Texture Layer */}
      {isRadiance ? (
         // Brushed Metal for Radiance
         <div 
            className="absolute inset-0 opacity-40 mix-blend-overlay"
            style={{
                backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0,0,0,0.5) 1px, rgba(0,0,0,0.5) 2px), linear-gradient(to bottom, transparent, #ffd700)`,
                backgroundSize: '4px 100%, 100% 100%'
            }}
         />
      ) : (
         // Carbon Fiber for Standard
         <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-repeat mix-blend-overlay" />
      )}
      
      {/* Dynamic Energy Bar */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent blur-md ${
            isRadiance ? 'top-0 bottom-0 w-full opacity-50' : 'top-[10%] bottom-[10%] w-[40px]'
        }`} 
        style={{
            background: isRadiance ? 'linear-gradient(to top, transparent, rgba(255, 215, 0, 0.6))' : undefined
        }}
      />
    </div>
  );
});

GlassPlate.displayName = 'GlassPlate';
