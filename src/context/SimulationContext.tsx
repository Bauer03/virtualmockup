import React, { createContext, useEffect, useState, useRef, useContext, ReactNode } from 'react';
import { InputData, OutputData, rotateOpx } from '../types/types';
import { DataContext, DataContextType } from './DataContext';
import { Scene3D } from '../simulation/Scene3D';

interface TimeData {
  currentTime: number;
  totalTime: number;
  runTime: number;
  totalRuntime: number;
}

interface SimulationContextType {
  isBuilt: boolean;
  isRunning: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  timeData: TimeData;
  buildSubstance: () => Promise<void>;
  destroySubstance: () => void;
  toggleBuild: () => Promise<void>;
  startRun: () => void;
  stopRun: () => void;
  rotateSubstance: (params: rotateOpx) => void;
  zoomCamera: (zoomIn: boolean) => void;
}

interface SimulationProviderProps {
  children: ReactNode;
}

export const SimulationContext = createContext<SimulationContextType>({
  isBuilt: false,
  isRunning: false,
  canvasRef: { current: null },
  timeData: {
    currentTime: 0,
    totalTime: 0,
    runTime: 0,
    totalRuntime: 0
  },
  buildSubstance: async () => {},
  destroySubstance: () => {},
  toggleBuild: async () => {},
  startRun: () => {},
  stopRun: () => {},
  rotateSubstance: () => {},
  zoomCamera: () => {}
});

export const SimulationProvider: React.FC<SimulationProviderProps> = ({ children }) => {
  const { inputData, updateOutputData } = useContext<DataContextType>(DataContext);
  const [isBuilt, setIsBuilt] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const sceneRef = useRef<Scene3D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Store time values to persist across tab switches
  const [timeData, setTimeData] = useState<TimeData>({
    currentTime: 0,
    totalTime: 0,
    runTime: 0,
    totalRuntime: 0
  });

  useEffect(() => {
    return () => {
      // Clean up on unmount
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  // Recreate scene if input parameters that affect visualization change
  useEffect(() => {
    if (isBuilt && !isRunning) {
      // Only rebuild if we're not currently running a simulation
      // and if the container or atoms need to be updated
      if (
        sceneRef.current &&
        (inputData.RunDynamicsData.initialVolume !== sceneRef.current.getContainerVolume() ||
         inputData.ModelSetupData.numAtoms !== sceneRef.current.getAtomCount())
      ) {
        destroySubstance();
        buildSubstance();
      }
    }
  }, [inputData.RunDynamicsData.initialVolume, inputData.ModelSetupData.numAtoms]);

  const buildSubstance = async (): Promise<void> => {
    if (!canvasRef.current) {
      console.error('Canvas element not found');
      return;
    }

    try {
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
      
      // Create new Scene3D with a callback to update time data
      sceneRef.current = new Scene3D(
        canvasRef.current, 
        inputData, 
        updateOutputData
      );

      // Set up time data update callback
      sceneRef.current.onTimeUpdate = (newTimeData: TimeData) => {
        setTimeData(newTimeData);
      };
      
      const numAtoms = inputData.ModelSetupData.numAtoms;
      const atomType = inputData.ModelSetupData.atomType;
      const atomicMass = inputData.ModelSetupData.atomicMass;
      
      console.log(`Adding ${numAtoms} atoms of type ${atomType}`);
      for (let i = 0; i < numAtoms; i++) {
        sceneRef.current.addAtom(atomType, atomicMass);
      }
      
      setIsBuilt(true);
      
      // Initialize time data with proper total time
      const totalTime = inputData.RunDynamicsData.timeStep * inputData.RunDynamicsData.stepCount;
      setTimeData(prev => ({
        ...prev,
        currentTime: 0,
        totalTime,
        runTime: 0,
        totalRuntime: 0
      }));
    } catch (error) {
      console.error('Error building substance:', error);
      throw error;
    }
  };

  const destroySubstance = (): void => {
    if (sceneRef.current) {
      sceneRef.current.rotate = false;
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
    setIsBuilt(false);
    setIsRunning(false);
  };

  const toggleBuild = async (): Promise<void> => {
    if (isBuilt) {
      destroySubstance();
    } else {
      await buildSubstance();
    }
  };

  const startRun = (): void => {
    if (sceneRef.current && isBuilt && !isRunning) {
      sceneRef.current.startRun();
      setIsRunning(true);
    }
  };

  const stopRun = (): void => {
    if (sceneRef.current && isRunning) {
      const output = sceneRef.current.stopRun();
      if (output) {
        updateOutputData(output);
      }
      setIsRunning(false);
    }
  };

  const rotateSubstance = (params: rotateOpx): void => {
    if (sceneRef.current) {
      sceneRef.current.rotateSubstance(params);
    }
  };

  const zoomCamera = (zoomIn: boolean): void => {
    if (sceneRef.current) {
      sceneRef.current.zoomCamera(zoomIn);
    }
  };

  return (
    <SimulationContext.Provider
      value={{
        isBuilt,
        isRunning,
        canvasRef,
        timeData,
        buildSubstance,
        destroySubstance,
        toggleBuild,
        startRun,
        stopRun,
        rotateSubstance,
        zoomCamera
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}; 