import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { useSimulation } from '../../hooks/useSimulation';

type TabType = 'basic' | 'energy' | 'time';

const Output: React.FC = () => {
  const { outputData, saveCurrentRun } = useData();
  const { isRunning, isScriptRunning, timeData } = useSimulation();
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [previousTab, setPreviousTab] = useState<TabType>('basic');

  // Determine if the Copy to Notebook button should be disabled
  const isCopyDisabled = isRunning || isScriptRunning || (
    outputData.basic.temperature.sample === 0 &&
    outputData.basic.temperature.average === 0 &&
    outputData.basic.pressure.sample === 0 &&
    outputData.basic.pressure.average === 0 &&
    outputData.basic.volume.sample === 0 &&
    outputData.basic.volume.average === 0 &&
    outputData.energy.total.sample === 0 &&
    outputData.energy.total.average === 0 &&
    outputData.energy.kinetic.sample === 0 &&
    outputData.energy.kinetic.average === 0 &&
    outputData.energy.potential.sample === 0 &&
    outputData.energy.potential.average === 0
  );

  const handleCopyToNotebook = async () => {
    if (isCopyDisabled) return;
    
    try {
      await saveCurrentRun();
      document.dispatchEvent(new Event('output-copied'));
    } catch (error) {
      console.error('Error saving run:', error);
    }
  };

  // Effect to handle tab switching and data persistence
  useEffect(() => {
    if (activeTab !== previousTab) {
      setPreviousTab(activeTab);
    }
  }, [activeTab, previousTab]);

  return (
    <div className="grid px-3 gap-2 min-h-[165px] content-start">
      <div className="flex justify-between items-center border-b dark:border-gray-600">
        <div className="flex gap-2">
          <button
            id="basic-tab"
            className={`px-3 py-1 font-light hover:bg-gray-100 dark:hover:bg-gray-700 
                       transition-colors duration-200 border-b-2 ${
                         activeTab === 'basic' ? 'border-blue-400' : 'border-transparent'
                       }`}
            onClick={() => setActiveTab('basic')}
          >
            Basic
          </button>
          <button
            id="energy-tab"
            className={`px-3 py-1 font-light hover:bg-gray-100 dark:hover:bg-gray-700 
                       transition-colors duration-200 border-b-2 ${
                         activeTab === 'energy' ? 'border-blue-400' : 'border-transparent'
                       }`}
            onClick={() => setActiveTab('energy')}
          >
            Energy
          </button>
          <button
            id="time-tab"
            className={`px-3 py-1 font-light hover:bg-gray-100 dark:hover:bg-gray-700 
                       transition-colors duration-200 border-b-2 ${
                         activeTab === 'time' ? 'border-blue-400' : 'border-transparent'
                       }`}
            onClick={() => setActiveTab('time')}
          >
            Time
          </button>
        </div>
        <button
          onClick={handleCopyToNotebook}
          disabled={isCopyDisabled}
          className={`mb-1 px-3 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 
                    transition-colors duration-200 border border-white dark:border-gray-600 rounded
                    ${isCopyDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isRunning ? "Wait for simulation to complete" : isScriptRunning ? "Wait for script to complete" : "Copy current results to notebook"}
        >
          Copy to Notebook
        </button>
      </div>

      <div className="py-4">
        {/* Basic Tab Content */}
        {activeTab === 'basic' && (
          <div id="basic-content">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-600">
                  <th className="text-left py-1">Property</th>
                  <th className="text-right px-2 w-16">Sample</th>
                  <th className="text-right px-2 w-16">Average</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Temperature (K)</td>
                  <td className="text-right w-16">
                    {outputData.basic.temperature.sample.toFixed(2)}
                  </td>
                  <td className="text-right w-16">
                    {outputData.basic.temperature.average.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Pressure (atm)</td>
                  <td className="text-right w-16">
                    {outputData.basic.pressure.sample.toFixed(2)}
                  </td>
                  <td className="text-right w-16">
                    {outputData.basic.pressure.average.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Volume (L/mol)</td>
                  <td className="text-right w-16">
                    {outputData.basic.volume.sample.toFixed(2)}
                  </td>
                  <td className="text-right w-16">
                    {outputData.basic.volume.average.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Energy Tab Content */}
        {activeTab === 'energy' && (
          <div id="energy-content">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-600">
                  <th className="text-left py-1">Property</th>
                  <th className="text-right px-2 w-16">Sample</th>
                  <th className="text-right px-2 w-16">Average</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Total Energy (J/mol)</td>
                  <td className="text-right w-16">
                    {outputData.energy.total.sample.toFixed(2)}
                  </td>
                  <td className="text-right w-16">
                    {outputData.energy.total.average.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Kinetic Energy (J/mol)</td>
                  <td className="text-right w-16">
                    {outputData.energy.kinetic.sample.toFixed(2)}
                  </td>
                  <td className="text-right w-16">
                    {outputData.energy.kinetic.average.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Potential Energy (J/mol)</td>
                  <td className="text-right w-16">
                    {outputData.energy.potential.sample.toFixed(2)}
                  </td>
                  <td className="text-right w-16">
                    {outputData.energy.potential.average.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Time Tab Content */}
        {activeTab === 'time' && (
          <div id="time-content">
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="grid gap-2">
                <div className="flex gap-4 justify-between">
                  <span>Time (fs)</span>
                  <span className="w-16 text-right">
                    {timeData.currentTime.toFixed(4)}
                  </span>
                </div>
                <div className="flex gap-4 justify-between">
                  <span>Total Time (fs)</span>
                  <span className="w-16 text-right">
                    {timeData.totalTime.toFixed(4)}
                  </span>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex gap-4 justify-between">
                  <span>Run Time</span>
                  <span className="w-16 text-right">
                    {timeData.runTime.toFixed(1)}s
                  </span>
                </div>
                <div className="flex gap-4 justify-between">
                  <span>Total Time</span>
                  <span className="w-16 text-right">
                    {timeData.totalRuntime.toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Output;