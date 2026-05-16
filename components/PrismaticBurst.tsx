
import React, { useEffect, useRef, memo } from 'react';
import { Renderer, Program, Mesh, Triangle, Texture } from 'ogl';

// Shader code
const vertexShader = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;

uniform float uIntensity;
uniform float uSpeed;
uniform int   uAnimType;
uniform vec2  uMouse;
uniform int   uColorCount;
uniform float uDistort;
uniform vec2  uOffset;
uniform sampler2D uGradient;
uniform float uNoiseAmount;
uniform int   uRayCount;
uniform vec2  uFocus;

// Pulse Uniforms
uniform float uPulseStrength;
uniform vec2  uPulseVector;
uniform float uPulseScale;

// Shockwave Uniform
uniform float uShockwave; // 0.0 to 1.0 progress
uniform vec2  uShockwaveCenter;

float hash21(vec2 p){
    p = floor(p);
    float f = 52.9829189 * fract(dot(p, vec2(0.065, 0.005)));
    return fract(f);
}

mat2 rot30(){ return mat2(0.8, -0.5, 0.5, 0.8); }

// Simplified noise for structural variance only, removed grain
float layeredNoise(vec2 fragPx){
    vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
    vec2 q = rot30() * p;
    float n = 0.0;
    n += 0.40 * hash21(q);
    n += 0.25 * hash21(q * 2.0 + 17.0);
    n += 0.20 * hash21(q * 4.0 + 47.0);
    return n;
}

vec3 rayDir(vec2 frag, vec2 res, vec2 offset, float dist){
    float focal = res.y * max(dist, 1e-3);
    return normalize(vec3(2.0 * (frag - offset) - res, focal));
}

float edgeFade(vec2 frag, vec2 res, vec2 offset){
    vec2 toC = frag - 0.5 * res - offset;
    float r = length(toC) / (0.5 * min(res.x, res.y));
    float x = clamp(r, 0.0, 1.0);
    float q = x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
    float s = q * 0.5;
    s = pow(s, 1.5);
    float tail = 1.0 - pow(1.0 - s, 2.0);
    s = mix(s, tail, 0.2);
    return clamp(s, 0.0, 1.0);
}

mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

vec3 sampleGradient(float t){
    t = clamp(t, 0.0, 1.0);
    return texture(uGradient, vec2(t, 0.5)).rgb;
}

vec2 rot2(vec2 v, float a){
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * v;
}

float bendAngle(vec3 q, float t){
    float a = 0.8 * sin(q.x * 0.55 + t * 0.6)
            + 0.7 * sin(q.y * 0.50 - t * 0.5)
            + 0.6 * sin(q.z * 0.60 + t * 0.7);
    return a;
}

