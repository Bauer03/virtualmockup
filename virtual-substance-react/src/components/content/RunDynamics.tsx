import React from 'react';
import { useData } from '../../hooks/useData';
import { simulationType } from '../../types/types';

const RunDynamics: React.FC = () => {
  const { inputData, updateRunDynamics } = useData();
  const dynamicsData = inputData.RunDynamicsData;

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
    <div className="flex px-3 justify-between">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="SimulationType" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Simulation Type
          </label>
          <select 
            id="SimulationType"
            value={dynamicsData.simulationType}
            onChange={handleSimulationTypeChange}
          >
            <option value="ConstVT">Const-VT</option>
            <option value="ConstPT">Const-PT</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <label htmlFor="Temperature" className="flex justify-between items-center">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Temperature (K)</span>
            </label>
            <input 
              id="Temperature" 
              type="number" 
              value={dynamicsData.initialTemperature}
              onChange={handleTemperatureChange}
              className="block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
              placeholder="300"
            />
          </div>
          <div className="flex gap-2 justify-between">
            <label htmlFor="Volume" className="flex justify-between items-center">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Volume (L/mol)</span>
            </label>
            <input 
              id="Volume" 
              type="number" 
              value={dynamicsData.initialVolume}
              onChange={handleVolumeChange}
              className="w-20 block py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
              placeholder="0.1"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2 justify-between">
          <label htmlFor="TimeStep" className="flex justify-between items-center">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Time Step (ps)</span>
          </label>
          <input 
            id="TimeStep" 
            type="number" 
            value={dynamicsData.timeStep}
            onChange={handleTimeStepChange}
            className="block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
            placeholder="0.1"
          />
        </div>
        <div className="flex gap-2 justify-between">
          <label htmlFor="NumberOfSteps" className="flex justify-between items-center">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Step Count</span>
          </label>
          <input 
            id="NumberOfSteps" 
            type="number" 
            value={dynamicsData.stepCount}
            onChange={handleStepCountChange}
            className="block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
            placeholder="1000"
          />
        </div>
        <div className="flex gap-2 justify-between">
          <label htmlFor="UpdateInterval" className="flex justify-between items-center">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Interval (ps)</span>
          </label>
          <input 
            id="UpdateInterval" 
            type="number" 
            value={dynamicsData.interval}
            onChange={handleIntervalChange}
            className="block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
            placeholder="0.1"
          />
        </div>
      </div>
    </div>
  );
};

export default RunDynamics;