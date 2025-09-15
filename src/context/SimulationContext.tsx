import React, {
  createContext,
  useEffect,
  useState,
  useRef,
  useContext,
  ReactNode,
} from "react";
import { rotateOpx } from "../types/types";
import { DataContext } from "./DataContext";
import { Scene3D } from "../simulation/Scene3D";
import { useCallback } from "react";

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
  onSimulationComplete?: (() => void) | null;
  setOnSimulationComplete: (callback: (() => void) | null) => void;
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
    totalRuntime: 0,
  },
  buildSubstance: async () => {},
  destroySubstance: () => {},
  toggleBuild: async () => {},
  startRun: () => {},
  stopRun: () => {},
  toggleSimulation: () => {},
  rotateSubstance: () => {},
  zoomCamera: () => {},
  setScriptRunning: () => {},
  onSimulationComplete: null,
  setOnSimulationComplete: () => {},
});

export const SimulationProvider: React.FC<SimulationProviderProps> = ({
  children,
}) => {
  const { inputData, updateOutputData } = useContext(DataContext);
  const [isBuilt, setIsBuilt] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isScriptRunning, setIsScriptRunning] = useState(false);
  const [onSimulationComplete, setOnSimulationComplete] = useState<
    (() => void) | null
  >(null);
  const sceneRef = useRef<Scene3D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [timeData, setTimeData] = useState<TimeData>({
    currentTime: 0,
    totalTime: 0,
    runTime: 0,
    totalRuntime: 0,
  });

  const buildSubstance = useCallback(async (): Promise<void> => {
    if (!canvasRef.current) {
      console.error("Canvas element not found");
      return;
    }

    try {
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }

      sceneRef.current = new Scene3D(
        canvasRef.current,
        inputData,
        updateOutputData
      );

      sceneRef.current.onTimeUpdate = (newTimeData: TimeData) => {
        setTimeData(newTimeData);
      };

      const numAtoms = inputData.ModelSetupData.numAtoms;
      const atomType = inputData.ModelSetupData.atomType;
      const atomicMass = inputData.ModelSetupData.atomicMass;

      for (let i = 0; i < numAtoms; i++) {
        sceneRef.current.addAtom(atomType, atomicMass);
      }

      setIsBuilt(true);

      const totalTime =
        inputData.RunDynamicsData.timeStep *
        inputData.RunDynamicsData.stepCount;
      setTimeData((prev) => ({
        ...prev,
        currentTime: 0,
        totalTime,
        runTime: 0,
        totalRuntime: 0,
      }));
    } catch (error) {
      console.error("Error building substance:", error);
      throw error;
    }
  }, [inputData, updateOutputData]);

  const destroySubstance = useCallback((): void => {
    if (sceneRef.current) {
      sceneRef.current.rotate = false;
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
    setIsBuilt(false);
    setIsRunning(false);

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

    setTimeData({
      currentTime: 0,
      totalTime:
        inputData.RunDynamicsData.timeStep *
        inputData.RunDynamicsData.stepCount,
      runTime: 0,
      totalRuntime: 0,
    });
  }, [
    inputData.RunDynamicsData.stepCount,
    inputData.RunDynamicsData.timeStep,
    updateOutputData,
  ]);

  useEffect(() => {
    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isBuilt && !isRunning) {
      if (
        sceneRef.current &&
        (inputData.RunDynamicsData.initialVolume !==
          sceneRef.current.getContainerVolume() ||
          inputData.ModelSetupData.numAtoms !==
            sceneRef.current.getAtomCount())
      ) {
        destroySubstance();
        buildSubstance();
      }
    }
  }, [
    inputData.RunDynamicsData.initialVolume,
    inputData.ModelSetupData.numAtoms,
    isBuilt,
    isRunning,
    destroySubstance,
    buildSubstance,
  ]);

  const toggleBuild = useCallback(async (): Promise<void> => {
    if (isBuilt) {
      destroySubstance();
    } else {
      await buildSubstance();
    }
  }, [isBuilt, destroySubstance, buildSubstance]);

  const startRun = useCallback((): void => {
    if (sceneRef.current && isBuilt && !isRunning) {
      sceneRef.current.updateInputData(inputData);
      sceneRef.current.startRun();
      setIsRunning(true);
    }
  }, [isBuilt, isRunning, inputData]);

  const stopRun = useCallback((): void => {
    if (sceneRef.current && isRunning) {
      const output = sceneRef.current.stopRun();
      if (output) {
        updateOutputData(output);
      }
      setIsRunning(false);

      if (onSimulationComplete) {
        onSimulationComplete();
      }
    }
  }, [isRunning, onSimulationComplete, updateOutputData]);

  const toggleSimulation = useCallback((): void => {
    if (isRunning) {
      stopRun();
    } else if (isBuilt) {
      startRun();
    }
  }, [isRunning, isBuilt, stopRun, startRun]);

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
        setScriptRunning,
        onSimulationComplete,
        setOnSimulationComplete,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};
