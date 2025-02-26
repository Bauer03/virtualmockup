import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { useSimulation } from '../../hooks/useSimulation';

type TabType = 'basic' | 'energy' | 'time';

const Output: React.FC = () => {
  const { outputData, saveCurrentRun } = useData();
  const { isRunning } = useSimulation();
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [previousTab, setPreviousTab] = useState<TabType>('basic');

  const handleCopyToNotebook = async () => {
    try {
      await saveCurrentRun();
      // Trigger a custom event that could be used elsewhere (like refreshing the notebook)
      document.dispatchEvent(new Event('output-copied'));
    } catch (error) {
      console.error('Error saving run:', error);
    }
  };
  
  // Effect to handle tab switching and data persistence
  useEffect(() => {
    if (activeTab !== previousTab) {
      setPreviousTab(activeTab);
      
      // If switching to time tab, ensure data is current
      if (activeTab === 'time' && isRunning) {
        // We don't need to do anything here, as the simulation updates the time tab continuously
      }
    }
  }, [activeTab, previousTab, isRunning]);

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
          id="copy-notebook"
          className="text-xs shadow-sm rounded font-light
                  hover:bg-white dark:hover:bg-gray-800
                  bg-gray-100 dark:bg-gray-700
                  text-gray-800 dark:text-gray-200
                  border border-white dark:border-gray-600
                  transition-colors duration-200 items-center
                  flex gap-1 px-3 py-2 mb-1"
          onClick={handleCopyToNotebook}
        >
          <span>Copy to Notebook</span>
          <span className="material-icons text-xs">content_copy</span>
        </button>
      </div>

      <div className="overflow-hidden">
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
                  <td id="temperature-sample" className="text-right w-16">
                    {outputData.basic.temperature.sample.toFixed(2)}
                  </td>
                  <td id="temperature-average" className="text-right w-16">
                    {outputData.basic.temperature.average.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Pressure (atm)</td>
                  <td id="pressure-sample" className="text-right w-16">
                    {outputData.basic.pressure.sample.toFixed(2)}
                  </td>
                  <td id="pressure-average" className="text-right w-16">
                    {outputData.basic.pressure.average.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Volume (L/mol)</td>
                  <td id="volume-sample" className="text-right w-16">
                    {outputData.basic.volume.sample.toFixed(2)}
                  </td>
                  <td id="volume-average" className="text-right w-16">
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
                  <td id="total-energy-sample" className="text-right w-16">
                    {outputData.energy.total.sample.toFixed(2)}
                  </td>
                  <td id="total-energy-average" className="text-right w-16">
                    {outputData.energy.total.average.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Kinetic Energy (J/mol)</td>
                  <td id="kinetic-energy-sample" className="text-right w-16">
                    {outputData.energy.kinetic.sample.toFixed(2)}
                  </td>
                  <td id="kinetic-energy-average" className="text-right w-16">
                    {outputData.energy.kinetic.average.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-600">
                  <td className="text-left py-1 whitespace-nowrap">Potential Energy (J/mol)</td>
                  <td id="potential-energy-sample" className="text-right w-16">
                    {outputData.energy.potential.sample.toFixed(2)}
                  </td>
                  <td id="potential-energy-average" className="text-right w-16">
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
                  <span>Time (ps)</span>
                  <span id="current-time" className="w-16 text-right">0</span>
                </div>
                <div className="flex gap-4 justify-between">
                  <span>Total Time (ps)</span>
                  <span id="total-time" className="w-16 text-right">0</span>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex gap-4 justify-between">
                  <span>Run Time</span>
                  <span id="run-time" className="w-16 text-right">0</span>
                </div>
                <div className="flex gap-4 justify-between">
                  <span>Total Time</span>
                  <span id="total-runtime" className="w-16 text-right">0</span>
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