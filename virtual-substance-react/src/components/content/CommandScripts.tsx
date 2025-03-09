import React, { useState, useContext } from 'react';
import { useData } from '../../hooks/useData';
import { SimulationContext } from '../../context/SimulationContext';

const CommandScripts: React.FC = () => {
  const { updateScriptData, saveCurrentRun } = useData();
  const { isBuilt, isRunning: isSimRunning } = useContext(SimulationContext);
  const [runCount, setRunCount] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const [showProgress, setShowProgress] = useState<boolean>(false);

  const isDisabled = isBuilt || isSimRunning;

  const handleRunCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setRunCount(value);
      updateScriptData(value);
    }
  };

  const handleRunSimulations = async () => {
    if (runCount > 500 || isNaN(runCount)) {
      alert("Maximum allowed runs is 500");
      return;
    }

    setIsRunning(true);
    setShowProgress(true);

    try {
      for (let i = 0; i < runCount; i++) {
        setProgress(`Running simulation ${i + 1} of ${runCount}...`);
        await saveCurrentRun();
        // Add a small delay to prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      setProgress(`Completed ${runCount} simulations`);
    } catch (error) {
      setProgress('Error running simulations');
      console.error('Error running simulations:', error);
    } finally {
      setIsRunning(false);
      setTimeout(() => setShowProgress(false), 2000);
    }
  };

  return (
    <div className="grid gap-4 px-3 py-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium">Number of Runs</label>
        <input 
          type="number" 
          id="runCount" 
          min="1" 
          max="500" 
          value={runCount} 
          onChange={handleRunCountChange}
          disabled={isDisabled}
          className={`px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <div className="text-xs text-gray-500">Maximum 500 runs at a time</div>
      </div>

      <button
        className={`px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${isDisabled || isRunning ? 'opacity-50 cursor-not-allowed bg-blue-300' : ''}`}
        onClick={handleRunSimulations}
        disabled={isDisabled || isRunning}
      >
        {isRunning ? 'Running...' : 'Run Simulations'}
      </button>

      {showProgress && (
        <div id="runProgress" className="text-sm">
          {progress}
        </div>
      )}
    </div>
  );
};

export default CommandScripts;