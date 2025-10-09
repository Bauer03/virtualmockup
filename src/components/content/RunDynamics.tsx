import React, { useContext, useEffect } from "react";
import { useData } from "../../hooks/useData";
import { simulationType } from "../../types/types";
import { SimulationContext } from "../../context/SimulationContext";

// Molar masses (g/mol) and densities (g/L) at STP
const atomData: Record<string, { mass: number; density: number }> = {
  He: { mass: 4.002602, density: 0.1786 },
  Ne: { mass: 20.1797, density: 0.9002 },
  Ar: { mass: 39.948, density: 1.784 },
  Kr: { mass: 83.798, density: 3.749 },
  Xe: { mass: 131.293, density: 5.894 },
  User: { mass: 39.948, density: 1.784 }, // Default to Argon
};

const RunDynamics: React.FC = () => {
  const { inputData, updateRunDynamics, updateModelSetup } = useData();
  const { isRunning } = useContext(SimulationContext);
  const { RunDynamicsData: dynamicsData, ModelSetupData: modelData } =
    inputData;

  const isDisabled = isRunning;

  // Effect to automatically set volume for ConstPT based on atom type
  // This calculates the expected molar volume at STP for the selected gas
  useEffect(() => {
    if (dynamicsData.simulationType === "ConstPT") {
      const selectedAtom =
        atomData[modelData.atomType as keyof typeof atomData] || atomData.User;
      const molarVolume = selectedAtom.mass / selectedAtom.density;
      updateRunDynamics({ initialVolume: parseFloat(molarVolume.toFixed(2)) });
    }
  }, [modelData.atomType, dynamicsData.simulationType, updateRunDynamics]);

  // Effect to automatically enforce periodic boundaries for NPT ensemble
  // This is critical because NPT simulations require the ability to change box size,
  // which is fundamentally incompatible with fixed walls
  useEffect(() => {
    if (
      dynamicsData.simulationType === "ConstPT" &&
      modelData.boundary !== "Periodic"
    ) {
      console.log(
        "NPT ensemble requires periodic boundaries - automatically switching"
      );
      updateModelSetup({ boundary: "Periodic" });
    }
  }, [dynamicsData.simulationType, modelData.boundary, updateModelSetup]);

  const handleSimulationTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    updateRunDynamics({ simulationType: e.target.value as simulationType });
  };

  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      updateRunDynamics({ initialTemperature: value });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      updateRunDynamics({ initialVolume: value });
    }
  };

  const handlePressureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      updateRunDynamics({ targetPressure: value });
    }
  };

  const handleTimeStepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      updateRunDynamics({ timeStep: value });
    }
  };

  const handleStepCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      updateRunDynamics({ stepCount: value });
    }
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      updateRunDynamics({ interval: value });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6 px-3">
      {/* Left Column */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <label
            htmlFor="SimulationType"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Simulation Type
          </label>
          <select
            id="SimulationType"
            value={dynamicsData.simulationType}
            onChange={handleSimulationTypeChange}
            disabled={isDisabled}
            className="w-32 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="ConstPT">Constant P,T</option>
            <option value="ConstVT">Constant V,T</option>
          </select>
        </div>

        <div className="flex justify-between items-center">
          <label
            htmlFor="Temperature"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Temperature (K)
          </label>
          <input
            id="Temperature"
            type="number"
            value={dynamicsData.initialTemperature}
            onChange={handleTemperatureChange}
            disabled={isDisabled}
            className="w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="300"
          />
        </div>

        {dynamicsData.simulationType === "ConstVT" ? (
          <div className="flex justify-between items-center">
            <label
              htmlFor="Volume"
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Volume (L/mol)
            </label>
            <input
              id="Volume"
              type="number"
              value={dynamicsData.initialVolume}
              onChange={handleVolumeChange}
              disabled={isDisabled}
              className="w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="0.1"
            />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <label
                htmlFor="Volume"
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Initial Volume (L/mol)
              </label>
              <input
                id="Volume"
                type="number"
                value={dynamicsData.initialVolume}
                onChange={handleVolumeChange}
                disabled={true} // Set to read-only for ConstP,T
                className="w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none sm:text-sm opacity-70 cursor-not-allowed"
                placeholder="0.1"
              />
            </div>
            <div className="flex justify-between items-center">
              <label
                htmlFor="Pressure"
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Pressure (atm)
              </label>
              <input
                id="Pressure"
                type="number"
                value={dynamicsData.targetPressure}
                onChange={handlePressureChange}
                disabled={isDisabled}
                className="w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="1.0"
              />
            </div>
          </>
        )}
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <label
            htmlFor="TimeStep"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Time Step (fs)
          </label>
          <input
            id="TimeStep"
            type="number"
            value={dynamicsData.timeStep}
            onChange={handleTimeStepChange}
            disabled={isDisabled}
            className="w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="5.0"
          />
        </div>

        <div className="flex justify-between items-center">
          <label
            htmlFor="NumberOfSteps"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Step Count
          </label>
          <input
            id="NumberOfSteps"
            type="number"
            value={dynamicsData.stepCount}
            onChange={handleStepCountChange}
            disabled={isDisabled}
            className="w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="1000"
          />
        </div>

        <div className="flex justify-between items-center">
          <label
            htmlFor="UpdateInterval"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Update Interval (steps)
          </label>
          <input
            id="UpdateInterval"
            type="number"
            value={dynamicsData.interval}
            onChange={handleIntervalChange}
            disabled={isDisabled}
            className="w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="10"
          />
        </div>
      </div>
    </div>
  );
};

export default RunDynamics;
