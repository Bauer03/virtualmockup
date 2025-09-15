import React, {
  createContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import {
  InputData,
  ModelSetupData,
  RunDynamicsData,
  OutputData,
  ScriptData,
  SimulationRun,
} from "../types/types";
import { DatabaseService } from "../services/DatabaseService";

// Default values
const defaultModelData: ModelSetupData = {
  atomType: "He",
  boundary: "Fixed Walls",
  potentialModel: "NoPotential",
  numAtoms: 1,
  atomicMass: 4.002602,
  potentialParams: {
    sigma: 2.56, // Updated default for Helium
    epsilon: 0.084, // Updated default for Helium
  },
};

const defaultRunDynamicsData: RunDynamicsData = {
  simulationType: "ConstPT",
  initialTemperature: 300,
  initialVolume: 22.4,
  targetPressure: 1.0,
  timeStep: 5.0,
  stepCount: 1000,
  interval: 10,
};

const defaultScriptData: ScriptData = 1;

export const defaultOutputData: OutputData = {
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

interface DataContextType {
  inputData: InputData;
  outputData: OutputData;
  savedRuns: SimulationRun[];
  updateModelSetup: (updates: Partial<ModelSetupData>) => void;
  updateRunDynamics: (updates: Partial<RunDynamicsData>) => void;
  updateScriptData: (data: ScriptData) => void;
  updateOutputData: (data: OutputData) => void;
  saveCurrentRun: () => Promise<void>;
  deleteRun: (uid: number) => Promise<void>;
  clearAllRuns: () => Promise<void>;
  exportToCSV: () => void;
  getCurrentSimulationRun: () => SimulationRun;
}

export const DataContext = createContext<DataContextType>({
  inputData: defaultInputData,
  outputData: defaultOutputData,
  savedRuns: [],
  updateModelSetup: () => {},
  updateRunDynamics: () => {},
  updateScriptData: () => {},
  updateOutputData: () => {},
  saveCurrentRun: async () => {},
  deleteRun: async () => {},
  clearAllRuns: async () => {},
  exportToCSV: () => {},
  getCurrentSimulationRun: () => ({
    uid: 0,
    runNumber: 0,
    timestamp: "",
    inputData: defaultInputData,
    outputData: defaultOutputData,
  }),
});

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [dbService] = useState(() => new DatabaseService());
  const [inputData, setInputData] = useState<InputData>(defaultInputData);
  const [outputData, setOutputData] = useState<OutputData>(defaultOutputData);
  const [savedRuns, setSavedRuns] = useState<SimulationRun[]>([]);
  const [counter, setCounter] = useState(0);

  const loadSavedRuns = useCallback(async () => {
    try {
      const runs = await dbService.getAllOutputs();
      setSavedRuns(runs);
    } catch (error) {
      console.error("Failed to load saved runs:", error);
    }
  }, [dbService]);

  // Initialize database connection
  useEffect(() => {
    const initDb = async () => {
      await dbService.init();
      loadSavedRuns();
    };

    initDb();
  }, [dbService, loadSavedRuns]);

  const updateModelSetup = useCallback((updates: Partial<ModelSetupData>) => {
    setInputData((prev) => ({
      ...prev,
      ModelSetupData: {
        ...prev.ModelSetupData,
        ...updates,
      },
    }));
  }, []);

  const updateRunDynamics = useCallback((updates: Partial<RunDynamicsData>) => {
    setInputData((prev) => ({
      ...prev,
      RunDynamicsData: {
        ...prev.RunDynamicsData,
        ...updates,
      },
    }));
  }, []);

  const updateScriptData = useCallback((data: ScriptData) => {
    setInputData((prev) => ({
      ...prev,
      ScriptData: data,
    }));
  }, []);

  const updateOutputData = (data: OutputData) => {
    setOutputData(data);
  };

  // Generate unique ID with timestamp and counter
  const generateUID = (): number => {
    const timestamp = Date.now();
    setCounter((prev) => (prev + 1) % 1000);
    return Number(`${timestamp}${counter.toString().padStart(3, "0")}`);
  };

  const getCurrentSimulationRun = (): SimulationRun => {
    // Get current time data from DOM elements or set defaults
    const currentTimeEl = document.getElementById("current-time");
    const totalTimeEl = document.getElementById("total-time");
    const runTimeEl = document.getElementById("run-time");
    const totalRuntimeEl = document.getElementById("total-runtime");

    const timeData = {
      currentTime: currentTimeEl
        ? parseFloat(currentTimeEl.textContent || "0")
        : 0,
      totalTime: totalTimeEl ? parseFloat(totalTimeEl.textContent || "0") : 0,
      runTime: runTimeEl
        ? parseFloat((runTimeEl.textContent || "0").replace("s", ""))
        : 0,
      totalRuntime: totalRuntimeEl
        ? parseFloat((totalRuntimeEl.textContent || "0").replace("s", ""))
        : 0,
    };

    return {
      uid: generateUID(),
      runNumber: savedRuns.length + 1,
      timestamp: new Date().toISOString(),
      inputData: inputData,
      outputData: outputData,
      timeData: timeData,
    };
  };

  const saveCurrentRun = async () => {
    try {
      const run = getCurrentSimulationRun();
      await dbService.addOutput(run);
      await loadSavedRuns();
    } catch (error) {
      console.error("Failed to save run:", error);
      throw error;
    }
  };

  const deleteRun = async (uid: number) => {
    try {
      await dbService.deleteOutput(uid);
      await loadSavedRuns();
    } catch (error) {
      console.error("Failed to delete run:", error);
      throw error;
    }
  };

  const clearAllRuns = async () => {
    try {
      await dbService.clearAllOutputs();
      setSavedRuns([]);
    } catch (error) {
      console.error("Failed to clear runs:", error);
      throw error;
    }
  };

  const exportToCSV = () => {
    if (savedRuns.length === 0) {
      alert(
        "There's nothing to download right now! Try copying your simulation results to the notebook first."
      );
      return;
    }

    const headers = [
      "UID",
      "Run Number",
      "Timestamp",
      "Atom Type",
      "Number of Atoms",
      "Boundary Type",
      "Simulation Type",
      "Initial Temperature (K)",
      "Initial Volume (L/mol)",
      "Time Step (fs)",
      "Number of Steps",
      "Update Interval (ps)",
      "Sample Temperature (K)",
      "Avg Temperature (K) over run",
      "Sample Pressure (atm)",
      "Avg Pressure (atm) over run",
      "Sample Volume (L/mol)",
      "Avg Volume (L/mol) over run",
      "Sample Total Energy (J/mol)",
      "Avg Total Energy (J/mol) over run",
      "Sample Kinetic Energy (J/mol)",
      "Avg Kinetic Energy (J/mol) over run",
      "Sample Potential Energy (J/mol)",
      "Avg Potential Energy (J/mol) over run",
      "Simulation Time (ps)",
      "Total Simulation Time (ps)",
      "Run Time (s)",
      "Total Runtime (s)",
    ].join(",");

    const rows = savedRuns.map((run) => {
      return [
        run.uid,
        run.runNumber,
        run.timestamp,
        run.inputData.ModelSetupData.atomType,
        run.inputData.ModelSetupData.numAtoms,
        run.inputData.ModelSetupData.boundary,
        run.inputData.RunDynamicsData.simulationType,
        run.inputData.RunDynamicsData.initialTemperature,
        run.inputData.RunDynamicsData.initialVolume,
        run.inputData.RunDynamicsData.timeStep,
        run.inputData.RunDynamicsData.stepCount,
        run.inputData.RunDynamicsData.interval,
        run.outputData.basic.temperature.sample,
        run.outputData.basic.temperature.average,
        run.outputData.basic.pressure.sample,
        run.outputData.basic.pressure.average,
        run.outputData.basic.volume.sample,
        run.outputData.basic.volume.average,
        run.outputData.energy.total.sample,
        run.outputData.energy.total.average,
        run.outputData.energy.kinetic.sample,
        run.outputData.energy.kinetic.average,
        run.outputData.energy.potential.sample,
        run.outputData.energy.potential.average,
        // Include time data if available
        run.timeData?.currentTime || 0,
        run.timeData?.totalTime ||
          run.inputData.RunDynamicsData.timeStep *
            run.inputData.RunDynamicsData.stepCount,
        run.timeData?.runTime || 0,
        run.timeData?.totalRuntime || 0,
      ].join(",");
    });

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "simulationResults.csv";
    link.click();
  };

  return (
    <DataContext.Provider
      value={{
        inputData,
        outputData,
        savedRuns,
        updateModelSetup,
        updateRunDynamics,
        updateScriptData,
        updateOutputData,
        saveCurrentRun,
        deleteRun,
        clearAllRuns,
        exportToCSV,
        getCurrentSimulationRun,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
