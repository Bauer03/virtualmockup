import React, { useContext } from 'react';
import { useData } from '../../hooks/useData';
import { simulationType } from '../../types/types';
import { SimulationContext } from '../../context/SimulationContext';

const RunDynamics: React.FC = () => {
  const { inputData, updateRunDynamics } = useData();
  const { isBuilt, isRunning } = useContext(SimulationContext);
  const dynamicsData = inputData.RunDynamicsData;
  
  // Only disable inputs when simulation is actively running
  const isDisabled = isRunning;

  const handleSimulationTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
          <label htmlFor="SimulationType" className="text-sm font-medium text-gray-700 dark:text-gray-200">
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
          <label htmlFor="Temperature" className="text-sm font-medium text-gray-700 dark:text-gray-200">
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

        <div className="flex justify-between items-center">
          <label htmlFor="Volume" className="text-sm font-medium text-gray-700 dark:text-gray-200">
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
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <label htmlFor="TimeStep" className="text-sm font-medium text-gray-700 dark:text-gray-200">
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
          <label htmlFor="NumberOfSteps" className="text-sm font-medium text-gray-700 dark:text-gray-200">
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
          <label htmlFor="UpdateInterval" className="text-sm font-medium text-gray-700 dark:text-gray-200">
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