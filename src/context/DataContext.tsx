import React, { createContext, useContext, useState, ReactNode } from 'react';
import { InputData, OutputData, ModelSetupData, RunDynamicsData, ScriptData } from '../types/types';

export interface DataContextType {
  inputData: InputData;
  outputData: OutputData;
  updateModelSetup: (updates: Partial<ModelSetupData>) => void;
  updateRunDynamics: (updates: Partial<RunDynamicsData>) => void;
  updateScriptData: (data: ScriptData) => void;
  updateOutputData: (data: OutputData) => void;
}

interface DataProviderProps {
  children: ReactNode;
}

const defaultModelData: ModelSetupData = {
  atomType: "He",
  boundary: "Fixed Walls",
  potentialModel: "NoPotential",
  numAtoms: 1,
  atomicMass: 4.002602,
  potentialParams: {
    sigma: 2.56,
    epsilon: 0.084,
  },
};

const defaultRunDynamicsData: RunDynamicsData = {
  simulationType: "ConstPT",
  initialTemperature: 300,
  initialVolume: 22.4,
  timeStep: 0.001,
  stepCount: 1000,
  interval: 0.1,
};

const defaultScriptData: ScriptData = 1;

const defaultOutputData: OutputData = {
  basic: {
    temperature: { sample: 0, average: 0 },
    pressure: { sample: 0, average: 0 },
    volume: { sample: 0, average: 0 },
  },
  energy: {
    total: { sample: 0, average: 0 },
    kinetic: { sample: 0, average: 0 },
    potential: { sample: 0, average: 0 },
  },
};

const defaultInputData: InputData = {
  ModelSetupData: defaultModelData,
  RunDynamicsData: defaultRunDynamicsData,
  ScriptData: defaultScriptData,
};

export const DataContext = createContext<DataContextType>({
  inputData: defaultInputData,
  outputData: defaultOutputData,
  updateModelSetup: () => {},
  updateRunDynamics: () => {},
  updateScriptData: () => {},
  updateOutputData: () => {},
});

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [inputData, setInputData] = useState<InputData>(defaultInputData);
  const [outputData, setOutputData] = useState<OutputData>(defaultOutputData);

  const updateModelSetup = (updates: Partial<ModelSetupData>) => {
    setInputData((prev) => ({
      ...prev,
      ModelSetupData: {
        ...prev.ModelSetupData,
        ...updates,
      },
    }));
  };

  const updateRunDynamics = (updates: Partial<RunDynamicsData>) => {
    setInputData((prev) => ({
      ...prev,
      RunDynamicsData: {
        ...prev.RunDynamicsData,
        ...updates,
      },
    }));
  };

  const updateScriptData = (data: ScriptData) => {
    setInputData((prev) => ({
      ...prev,
      ScriptData: data,
    }));
  };

  const updateOutputData = (data: OutputData) => {
    setOutputData(data);
  };

  return (
    <DataContext.Provider
      value={{
        inputData,
        outputData,
        updateModelSetup,
        updateRunDynamics,
        updateScriptData,
        updateOutputData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}; 