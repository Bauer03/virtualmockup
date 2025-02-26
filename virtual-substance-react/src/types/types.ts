import React from 'react';

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  materialIcon?: string;
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
  
  export interface InputData {
    ModelSetupData: ModelSetupData,
    RunDynamicsData: RunDynamicsData,
    ScriptData: ScriptData
  }
  
  // types here make sure i'm not passing in wrong data & for autocompletion
  export type atomType = "He" | "Ne" | "Ar" | "Kr" | "Xe" | "User";
  export type boundary = "Fixed Walls" | "Periodic";
  export type potentialModel = "LennardJones" | "NoPotential" | "SoftSphere";
  export interface ModelSetupData {
    atomType: atomType;
    boundary: boundary;
    potentialModel: potentialModel;
    numAtoms: number;
    atomicMass: number;
    potentialParams?: {
      sigma?: number;
      epsilon?: number;
    };
  }
  
  export type simulationType = "ConstPT" | "ConstVT";
  export interface RunDynamicsData {
    simulationType: simulationType;
    initialTemperature: number;
    initialVolume: number;
    timeStep: number;
    stepCount: number;
    interval: number;
  }
  
  export type ScriptData = number;
  
  export type sign = "+" | "-";
  export type rotationAxis = "x" | "y" | "z";
  export type rotateOpx = {
    rotationAxis: rotationAxis;
    sign: sign;
  }
  
  export interface SimulationRun {
    uid: number;
    runNumber: number;
    timestamp: string;
    outputData: OutputData;
    inputData: InputData;
    timeData?: {
      currentTime: number;
      totalTime: number;
      runTime: number;
      totalRuntime: number;
    };
  }
  