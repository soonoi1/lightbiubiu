
import React, { useEffect, useRef, useCallback } from 'react';
import { AgentState, AGENT_CONFIGS, VisualMode } from '../types';
import { GlassPlate } from './GlassPlate';

interface AgentCoreProps {
  currentState: AgentState;
  visualMode: VisualMode;
  globalRotation: number;
  globalSpread: number;
  customColors?: {
    base?: string;
    highlight?: string;
  };
  dimensions: {
    width: number;
    height: number;
    radius: number;
  };
  scaleFactors: {
    x: number;
    y: number;
  };
}

// -- Mathematics & Physics Helpers --

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

const parseRgba = (color: string) => {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return [0, 0, 0, 0];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseFloat(match[4] || '1')];
};

interface Wave {
  id: number;
  type: 'x' | 'y';
  originIndex: number;
  startTime: number;
}

// Structure to hold current visual state for smooth transitions
interface PlateTransform {
  tx: number; ty: number; tz: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number;
  opacity: number;
  width: number;
  height: number;
  borderRadius: number;
}

export const AgentCore: React.FC<AgentCoreProps> = (props) => {
  const { currentState, visualMode, globalRotation, globalSpread, customColors, dimensions, scaleFactors } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const platesRef = useRef<(HTMLDivElement | null)[]>([]);
  
  // -- Stable Props Access --
  const latestProps = useRef(props);
  useEffect(() => {
      latestProps.current = props;
  });

  // -- Internal Physics State --
  // Storing colors as arrays [r,g,b,a] for smooth non-integer interpolation
  const physicsState = useRef({
      rotation: globalRotation,
      spread: globalSpread,
      width: dimensions.width,
      height: dimensions.height,
      radius: dimensions.radius,
      scaleX: scaleFactors.x,
      scaleY: scaleFactors.y,
      
      // Simulation params
      movementSpeed: AGENT_CONFIGS[currentState].movementSpeed,
      pulseIntensity: AGENT_CONFIGS[currentState].pulseIntensity,
      noiseFactor: AGENT_CONFIGS[currentState].noiseFactor,
      
      // Color state (Float precision)
      baseRgba: parseRgba(customColors?.base || AGENT_CONFIGS[currentState].colorBase),
      highlightRgba: parseRgba(customColors?.highlight || AGENT_CONFIGS[currentState].colorHighlight),

      // Radiance Specific
      focusX: 0,
      focusY: 0,
  });

  // Initialize transforms buffer
  const transformsRef = useRef<PlateTransform[]>([]);
  if (transformsRef.current.length === 0) {
    for (let i = 0; i < 15; i++) {
        transformsRef.current.push({
            tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, opacity: 0,
            width: dimensions.width, height: dimensions.height, borderRadius: dimensions.radius
        });
    }
  }
  
  const timeRef = useRef(0);
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isWPressed = useRef(false);
  
  const inputVector = useRef({ x: 0, y: 0 });
  const wavesRef = useRef<Wave[]>([]);
  const waveIdCounter = useRef(0);
  const clickImpulse = useRef(0);

  const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    mouse.current.targetX = x;
    mouse.current.targetY = y;
  }, []);

  const handleClick = useCallback(() => {
    clickImpulse.current = 1.0;
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const PLATE_COUNT = 15;
      
      if (k === 'w') isWPressed.current = true;
      if (e.key === 'ArrowUp') inputVector.current.y = -1;
      if (e.key === 'ArrowDown') inputVector.current.y = 1;
      if (e.key === 'ArrowLeft') inputVector.current.x = -1;
      if (e.key === 'ArrowRight') inputVector.current.x = 1;

      if (k === 'x' || k === 'y') {
        const mouseX01 = (mouse.current.x + 1) / 2;
        const originIndex = Math.round(mouseX01 * (PLATE_COUNT - 1));
        const clampedIndex = Math.max(0, Math.min(PLATE_COUNT - 1, originIndex));

        wavesRef.current.push({
          id: waveIdCounter.current++,
          type: k as 'x' | 'y',
          originIndex: clampedIndex,
          startTime: timeRef.current
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'w') isWPressed.current = false;
        
        if (e.key === 'ArrowUp' && inputVector.current.y === -1) inputVector.current.y = 0;
        if (e.key === 'ArrowDown' && inputVector.current.y === 1) inputVector.current.y = 0;
        if (e.key === 'ArrowLeft' && inputVector.current.x === -1) inputVector.current.x = 0;
        if (e.key === 'ArrowRight' && inputVector.current.x === 1) inputVector.current.x = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    }
  }, []);

  // -- Main Animation Loop --
  useEffect(() => {
    let animationFrameId: number;
    const PLATE_COUNT = 15;

    const loop = () => {
      const currentProps = latestProps.current;
      const phys = physicsState.current;
      const smoothFactor = 0.1;

      // 1. Data Mixing 
      phys.rotation = lerp(phys.rotation, currentProps.globalRotation, smoothFactor);
      
      let targetSpread = currentProps.globalSpread;
      if (isWPressed.current) {
          targetSpread = (mouse.current.x + 1) * 100 + 10;
      }
      phys.spread = lerp(phys.spread, targetSpread, isWPressed.current ? 0.1 : smoothFactor);

      // Radiance Focus
      phys.focusX = lerp(phys.focusX, inputVector.current.x, 0.05);
      phys.focusY = lerp(phys.focusY, inputVector.current.y, 0.05);
      
      phys.width = lerp(phys.width, currentProps.dimensions.width, smoothFactor);
      phys.height = lerp(phys.height, currentProps.dimensions.height, smoothFactor);
      phys.radius = lerp(phys.radius, currentProps.dimensions.radius, smoothFactor);
      phys.scaleX = lerp(phys.scaleX, currentProps.scaleFactors.x, smoothFactor);
      phys.scaleY = lerp(phys.scaleY, currentProps.scaleFactors.y, smoothFactor);

      // Config mixing
      const baseConfig = AGENT_CONFIGS[currentProps.currentState];
      let targetColorBaseStr = baseConfig.colorBase;
      let targetColorHighlightStr = baseConfig.colorHighlight;
      
      if (currentProps.visualMode === VisualMode.RADIANCE) {
          targetColorBaseStr = 'rgba(20, 15, 0, 0.8)';
          targetColorHighlightStr = 'rgba(255, 215, 0, 1.0)';
      }

      // Prioritize Custom Colors
      if (currentProps.customColors?.base) targetColorBaseStr = currentProps.customColors.base;
      if (currentProps.customColors?.highlight) targetColorHighlightStr = currentProps.customColors.highlight;

      const targetConfig = {
          ...baseConfig,
          movementSpeed: baseConfig.movementSpeed,
          pulseIntensity: baseConfig.pulseIntensity,
          noiseFactor: baseConfig.noiseFactor,
      };

      const mixSpeed = 0.05;
      
      // Smooth numeric params
      phys.movementSpeed = lerp(phys.movementSpeed, targetConfig.movementSpeed, mixSpeed);
      phys.pulseIntensity = lerp(phys.pulseIntensity, targetConfig.pulseIntensity, mixSpeed);
      phys.noiseFactor = lerp(phys.noiseFactor, targetConfig.noiseFactor, mixSpeed);

      // --- Precise Color Interpolation ---
      // Instead of rounding strings (which causes banding), we lerp the float values of the channels
      const targetBaseRgba = parseRgba(targetColorBaseStr);
      const targetHighlightRgba = parseRgba(targetColorHighlightStr);
      
      for (let i = 0; i < 4; i++) {
        phys.baseRgba[i] = lerp(phys.baseRgba[i], targetBaseRgba[i], mixSpeed);
        phys.highlightRgba[i] = lerp(phys.highlightRgba[i], targetHighlightRgba[i], mixSpeed);
      }
      
      // Construct CSS strings for this frame
      const cssColorBase = `rgba(${Math.round(phys.baseRgba[0])},${Math.round(phys.baseRgba[1])},${Math.round(phys.baseRgba[2])},${phys.baseRgba[3]})`;
      const cssColorHighlight = `rgba(${Math.round(phys.highlightRgba[0])},${Math.round(phys.highlightRgba[1])},${Math.round(phys.highlightRgba[2])},${phys.highlightRgba[3]})`;

      // 2. Physics Step
      timeRef.current += phys.movementSpeed;
      clickImpulse.current *= 0.92; 

      mouse.current.x = lerp(mouse.current.x, mouse.current.targetX, 0.05);
      mouse.current.y = lerp(mouse.current.y, mouse.current.targetY, 0.05);

      wavesRef.current = wavesRef.current.filter(w => (timeRef.current - w.startTime) < 5.0);

      const heartbeat = Math.sin(timeRef.current * 4) * phys.pulseIntensity;
      const breathing = Math.sin(timeRef.current * 1.5) * 0.05;

      // 3. Render Geometry
      platesRef.current.forEach((plate, i) => {
        if (!plate) return;

        // Access current smooth state for this plate
        const prevT = transformsRef.current[i];

        const offsetFromCenter = i - (PLATE_COUNT - 1) / 2;
        const normOffset = offsetFromCenter / (PLATE_COUNT / 2);
        const distFromCenter = Math.abs(normOffset);

        // --- Wave Effect ---
        let waveScaleX = 0;
        let waveScaleY = 0;
        wavesRef.current.forEach(wave => {
           const timeAlive = (timeRef.current - wave.startTime) * 20; 
           const distFromOrigin = Math.abs(i - wave.originIndex);
           if (Math.abs(distFromOrigin - timeAlive) < 2.5) {
             const magnitude = Math.max(0, 1 - Math.abs(distFromOrigin - timeAlive) / 2.5) * Math.min(1, timeAlive/4) * Math.exp(-timeAlive * 0.1);
             if (wave.type === 'x') waveScaleX += magnitude;
             if (wave.type === 'y') waveScaleY += magnitude;
           }
        });

        // Calculate Target Transforms
        let t_tx = 0, t_ty = 0, t_tz = 0;
        let t_rx = 0, t_ry = 0, t_rz = 0;
        let t_sx = 1, t_sy = 1;
        let t_opacity = 1;
        let t_radius = phys.radius;
        
        const mode = currentProps.visualMode;
        const currentSpread = phys.spread;

        if (mode === VisualMode.RADIANCE) {
            // Circular Distribution
            const angleStep = (Math.PI * 2) / PLATE_COUNT;
            const angle = i * angleStep - (Math.PI / 2); // Start from top
            
            // Radius from center
            const r = currentSpread * 2; // Spread acts as inner radius
            
            t_tx = Math.cos(angle) * r;
            t_ty = Math.sin(angle) * r;
            t_tz = 0;
            
            // Rotate to point outward
            t_rz = (angle * 180 / Math.PI) - 90;
            t_rx = 20 * Math.sin(timeRef.current + i); // Subtle undulation
            
            // Interaction: Spotlight
            const plateVx = Math.cos(angle);
            const plateVy = Math.sin(angle);
            
            const focusMag = Math.sqrt(phys.focusX*phys.focusX + phys.focusY*phys.focusY);
            let focusFactor = 1;
            
            if (focusMag > 0.1) {
                const fx = phys.focusX / focusMag;
                const fy = phys.focusY / focusMag;
                const dot = plateVx * fx + plateVy * fy;
                focusFactor = Math.max(0, (dot + 0.5) / 1.5); 
                focusFactor = Math.pow(focusFactor, 3); 
            }

            t_sx = 1 + waveScaleX + breathing;
            t_sy = 1 + waveScaleY + (focusFactor * 0.5); // Grow when focused
            
            t_opacity = 0.3 + (focusFactor * 0.7) + (heartbeat * 0.5);
            
            t_tx += Math.cos(timeRef.current * 0.5 + i) * 10;
            t_ty += Math.sin(timeRef.current * 0.5 + i) * 10;
            
            t_radius = 4; // Sharp beams

        } else if (mode === VisualMode.BLADE) {
            t_tx = offsetFromCenter * (currentSpread * 0.6); 
            const distToMouse = Math.abs(normOffset - mouse.current.x);
            const mouseInfluence = Math.max(0, 1 - distToMouse * 1.5); 
            t_ry = phys.rotation + (mouse.current.x * 60 * mouseInfluence); 
            t_sy = 1 + (1 - distFromCenter)*0.1 + heartbeat + (clickImpulse.current * 0.2) + (waveScaleY * 0.8);
            t_sx = 1 + (waveScaleX * 2.0);
            t_tz = distFromCenter * -100 + (breathing * 50);
            t_opacity = 1 - distFromCenter * 0.4;
            if (phys.noiseFactor > 0.01) t_ty += (Math.random() - 0.5) * phys.noiseFactor * 20;

        } else if (mode === VisualMode.GRID) {
            t_tx = offsetFromCenter * (currentSpread * 0.8);
            t_ry = mouse.current.x * 20 + (offsetFromCenter * 2);
            t_rx = mouse.current.y * -20;
            t_sy = 1 + waveScaleY;
            t_sx = 1 + waveScaleX;
            t_tz = distFromCenter * -50 + (waveScaleX * 50);
            t_ty = Math.sin(timeRef.current * 2 + normOffset * 3) * 20;
            
        } else { // KINETIC
            t_tz = offsetFromCenter * -currentSpread + (waveScaleY * 100);
            t_tx = mouse.current.x * offsetFromCenter * 5;
            t_ty = mouse.current.y * offsetFromCenter * 5;
            t_rx = mouse.current.y * -15;
            t_ry = mouse.current.x * 15;
            t_rz = offsetFromCenter * 2;
            t_sx = 1 + waveScaleX;
            t_sy = 1 + waveScaleY;
            t_opacity = 1 - (Math.abs(offsetFromCenter) / (PLATE_COUNT)) * 0.8;
        }

        // Apply scale factors from physics state
        t_sx *= phys.scaleX;
        t_sy *= phys.scaleY;

        // --- Smooth Interpolation (The Magic) ---
        // Lerp current transform values towards target values
        const lerpSpeed = 0.08; // Smoothness factor
        
        prevT.tx = lerp(prevT.tx, t_tx, lerpSpeed);
        prevT.ty = lerp(prevT.ty, t_ty, lerpSpeed);
        prevT.tz = lerp(prevT.tz, t_tz, lerpSpeed);
        prevT.rx = lerp(prevT.rx, t_rx, lerpSpeed);
        prevT.ry = lerp(prevT.ry, t_ry, lerpSpeed);
        prevT.rz = lerp(prevT.rz, t_rz, lerpSpeed);
        prevT.sx = lerp(prevT.sx, t_sx, lerpSpeed);
        prevT.sy = lerp(prevT.sy, t_sy, lerpSpeed);
        prevT.opacity = lerp(prevT.opacity, t_opacity, lerpSpeed);
        prevT.width = lerp(prevT.width, phys.width, lerpSpeed);
        prevT.height = lerp(prevT.height, phys.height, lerpSpeed);
        
        // Smoother radius interpolation
        prevT.borderRadius = lerp(prevT.borderRadius, t_radius, lerpSpeed);

        // Apply computed styles to DOM
        plate.style.width = `${prevT.width}px`;
        plate.style.height = `${prevT.height}px`;
        plate.style.borderRadius = `${prevT.borderRadius}px`;
        
        plate.style.transform = `
            translate3d(calc(-50% + ${prevT.tx}px), calc(-50% + ${prevT.ty}px), ${prevT.tz}px)
            rotateX(${prevT.rx}deg)
            rotateY(${prevT.ry}deg)
            rotateZ(${prevT.rz}deg)
            scale(${prevT.sx}, ${prevT.sy})
        `;
        
        plate.style.opacity = prevT.opacity.toString();
        plate.style.borderColor = cssColorHighlight;
        plate.style.backgroundColor = mode === VisualMode.RADIANCE ? 'rgba(0,0,0,0)' : cssColorBase;
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
    };
  }, []); 

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      ref={containerRef}
      style={{
        perspective: visualMode === VisualMode.KINETIC ? '1200px' : '1000px',
        background: 'radial-gradient(ellipse at center, #101015 0%, #000000 90%)'
      }}
    >
      {/* Dynamic Background Light */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 pointer-events-none transition-all duration-1000"
        style={{
          // Use the computed numeric colors for background as well? 
          // For now, using the string version from props/state is okay as it's a slow background gradient
          // But to be consistent with the plates, let's just use the current highlight color from config for simplicity
          // or we can just leave this as is since the jitter isn't as noticeable on a giant blurry blob
          background: `radial-gradient(circle, ${latestProps.current.customColors?.highlight || AGENT_CONFIGS[latestProps.current.currentState].colorHighlight} 0%, transparent 70%)`,
          filter: 'blur(80px)',
          transform: `translate(-50%, -50%) scale(${1 + Math.sin(Date.now()/2000)*0.2})`
        }}
      />

      <div className="relative transform-style-3d w-0 h-0 z-10"> 
         {Array.from({ length: 15 }).map((_, i) => (
           <GlassPlate 
             key={i} 
             index={i} 
             total={15}
             visualMode={visualMode}
             ref={(el) => { platesRef.current[i] = el; }} 
           />
         ))}
      </div>
    </div>
  );
};
