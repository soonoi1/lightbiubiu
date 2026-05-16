
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PrismaticBurst } from './components/PrismaticBurst';
import { Controls } from './components/Controls';
import { DraggablePanel } from './components/DraggablePanel';
import { AgentState, AGENT_CONFIGS } from './types';

// Helper to parse rgba(r,g,b,a) to {hex, alpha}
const rgbaToState = (rgba: string) => {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return { hex: '#ffffff', alpha: 1 };
  
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  const a = match[4] ? parseFloat(match[4]) : 1;
  
  return { hex: `#${r}${g}${b}`, alpha: a };
};

// Helper to combine {hex, alpha} to rgba string
const stateToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// --- Color Math Helpers ---

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (c: number) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
};

const hslToRgb = (h: number, s: number, l: number) => {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l; 
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

const shiftHexHue = (hex: string, degree: number) => {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const newH = (h + degree + 360) % 360;
  const [nr, ng, nb] = hslToRgb(newH, s, l);
  return rgbToHex(nr, ng, nb);
};

interface GeometryConfig {
    rotation: number;
    spread: number;
    scaleX: number;
    scaleY: number;
    blur: number;
}

const DEFAULT_GEOMETRY = {
    rotation: 10,
    spread: 12,
    scaleX: 0.5,
    scaleY: 1.5,
    blur: 0
};

const DEFAULT_UI_COLORS = {
    baseHex: '#ff9500', baseAlpha: 0.55,
    highlightHex: '#fff1e0', highlightAlpha: 0.25
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function App() {
  const [agentState, setAgentState] = useState<AgentState>(AgentState.LISTENING);
  const [showUI, setShowUI] = useState(true);
  
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(1.0); 
  
  // Animation Values (Current)
  const [globalRotation, setGlobalRotation] = useState(DEFAULT_GEOMETRY.rotation); 
  const [globalSpread, setGlobalSpread] = useState(DEFAULT_GEOMETRY.spread);
  const [scaleFactors, setScaleFactors] = useState({ x: DEFAULT_GEOMETRY.scaleX, y: DEFAULT_GEOMETRY.scaleY });
  const [blurIntensity, setBlurIntensity] = useState(DEFAULT_GEOMETRY.blur);
  const [uiColors, setUiColors] = useState(DEFAULT_UI_COLORS);
  const [hueShift, setHueShift] = useState(0);

  // Targets for Lerp
  const targetsRef = useRef({
      rotation: DEFAULT_GEOMETRY.rotation,
      spread: DEFAULT_GEOMETRY.spread,
      scaleX: DEFAULT_GEOMETRY.scaleX,
      scaleY: DEFAULT_GEOMETRY.scaleY,
      blur: DEFAULT_GEOMETRY.blur,
      baseHex: DEFAULT_UI_COLORS.baseHex,
      baseAlpha: DEFAULT_UI_COLORS.baseAlpha,
      highlightHex: DEFAULT_UI_COLORS.highlightHex,
      highlightAlpha: DEFAULT_UI_COLORS.highlightAlpha
  });

  const [radianceFocus, setRadianceFocus] = useState({ x: 0, y: 0 }); 
  const [radiancePulse, setRadiancePulse] = useState({ strength: 0, x: 0, y: 0, scale: 0 }); 
  const [radianceSpeedBoost, setRadianceSpeedBoost] = useState(0);
  const [radianceShockwave, setRadianceShockwave] = useState(0);
  const [radianceShockwaveCenter, setRadianceShockwaveCenter] = useState({ x: 0.5, y: 0.5 });

  const [colorOverrides, setColorOverrides] = useState<Partial<Record<AgentState, { base?: string; highlight?: string }>>>({
      IDLE: { base: "rgba(255, 0, 149, 1)", highlight: "rgba(0, 85, 255, 0.55)" },
      LISTENING: { base: "rgba(255, 149, 0, 0.55)", highlight: "rgba(255, 241, 224, 0.25)" },
      THINKING: { base: "rgba(0, 255, 85, 0.98)", highlight: "rgba(0, 153, 204, 0.5)" },
      ALERT: { base: "rgba(255, 50, 50, 1)", highlight: "rgba(0, 17, 250, 0.05)" }
  });
  const [geoOverrides, setGeoOverrides] = useState<Partial<Record<AgentState, Partial<GeometryConfig>>>>({});

  const keysRef = useRef({ 
      plus: false, minus: false,
      arrowUp: false, arrowDown: false, arrowLeft: false, arrowRight: false,
      bracketLeft: false, bracketRight: false, keyX: false, keyY: false, keyK: false
  });
  
  const pulseRef = useRef({ strength: 0, scale: 0, x: 0, y: 0, isPulsing: false, speedBoost: 0 });
  const shockwaveRef = useRef({ active: false, value: 0, velocity: 0, center: { x: 0.5, y: 0.5 } });
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  // Update targets when state changes
  useEffect(() => {
    const currentConfig = AGENT_CONFIGS[agentState];
    const savedColors = colorOverrides[agentState];
    const effectiveBase = savedColors?.base || currentConfig.colorBase;
    const effectiveHighlight = savedColors?.highlight || currentConfig.colorHighlight;
    const baseState = rgbaToState(effectiveBase);
    const highlightState = rgbaToState(effectiveHighlight);
    
    const savedGeo = geoOverrides[agentState];

    targetsRef.current = {
        rotation: savedGeo?.rotation ?? DEFAULT_GEOMETRY.rotation,
        spread: savedGeo?.spread ?? DEFAULT_GEOMETRY.spread,
        scaleX: savedGeo?.scaleX ?? DEFAULT_GEOMETRY.scaleX,
        scaleY: savedGeo?.scaleY ?? DEFAULT_GEOMETRY.scaleY,
        blur: savedGeo?.blur ?? DEFAULT_GEOMETRY.blur,
        baseHex: baseState.hex,
        baseAlpha: baseState.alpha,
        highlightHex: highlightState.hex,
        highlightAlpha: highlightState.alpha
    };
  }, [agentState, colorOverrides, geoOverrides]);

  // Main Loop for smoothing and input
  useEffect(() => {
    let rafId: number;
    let currentFocus = { x: 0, y: 0 };
    const LERP_SPEED = 0.06; // Control the transition smoothness

    const loop = () => {
        // 1. Smooth Geometry Lerp
        setGlobalRotation(prev => lerp(prev, targetsRef.current.rotation, LERP_SPEED));
        setGlobalSpread(prev => lerp(prev, targetsRef.current.spread, LERP_SPEED));
        setBlurIntensity(prev => lerp(prev, targetsRef.current.blur, LERP_SPEED));
        setScaleFactors(prev => ({
            x: lerp(prev.x, targetsRef.current.scaleX, LERP_SPEED),
            y: lerp(prev.y, targetsRef.current.scaleY, LERP_SPEED)
        }));

        // 2. Smooth Color Lerp
        setUiColors(prev => {
            const targetBaseRgb = hexToRgb(targetsRef.current.baseHex);
            const currentBaseRgb = hexToRgb(prev.baseHex);
            const targetHighlightRgb = hexToRgb(targetsRef.current.highlightHex);
            const currentHighlightRgb = hexToRgb(prev.highlightHex);

            const nextBaseRgb = currentBaseRgb.map((c, i) => lerp(c, targetBaseRgb[i], LERP_SPEED));
            const nextHighlightRgb = currentHighlightRgb.map((c, i) => lerp(c, targetHighlightRgb[i], LERP_SPEED));
            
            return {
                baseHex: rgbToHex(nextBaseRgb[0], nextBaseRgb[1], nextBaseRgb[2]),
                baseAlpha: lerp(prev.baseAlpha, targetsRef.current.baseAlpha, LERP_SPEED),
                highlightHex: rgbToHex(nextHighlightRgb[0], nextHighlightRgb[1], nextHighlightRgb[2]),
                highlightAlpha: lerp(prev.highlightAlpha, targetsRef.current.highlightAlpha, LERP_SPEED)
            };
        });

        // 3. Handle Keyboard Inputs
        if (keysRef.current.plus) setHueShift(prev => (prev + 2) % 360);
        if (keysRef.current.minus) setHueShift(prev => (prev - 2 + 360) % 360);

        let tx = 0, ty = 0, hasInput = false;
        if (keysRef.current.arrowUp) { ty = 1; hasInput = true; }
        if (keysRef.current.arrowDown) { ty = -1; hasInput = true; }
        if (keysRef.current.arrowRight) { tx = 1; hasInput = true; }
        if (keysRef.current.arrowLeft) { tx = -1; hasInput = true; }
        
        if (hasInput) {
            const len = Math.max(0.1, Math.sqrt(tx*tx + ty*ty));
            tx /= len; ty /= len;
        }

        currentFocus.x = lerp(currentFocus.x, hasInput ? tx : 0, 0.05);
        currentFocus.y = lerp(currentFocus.y, hasInput ? ty : 0, 0.05);
        setRadianceFocus({ ...currentFocus });

        // 4. Pulse & Shockwave
        const pState = pulseRef.current;
        pState.strength = lerp(pState.strength, pState.isPulsing ? 0.75 : 0, 0.05);
        const targetScale = (keysRef.current.keyX || keysRef.current.keyY) ? 2.0 : 0;
        pState.scale = lerp(pState.scale, targetScale, 0.05);
        pState.speedBoost = lerp(pState.speedBoost, 0, 0.015);
        
        setRadiancePulse({ strength: pState.strength, x: pState.x, y: pState.y, scale: pState.scale });
        setRadianceSpeedBoost(pState.speedBoost);

        if (shockwaveRef.current.active) {
            shockwaveRef.current.value += Math.max(shockwaveRef.current.velocity, 0.008);
            shockwaveRef.current.velocity *= 0.96; 
            if (shockwaveRef.current.value > 1.4) shockwaveRef.current.active = false;
        }
        setRadianceShockwave(shockwaveRef.current.active ? shockwaveRef.current.value : 0);
        setRadianceShockwaveCenter(shockwaveRef.current.center);

        if (keysRef.current.bracketRight) targetsRef.current.scaleY = Math.min(10, targetsRef.current.scaleY + 0.02);
        if (keysRef.current.bracketLeft) targetsRef.current.scaleY = Math.max(0.1, targetsRef.current.scaleY - 0.02);

        rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Update manual overrides
  const updateGeoParam = (updates: Partial<GeometryConfig>) => {
      if (updates.rotation !== undefined) targetsRef.current.rotation = updates.rotation;
      if (updates.spread !== undefined) targetsRef.current.spread = updates.spread;
      if (updates.scaleX !== undefined) targetsRef.current.scaleX = updates.scaleX;
      if (updates.scaleY !== undefined) targetsRef.current.scaleY = updates.scaleY;
      if (updates.blur !== undefined) targetsRef.current.blur = updates.blur;

      setGeoOverrides(prev => ({
          ...prev,
          [agentState]: { ...(prev[agentState] || {}), ...updates }
      }));
  };

  const updateBaseColor = (hex: string, alpha: number) => {
    targetsRef.current.baseHex = hex;
    targetsRef.current.baseAlpha = alpha;
    const rgba = stateToRgba(hex, alpha);
    setColorOverrides(prev => ({ ...prev, [agentState]: { ...prev[agentState], base: rgba } }));
  };

  const updateHighlightColor = (hex: string, alpha: number) => {
    targetsRef.current.highlightHex = hex;
    targetsRef.current.highlightAlpha = alpha;
    const rgba = stateToRgba(hex, alpha);
    setColorOverrides(prev => ({ ...prev, [agentState]: { ...prev[agentState], highlight: rgba } }));
  };

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const states = [AgentState.IDLE, AgentState.LISTENING, AgentState.SPEAKING, AgentState.THINKING, AgentState.ALERT];
        setAgentState(states[parseInt(e.key) - 1]);
      }
      if (e.key.toLowerCase() === 'h') setShowUI(prev => !prev);
      if (e.key.toLowerCase() === 'k') {
          shockwaveRef.current.active = true;
          shockwaveRef.current.value = 0;
          shockwaveRef.current.center = { ...mouseRef.current };
          shockwaveRef.current.velocity = 0.02;
      }
      if (e.key === '=' || e.key === '+') keysRef.current.plus = true;
      if (e.key === '-' || e.key === '_') keysRef.current.minus = true;
      if (e.key === 'ArrowUp') keysRef.current.arrowUp = true;
      if (e.key === 'ArrowDown') keysRef.current.arrowDown = true;
      if (e.key === 'ArrowLeft') keysRef.current.arrowLeft = true;
      if (e.key === 'ArrowRight') keysRef.current.arrowRight = true;
      if (e.key === ']') keysRef.current.bracketRight = true;
      if (e.key === '[') keysRef.current.bracketLeft = true;
      if (e.key.toLowerCase() === 'x') keysRef.current.keyX = true;
      if (e.key.toLowerCase() === 'y') keysRef.current.keyY = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
       if (e.key === '=' || e.key === '+') keysRef.current.plus = false;
       if (e.key === '-' || e.key === '_') keysRef.current.minus = false;
       if (e.key === 'ArrowUp') keysRef.current.arrowUp = false;
       if (e.key === 'ArrowDown') keysRef.current.arrowDown = false;
       if (e.key === 'ArrowLeft') keysRef.current.arrowLeft = false;
       if (e.key === 'ArrowRight') keysRef.current.arrowRight = false;
       if (e.key === ']') keysRef.current.bracketRight = false;
       if (e.key === '[') keysRef.current.bracketLeft = false;
       if (e.key.toLowerCase() === 'x') keysRef.current.keyX = false;
       if (e.key.toLowerCase() === 'y') keysRef.current.keyY = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, []);

  const effectiveBaseHex = shiftHexHue(uiColors.baseHex, hueShift);
  const effectiveHighlightHex = shiftHexHue(uiColors.highlightHex, hueShift);
  const burstColors = useMemo(() => [effectiveHighlightHex, effectiveBaseHex, effectiveHighlightHex], [effectiveHighlightHex, effectiveBaseHex]);

  return (
    <div 
        className="relative w-screen h-screen bg-black overflow-hidden font-sans select-none"
        onMouseDown={(e) => { if (e.button === 0) pulseRef.current.isPulsing = true; }}
        onMouseUp={() => { pulseRef.current.isPulsing = false; }}
        onMouseMove={(e) => {
            const w = window.innerWidth, h = window.innerHeight;
            mouseRef.current = { x: e.clientX / w, y: e.clientY / h };
            pulseRef.current.x = (e.clientX / w) * 2 - 1;
            pulseRef.current.y = -((e.clientY / h) * 2 - 1);
        }}
        onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 z-0">
         <div 
           className="w-full h-full relative"
           style={{ filter: blurIntensity > 0 ? `blur(${blurIntensity}px)` : 'none' }}
         >
            <PrismaticBurst 
                intensity={scaleFactors.y}
                distort={scaleFactors.x}
                rayCount={globalSpread}
                speed={globalRotation * 0.05 + (radianceSpeedBoost * 0.1)}
                colors={burstColors}
                animationType="rotate3d"
                mixBlendMode="screen"
                focus={radianceFocus}
                pulse={radiancePulse}
                shockwave={radianceShockwave}
                shockwaveCenter={radianceShockwaveCenter}
            />
         </div>
      </div>

      {overlayImage && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
              <img src={overlayImage} alt="Reference" className="max-w-full max-h-full object-contain" style={{ opacity: overlayOpacity }} />
          </div>
      )}

      <div className={`transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Controls currentState={agentState} onStateChange={setAgentState} />
          
          <DraggablePanel title="SHADER CONFIG" initialX={32} initialY={window.innerHeight - 560} initialWidth={240} initialHeight={480}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between"><label className="text-[9px] text-white/40 uppercase">Intensity</label><span className="text-[9px] text-white">{targetsRef.current.scaleY.toFixed(2)}</span></div>
                    <input type="range" min="0.1" max="5.0" step="0.1" value={targetsRef.current.scaleY} onChange={(e) => updateGeoParam({ scaleY: Number(e.target.value) })} className="w-full h-1 accent-white" />
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between"><label className="text-[9px] text-white/40 uppercase">Distortion</label><span className="text-[9px] text-white">{targetsRef.current.scaleX.toFixed(2)}</span></div>
                    <input type="range" min="0" max="3" step="0.1" value={targetsRef.current.scaleX} onChange={(e) => updateGeoParam({ scaleX: Number(e.target.value) })} className="w-full h-1 accent-white" />
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between"><label className="text-[9px] text-white/40 uppercase">Ray Count</label><span className="text-[9px] text-white">{Math.round(targetsRef.current.spread)}</span></div>
                    <input type="range" min="0" max="64" step="1" value={targetsRef.current.spread} onChange={(e) => updateGeoParam({ spread: Number(e.target.value) })} className="w-full h-1 accent-white" />
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between"><label className="text-[9px] text-white/40 uppercase">Speed</label><span className="text-[9px] text-white">{targetsRef.current.rotation.toFixed(0)}</span></div>
                    <input type="range" min="0" max="50" step="1" value={targetsRef.current.rotation} onChange={(e) => updateGeoParam({ rotation: Number(e.target.value) })} className="w-full h-1 accent-white" />
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between"><label className="text-[9px] text-white/40 uppercase">Gaussian Blur</label><span className="text-[9px] text-white">{targetsRef.current.blur.toFixed(0)}px</span></div>
                    <input type="range" min="0" max="60" step="1" value={targetsRef.current.blur} onChange={(e) => updateGeoParam({ blur: Number(e.target.value) })} className="w-full h-1 accent-white" />
                </div>
            </div>
          </DraggablePanel>

          <DraggablePanel title="APPEARANCE" initialX={window.innerWidth - 360} initialY={window.innerHeight - 320} initialWidth={340} initialHeight={280}>
             <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-white/60 uppercase">Hue Shift: {Math.round(hueShift)}°</label>
                        <input type="range" min="0" max="360" value={hueShift} onChange={(e) => setHueShift(Number(e.target.value))} className="w-full h-1 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 rounded" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] text-white/60 uppercase">Base Color</label>
                        <div className="flex gap-2">
                            <input type="color" value={targetsRef.current.baseHex} onChange={(e) => updateBaseColor(e.target.value, targetsRef.current.baseAlpha)} className="w-6 h-6 bg-transparent" />
                            <input type="range" min="0" max="1" step="0.01" value={targetsRef.current.baseAlpha} onChange={(e) => updateBaseColor(targetsRef.current.baseHex, parseFloat(e.target.value))} className="flex-1 h-1 mt-2 accent-white" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] text-white/60 uppercase">Highlight Color</label>
                        <div className="flex gap-2">
                            <input type="color" value={targetsRef.current.highlightHex} onChange={(e) => updateHighlightColor(e.target.value, targetsRef.current.highlightAlpha)} className="w-6 h-6 bg-transparent" />
                            <input type="range" min="0" max="1" step="0.01" value={targetsRef.current.highlightAlpha} onChange={(e) => updateHighlightColor(targetsRef.current.highlightHex, parseFloat(e.target.value))} className="flex-1 h-1 mt-2 accent-white" />
                        </div>
                    </div>
                 </div>
                 <div className="flex flex-col gap-3 pl-4 border-l border-white/5">
                     <h3 className="text-white/30 text-[9px] uppercase tracking-widest mb-1">Overlay Reference</h3>
                     <input type="file" onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                             const reader = new FileReader();
                             reader.onload = (event) => setOverlayImage(event.target?.result as string);
                             reader.readAsDataURL(file);
                         }
                     }} accept="image/*" className="text-[9px] text-white/40" />
                     {overlayImage && (
                        <div className="flex flex-col gap-1 mt-2">
                            <label className="text-[9px] text-white/60 uppercase">Opacity</label>
                            <input type="range" min="0" max="1" step="0.01" value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))} className="w-full h-1 accent-white" />
                            <button onClick={() => setOverlayImage(null)} className="text-[9px] text-red-400/60 hover:text-red-400 mt-2 text-left uppercase">Clear Image</button>
                        </div>
                     )}
                 </div>
             </div>
          </DraggablePanel>
      </div>
    </div>
  );
}
