export interface ModelSetupData {
  atomType: string;
  boundary: string;
  potentialModel: string;
  numAtoms: number;
  atomicMass: number;
  potentialParams?: {
    sigma: number;
    epsilon: number;
  };
}

export interface RunDynamicsData {
  simulationType: string;
  initialTemperature: number;
  initialVolume: number;
  timeStep: number;
  stepCount: number;
  interval: number;
}

export type ScriptData = number;

export interface InputData {
  ModelSetupData: ModelSetupData;
  RunDynamicsData: RunDynamicsData;
  ScriptData: ScriptData;
}

export interface OutputData {
  basic: {
    temperature: {
      sample: number;
      average: number;
    };
    pressure: {
      sample: number;
      average: number;
    };
    volume: {
      sample: number;
      average: number;
    };
  };
  energy: {
    total: {
      sample: number;
      average: number;
    };
    kinetic: {
      sample: number;
      average: number;
    };
    potential: {
      sample: number;
      average: number;
    };
  };
}

export interface rotateOpx {
  rotationAxis: 'x' | 'y' | 'z';
  sign: '+' | '-';
} 