void main(){
    vec2 frag = gl_FragCoord.xy;
    float t = uTime * uSpeed;
    float jitterAmp = 0.1 * clamp(uNoiseAmount, 0.0, 1.0);
    vec3 dir = rayDir(frag, uResolution, uOffset, 1.0);
    
    // START DITHERING: Offset march start by random amount to smooth out slicing artifacts
    float dither = hash21(frag);
    float marchT = dither * 0.15; 

    vec3 col = vec3(0.0);
    float n = layeredNoise(frag);
    vec4 c = cos(t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0));
    mat2 M2 = mat2(c.x, c.y, c.z, c.w);
    float amp = clamp(uDistort, 0.0, 50.0) * 0.15;

    // --- APPLY XY KEY SCALING (Mouse Directional) ---
    if (uPulseScale > 0.01) {
        vec2 uvCentered = (frag - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
        vec2 mouseCentered = uMouse * 2.0 - 1.0;
        float mouseDot = dot(normalize(uvCentered), normalize(mouseCentered));
        float mouseMask = smoothstep(0.4, 0.95, mouseDot);
        amp += uPulseScale * mouseMask * 0.3; 
    }

    mat3 rot3dMat = mat3(1.0);
    if(uAnimType == 1){
      vec3 ang = vec3(t * 0.31, t * 0.21, t * 0.17);
      rot3dMat = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x);
    }
    mat3 hoverMat = mat3(1.0);
    if(uAnimType == 2){
      vec2 m = uMouse * 2.0 - 1.0;
      vec3 ang = vec3(m.y * 0.6, m.x * 0.6, 0.0);
      hoverMat = rotY(ang.y) * rotX(ang.x);
    }

    // OPTIMIZATION: Reduced loop steps from 44 to 32 for performance on integrated GPUs
    for (int i = 0; i < 32; ++i) {
        vec3 P = marchT * dir;
        P.z -= 2.0;
        float rad = length(P);
        vec3 Pl = P * (10.0 / max(rad, 1e-6));

        if(uAnimType == 0){
            Pl.xz *= M2;
        } else if(uAnimType == 1){
            Pl = rot3dMat * Pl;
        } else {
            Pl = hoverMat * Pl;
        }

        // OPTIMIZATION: Increased base step length slightly to compensate for fewer steps
        // Was 0.12, now 0.15
        float stepLen = 0.15 + (n * jitterAmp);

        float grow = smoothstep(0.35, 3.0, marchT);
        float a1 = amp * grow * bendAngle(Pl * 0.6, t);
        float a2 = 0.5 * amp * grow * bendAngle(Pl.zyx * 0.5 + 3.1, t * 0.9);
        vec3 Pb = Pl;
        Pb.xz = rot2(Pb.xz, a1);
        Pb.xy = rot2(Pb.xy, a2);

        float rayPattern = smoothstep(
            0.4, 0.8, 
            sin(Pb.x + cos(Pb.y) * cos(Pb.z)) *
            sin(Pb.z + sin(Pb.y) * cos(Pb.x + t))
        );

        if (uRayCount > 0) {
            float ang = atan(Pb.y, Pb.x);
            float comb = 0.5 + 0.5 * cos(float(uRayCount) * ang);
            comb = pow(comb, 3.0);
            rayPattern *= smoothstep(0.15, 0.95, comb);
        }

        vec3 spectralDefault = 1.0 + vec3(
            cos(marchT * 3.0 + 0.0),
            cos(marchT * 3.0 + 1.0),
            cos(marchT * 3.0 + 2.0)
        );

        float saw = fract(marchT * 0.25);
        float tRay = saw * saw * (3.0 - 2.0 * saw);
        vec3 userGradient = 2.0 * sampleGradient(tRay);
        vec3 spectral = (uColorCount > 0) ? userGradient : spectralDefault;
        
        vec3 base = (0.06 / (0.4 + stepLen))
                  * smoothstep(5.0, 0.0, rad)
                  * spectral;

        if (uShockwave > 0.001) {
            float aspect = uResolution.x / uResolution.y;
            vec2 center = vec2(uShockwaveCenter.x, 1.0 - uShockwaveCenter.y) * 2.0 - 1.0;
            center.x *= aspect;
            vec3 shockP = P - vec3(center * 4.0, 0.0);
            float waveRad = uShockwave * 15.0; 
            float waveDist = abs(length(shockP) - waveRad);
            float wave = exp(-4.0 * waveDist * waveDist);
            float waveFade = smoothstep(1.0, 0.0, uShockwave);
            base += vec3(1.2, 1.1, 1.0) * wave * 3.0 * waveFade;
        }

        col += base * rayPattern;
        marchT += stepLen;
    }

    col *= edgeFade(frag, uResolution, uOffset);
    col *= uIntensity;

    if (uPulseStrength > 0.01) {
       vec2 uvCentered = (frag - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
       float dotP = dot(normalize(uvCentered), normalize(uPulseVector));
       float pulseMask = smoothstep(0.4, 0.95, dotP);
       col += col * pulseMask * uPulseStrength * 1.5; 
    }

    float focusLen = length(uFocus);
    if (focusLen > 0.01) {
       vec2 uvCentered = (frag - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
       float angleCos = dot(normalize(uvCentered), normalize(uFocus));
       float coneWidth = 0.4; 
       float mask = smoothstep(coneWidth - 0.5, coneWidth + 0.2, angleCos);
       col *= mix(1.0, mask, clamp(focusLen, 0.0, 1.0));
    }

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const hexToRgb01 = (hex: string) => {
  if (!hex) return [1, 1, 1];
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    const r = h[0], g = h[1], b = h[2];
    h = r + r + g + g + b + b;
  }
  const intVal = parseInt(h, 16);
  if (isNaN(intVal) || (h.length !== 6 && h.length !== 8)) return [1, 1, 1];
  const r = ((intVal >> 16) & 255) / 255;
  const g = ((intVal >> 8) & 255) / 255;
  const b = (intVal & 255) / 255;
  return [r, g, b];
};

const toPx = (v: any) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const num = parseFloat(s.replace('px', ''));
  return isNaN(num) ? 0 : num;
};

interface PrismaticBurstProps {
  intensity?: number;
  speed?: number;
  animationType?: 'rotate' | 'rotate3d' | 'hover';
  colors?: string[];
  distort?: number;
  paused?: boolean;
  offset?: { x: number; y: number };
  hoverDampness?: number;
  rayCount?: number;
  mixBlendMode?: string;
  focus?: { x: number; y: number };
  pulse?: { strength: number; x: number; y: number; scale: number };
  shockwave?: number; // 0 to 1
  shockwaveCenter?: { x: number; y: number };
}

