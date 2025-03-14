import React, { createContext, useEffect, useState, useRef, useContext, ReactNode } from 'react';
import { InputData, OutputData, rotateOpx } from '../types/types';
import { DataContext } from './DataContext';
import { Scene3D } from '../simulation/Scene3D';
import { useData } from '../hooks/useData';

interface TimeData {
  currentTime: number;
  totalTime: number;
  runTime: number;
  totalRuntime: number;
}

interface SimulationContextType {
  isBuilt: boolean;
  isRunning: boolean;
  isScriptRunning: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  timeData: TimeData;
  buildSubstance: () => Promise<void>;
  destroySubstance: () => void;
  toggleBuild: () => Promise<void>;
  startRun: () => void;
  stopRun: () => void;
  toggleSimulation: () => void;
  rotateSubstance: (params: rotateOpx) => void;
  zoomCamera: (zoomIn: boolean) => void;
  setScriptRunning: (isRunning: boolean) => void;
}

interface SimulationProviderProps {
  children: ReactNode;
}

export const SimulationContext = createContext<SimulationContextType>({
  isBuilt: false,
  isRunning: false,
  isScriptRunning: false,
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
  toggleSimulation: () => {},
  rotateSubstance: () => {},
  zoomCamera: () => {},
  setScriptRunning: () => {}
});

export const SimulationProvider: React.FC<SimulationProviderProps> = ({ children }) => {
  const { inputData, updateOutputData } = useContext(DataContext);
  const [isBuilt, setIsBuilt] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isScriptRunning, setIsScriptRunning] = useState(false);
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
  
  // Listen for tab changes to persist time data
  useEffect(() => {
    // Event handler for tab changes
    const handleTabChange = () => {
      // If we're running, update the time data from DOM
      if (isRunning && sceneRef.current) {
        captureTimeDataFromDOM();
      }
    };
    
    // Add event listeners for the tab buttons
    const basicTab = document.getElementById('basic-tab');
    const energyTab = document.getElementById('energy-tab');
    const timeTab = document.getElementById('time-tab');
    
    if (basicTab) basicTab.addEventListener('click', handleTabChange);
    if (energyTab) energyTab.addEventListener('click', handleTabChange);
    if (timeTab) timeTab.addEventListener('click', handleTabChange);
    
    return () => {
      // Clean up event listeners
      if (basicTab) basicTab.removeEventListener('click', handleTabChange);
      if (energyTab) energyTab.removeEventListener('click', handleTabChange);
      if (timeTab) timeTab.removeEventListener('click', handleTabChange);
    };
  }, [isRunning]);
  
  // Function to capture time data from DOM
  const captureTimeDataFromDOM = () => {
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const runTimeEl = document.getElementById('run-time');
    const totalRuntimeEl = document.getElementById('total-runtime');
    
    const newTimeData = {
      currentTime: currentTimeEl ? parseFloat(currentTimeEl.textContent || '0') : 0,
      totalTime: totalTimeEl ? parseFloat(totalTimeEl.textContent || '0') : 0,
      runTime: runTimeEl ? parseFloat((runTimeEl.textContent || '0').replace('s', '')) : 0,
      totalRuntime: totalRuntimeEl ? parseFloat((totalRuntimeEl.textContent || '0').replace('s', '')) : 0
    };
    
    setTimeData(newTimeData);
  };
  
  // Function to restore time data to DOM
  const restoreTimeDataToDOM = () => {
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const runTimeEl = document.getElementById('run-time');
    const totalRuntimeEl = document.getElementById('total-runtime');
    
    if (currentTimeEl) currentTimeEl.textContent = timeData.currentTime.toFixed(4);
    if (totalTimeEl) totalTimeEl.textContent = timeData.totalTime.toFixed(4);
    if (runTimeEl) runTimeEl.textContent = timeData.runTime.toFixed(1) + 's';
    if (totalRuntimeEl) totalRuntimeEl.textContent = timeData.totalRuntime.toFixed(1) + 's';
  };

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

  const updateOutputDisplay = () => {
    // Reset all output displays to zero
    const elementsToReset = [
      'temperature-sample', 'temperature-average',
      'pressure-sample', 'pressure-average',
      'volume-sample', 'volume-average',
      'total-energy-sample', 'total-energy-average',
      'kinetic-energy-sample', 'kinetic-energy-average',
      'potential-energy-sample', 'potential-energy-average',
      'current-time', 'run-time', 'total-runtime'
    ];
    
    elementsToReset.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = '0.00';
      }
    });
    
    // Also reset the time data state
    setTimeData({
      currentTime: 0,
      totalTime: inputData.RunDynamicsData.timeStep * inputData.RunDynamicsData.stepCount,
      runTime: 0,
      totalRuntime: 0
    });
  };

  const destroySubstance = (): void => {
    if (sceneRef.current) {
      sceneRef.current.rotate = false;
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
    setIsBuilt(false);
    setIsRunning(false);
    
    // We'll only reset output displays when explicitly building a new substance
    // This way, outputs remain visible until the user clicks "Build" again
    // updateOutputDisplay();
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

  const toggleSimulation = (): void => {
    if (isRunning) {
      stopRun();
    } else {
      startRun();
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

  // Function to set script running state
  const setScriptRunning = (isRunning: boolean) => {
    setIsScriptRunning(isRunning);
  };

  return (
    <SimulationContext.Provider
      value={{
        isBuilt,
        isRunning,
        isScriptRunning,
        canvasRef,
        timeData,
        buildSubstance,
        destroySubstance,
        toggleBuild,
        startRun,
        stopRun,
        toggleSimulation,
        rotateSubstance,
        zoomCamera,
        setScriptRunning
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};