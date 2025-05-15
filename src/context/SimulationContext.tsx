import React, { createContext, useEffect, useState, useRef, useContext, ReactNode } from 'react';
import { InputData, OutputData, rotateOpx } from '../types/types';
import { DataContext } from './DataContext';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Store time values to persist across tab switches
  const [timeData, setTimeData] = useState<TimeData>({
    currentTime: 0,
    totalTime: 0,
    runTime: 0,
    totalRuntime: 0
  });

  // Timer reference for simulation
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mockUpdateFrequency = 100; // ms

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clean up timers when component unmounts
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, []);

  // Listen for tab changes to persist time data
  useEffect(() => {
    // This is just a simplified version that does nothing but preserves the UI structure
    const handleTabChange = () => {
      console.log('Tab changed');
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
  
  const buildSubstance = async (): Promise<void> => {
    if (!canvasRef.current) {
      console.error('Canvas element not found');
      return;
    }
  
    try {
      console.log('Building substance with input:', inputData);
      
      // Simple delay to simulate building process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
    console.log('Destroying substance');
    
    // Clear any running timers
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    
    setIsBuilt(false);
    setIsRunning(false);
    
    // Reset output displays to zero
    updateOutputDisplay();
    
    // Reset output data to default values
    updateOutputData({
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
    });
  };

  const toggleBuild = async (): Promise<void> => {
    if (isBuilt) {
      destroySubstance();
    } else {
      await buildSubstance();
    } 
  };

  const startRun = (): void => {
    if (isBuilt && !isRunning) {
      console.log('Starting run with input:', inputData);
      setIsRunning(true);
      
      // Set up mock simulation timer to update time and output data
      simulationTimerRef.current = setInterval(() => {
        setTimeData(prev => {
          // Calculate new time values
          const timeStep = inputData.RunDynamicsData.timeStep;
          const newCurrentTime = Math.min(prev.currentTime + timeStep, prev.totalTime);
          const newRunTime = prev.runTime + mockUpdateFrequency / 1000;
          const newTotalRuntime = prev.totalRuntime + mockUpdateFrequency / 1000;
          
          // Generate random output data for UI
          const mockOutput: OutputData = {
            basic: {
              temperature: { 
                sample: Math.random() * 100, 
                average: Math.random() * 100 
              },
              pressure: { 
                sample: Math.random() * 10, 
                average: Math.random() * 10 
              },
              volume: { 
                sample: inputData.RunDynamicsData.initialVolume, 
                average: inputData.RunDynamicsData.initialVolume 
              },
            },
            energy: {
              total: { 
                sample: Math.random() * 1000, 
                average: Math.random() * 1000 
              },
              kinetic: { 
                sample: Math.random() * 500, 
                average: Math.random() * 500 
              },
              potential: { 
                sample: Math.random() * 500, 
                average: Math.random() * 500 
              },
            },
          };
          
          // Update output data in UI
          updateOutputData(mockOutput);
          
          // Check if simulation is complete
          if (newCurrentTime >= prev.totalTime) {
            if (simulationTimerRef.current) {
              clearInterval(simulationTimerRef.current);
              simulationTimerRef.current = null;
            }
            setIsRunning(false);
          }
          
          // Return updated time data
          return {
            currentTime: newCurrentTime,
            totalTime: prev.totalTime,
            runTime: newRunTime,
            totalRuntime: newTotalRuntime
          };
        });
      }, mockUpdateFrequency);
    }
  };

  const stopRun = (): void => {
    if (isRunning) {
      console.log('Stopping run');
      
      // Clear the timer
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      
      setIsRunning(false);
      
      // Generate final mock output data
      const mockFinalOutput: OutputData = {
        basic: {
          temperature: { sample: Math.random() * 100, average: Math.random() * 100 },
          pressure: { sample: Math.random() * 10, average: Math.random() * 10 },
          volume: { sample: inputData.RunDynamicsData.initialVolume, average: inputData.RunDynamicsData.initialVolume },
        },
        energy: {
          total: { sample: Math.random() * 1000, average: Math.random() * 1000 },
          kinetic: { sample: Math.random() * 500, average: Math.random() * 500 },
          potential: { sample: Math.random() * 500, average: Math.random() * 500 },
        },
      };
      
      updateOutputData(mockFinalOutput);
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
    console.log('Rotate substance called with:', params);
    // This is a mock function that doesn't do anything
  };

  const zoomCamera = (zoomIn: boolean): void => {
    console.log('Zoom camera called with zoomIn:', zoomIn);
    // This is a mock function that doesn't do anything
  };

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