const PrismaticBurstComponent: React.FC<PrismaticBurstProps> = ({
  intensity = 2,
  speed = 0.5,
  animationType = 'rotate3d',
  colors = ['#ffffff', '#ffffff', '#ffffff'],
  distort = 0,
  paused = false,
  offset = { x: 0, y: 0 },
  hoverDampness = 0,
  rayCount = 0,
  mixBlendMode = 'lighten',
  focus = { x: 0, y: 0 },
  pulse = { strength: 0, x: 0, y: 0, scale: 0 },
  shockwave = 0,
  shockwaveCenter = { x: 0.5, y: 0.5 }
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const mouseTargetRef = useRef([0.5, 0.5]);
  const mouseSmoothRef = useRef([0.5, 0.5]);
  const pausedRef = useRef(paused);
  const gradTexRef = useRef<any>(null);
  const hoverDampRef = useRef(hoverDampness);
  const isVisibleRef = useRef(true);
  const meshRef = useRef<any>(null);
  const speedRef = useRef(speed);

  // Sync refs
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { hoverDampRef.current = hoverDampness; }, [hoverDampness]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Initialization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let gl: any = null;
    let renderer: any = null;
    let program: any = null;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    try {
        // OPTIMIZATION: Force DPR to 1. 
        // Rendering raymarching at DPR 2 (Retina) kills integrated GPUs.
        const dpr = 1.0; 
        
        renderer = new Renderer({
            dpr,
            alpha: true,
            antialias: false,
            premultipliedAlpha: false
        });
        rendererRef.current = renderer;
        gl = renderer.gl;

        // Ensure container is ready
        gl.canvas.style.position = 'absolute';
        gl.canvas.style.inset = '0';
        gl.canvas.style.width = '100%';
        gl.canvas.style.height = '100%';
        gl.canvas.style.mixBlendMode = mixBlendMode && mixBlendMode !== 'none' ? mixBlendMode : 'normal';
        container.appendChild(gl.canvas);

        const white = new Uint8Array([255, 255, 255, 255]);
        const gradientTex = new Texture(gl, {
            image: white,
            width: 1,
            height: 1,
            generateMipmaps: false,
            flipY: false
        });
        
        gradientTex.minFilter = gl.LINEAR;
        gradientTex.magFilter = gl.LINEAR;
        gradientTex.wrapS = gl.CLAMP_TO_EDGE;
        gradientTex.wrapT = gl.CLAMP_TO_EDGE;
        gradTexRef.current = gradientTex;

        program = new Program(gl, {
            vertex: vertexShader,
            fragment: fragmentShader,
            uniforms: {
                uResolution: { value: [1, 1] },
                uTime: { value: 0 },
                uIntensity: { value: 1 },
                uSpeed: { value: 1 }, // Initialize with 1 as we bake speed into uTime
                uAnimType: { value: 0 },
                uMouse: { value: [0.5, 0.5] },
                uColorCount: { value: 0 },
                uDistort: { value: 0 },
                uOffset: { value: [0, 0] },
                uGradient: { value: gradientTex },
                uNoiseAmount: { value: 0.0 }, 
                uRayCount: { value: 0 },
                uFocus: { value: [0, 0] },
                uPulseStrength: { value: 0.0 },
                uPulseVector: { value: [0, 0] },
                uPulseScale: { value: 0.0 },
                uShockwave: { value: 0.0 },
                uShockwaveCenter: { value: [0.5, 0.5] }
            },
            transparent: true
        });
        programRef.current = program;

        const triangle = new Triangle(gl);
        const mesh = new Mesh(gl, { geometry: triangle, program });
        meshRef.current = mesh;

        // Resize
        const resize = () => {
            const w = container.clientWidth || 1;
            const h = container.clientHeight || 1;
            if (renderer) {
                renderer.setSize(w, h);
                if (gl) program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
            }
        };
        
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(resize);
            ro.observe(container);
        } else {
            window.addEventListener('resize', resize);
        }
        resize();

        // Intersection
        if ('IntersectionObserver' in window) {
            io = new IntersectionObserver(
                entries => {
                    if (entries[0]) isVisibleRef.current = entries[0].isIntersecting;
                },
                { root: null, threshold: 0.01 }
            );
            io.observe(container);
        }

        // Loop
        let last = performance.now();
        let accumTime = 0;
        const update = (now: number) => {
            const dt = Math.max(0, now - last) * 0.001;
            last = now;
            const visible = isVisibleRef.current && !document.hidden;
            
            // Integrate speed over time to prevent phase jumps on speed change
            if (!pausedRef.current) {
                accumTime += dt * (speedRef.current ?? 1);
            }

            if (visible && renderer && mesh) {
                const tau = 0.02 + Math.max(0, Math.min(1, hoverDampRef.current)) * 0.5;
                const alpha = 1 - Math.exp(-dt / tau);
                const tgt = mouseTargetRef.current;
                const sm = mouseSmoothRef.current;
                sm[0] += (tgt[0] - sm[0]) * alpha;
                sm[1] += (tgt[1] - sm[1]) * alpha;

                if (program) {
                    program.uniforms.uMouse.value = sm;
                    program.uniforms.uTime.value = accumTime;
                    program.uniforms.uSpeed.value = 1.0; // Force to 1.0 since speed is in accumTime
                }
                renderer.render({ scene: mesh });
            }
            raf = requestAnimationFrame(update);
        };
        raf = requestAnimationFrame(update);

    } catch (e) {
        console.error("WebGL Initialization failed:", e);
    }

    // Input handlers
    const onPointer = (e: any) => {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / Math.max(rect.width, 1);
        const y = (e.clientY - rect.top) / Math.max(rect.height, 1);
        mouseTargetRef.current = [Math.min(Math.max(x, 0), 1), Math.min(Math.max(y, 0), 1)];
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    
    const onVis = () => {};
    document.addEventListener('visibilitychange', onVis);

    return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVis);
        
        if (ro) ro.disconnect();
        else window.removeEventListener('resize', () => {});
        if (io) io.disconnect();

        try {
            if (gl && gl.canvas && gl.canvas.parentElement === container) {
                container.removeChild(gl.canvas);
            }
        } catch {}
        
        programRef.current = null;
        rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = rendererRef.current?.gl?.canvas;
    if (canvas) {
      canvas.style.mixBlendMode = mixBlendMode && mixBlendMode !== 'none' ? mixBlendMode : '';
    }
  }, [mixBlendMode]);

  // 1. Light-weight Uniform Updates (runs every frame during animation)
  useEffect(() => {
    const program = programRef.current;
    if (!program) return;

    program.uniforms.uIntensity.value = intensity ?? 1;
    // uSpeed handled in loop via accumTime
    program.uniforms.uFocus.value = [focus.x, focus.y];
    
    // Update Pulse Uniforms
    program.uniforms.uPulseStrength.value = pulse.strength ?? 0;
    program.uniforms.uPulseVector.value = [pulse.x, pulse.y];
    program.uniforms.uPulseScale.value = pulse.scale ?? 0;
    program.uniforms.uShockwave.value = shockwave ?? 0; // Update shockwave uniform
    program.uniforms.uShockwaveCenter.value = [shockwaveCenter.x, shockwaveCenter.y];

    const animTypeMap: Record<string, number> = {
      rotate: 0,
      rotate3d: 1,
      hover: 2
    };
    program.uniforms.uAnimType.value = animTypeMap[animationType ?? 'rotate'];

    program.uniforms.uDistort.value = typeof distort === 'number' ? distort : 0;

    const ox = toPx(offset?.x);
    const oy = toPx(offset?.y);
    program.uniforms.uOffset.value = [ox, oy];
    program.uniforms.uRayCount.value = Math.max(0, Math.floor(rayCount ?? 0));
    program.uniforms.uColorCount.value = colors && colors.length ? Math.min(colors.length, 64) : 0;
  }, [intensity, animationType, distort, offset, rayCount, focus, pulse, shockwave, shockwaveCenter, colors?.length]);

  // 2. Heavy Texture Updates (only when colors actually change)
  useEffect(() => {
     const program = programRef.current;
     const renderer = rendererRef.current;
     const gradTex = gradTexRef.current;
     if (!program || !renderer || !gradTex) return;

    if (Array.isArray(colors) && colors.length > 0) {
      const capped = colors.slice(0, 64);
      const count = capped.length;
      const data = new Uint8Array(count * 4);
      for (let i = 0; i < count; i++) {
        const [r, g, b] = hexToRgb01(capped[i]);
        data[i * 4 + 0] = Math.round(r * 255);
        data[i * 4 + 1] = Math.round(g * 255);
        data[i * 4 + 2] = Math.round(b * 255);
        data[i * 4 + 3] = 255;
      }
      gradTex.image = data;
      gradTex.width = count;
      gradTex.height = 1;
      gradTex.needsUpdate = true;
    }
  }, [colors]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
};

// Memoize to prevent re-renders when parent state updates unrelated to visuals
export const PrismaticBurst = memo(PrismaticBurstComponent);
