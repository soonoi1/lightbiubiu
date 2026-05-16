
export enum AgentState {
  IDLE = 'IDLE',         // 1
  LISTENING = 'LISTENING', // 2
  SPEAKING = 'SPEAKING',  // 3
  THINKING = 'THINKING',  // 4
  ALERT = 'ALERT'         // 5
}

export enum VisualMode {
  BLADE = 'BLADE',       // Perpendicular/Edge-on
  GRID = 'GRID',         // Horizontal side-by-side
  KINETIC = 'KINETIC',   // Z-depth stack
  RADIANCE = 'RADIANCE'  // Radial Burst / Gold Beam
}

export interface SimulationParams {
  colorBase: string;
  colorHighlight: string;
  movementSpeed: number;
  pulseIntensity: number;
  noiseFactor: number; // Random jitter
  spread: number; // Spacing factor
}

export const AGENT_CONFIGS: Record<AgentState, SimulationParams> = {
  [AgentState.IDLE]: {
    colorBase: 'rgba(200, 220, 255, 0.1)',
    colorHighlight: 'rgba(255, 255, 255, 0.4)',
    movementSpeed: 0.002,
    pulseIntensity: 0.025, // Reduced from 0.05
    noiseFactor: 0.0,
    spread: 60,
  },
  [AgentState.LISTENING]: {
    colorBase: 'rgba(235, 215, 150, 0.15)',
    colorHighlight: 'rgba(255, 245, 200, 0.9)',
    movementSpeed: 0.005,
    pulseIntensity: 0.05, // Reduced from 0.1
    noiseFactor: 0.02,
    spread: 80,
  },
  [AgentState.SPEAKING]: {
    colorBase: 'rgba(255, 255, 255, 0.2)',
    colorHighlight: 'rgba(255, 255, 255, 1.0)',
    movementSpeed: 0.03,
    pulseIntensity: 0.2, // Reduced from 0.4
    noiseFactor: 0.01,
    spread: 50,
  },
  [AgentState.THINKING]: {
    colorBase: 'rgba(50, 255, 100, 0.15)',
    colorHighlight: 'rgba(150, 255, 150, 0.7)',
    movementSpeed: 0.02,
    pulseIntensity: 0.025, // Reduced from 0.05
    noiseFactor: 0.06,
    spread: 40,
  },
  [AgentState.ALERT]: {
    colorBase: 'rgba(255, 50, 50, 0.2)',
    colorHighlight: 'rgba(255, 100, 0, 0.9)',
    movementSpeed: 0.01,
    pulseIntensity: 0.25, // Reduced from 0.5
    noiseFactor: 0.05,
    spread: 100,
  }
};
