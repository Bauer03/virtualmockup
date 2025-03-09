import React from 'react';
import { useSimulation } from '../../hooks/useSimulation';

const SimulationControls: React.FC = () => {
  const { 
    isBuilt, 
    isRunning, 
    startRun,
    stopRun
  } = useSimulation();

  const handleRunClick = () => {
    if (isRunning) {
      stopRun();
    } else {
      startRun();
    }
  };

  return (
    <div className="flex gap-2">
      {isBuilt && (
        <button
          onClick={handleRunClick}
          className="px-3 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          disabled={!isBuilt}
        >
          {isRunning ? 'Stop' : 'Run'}
        </button>
      )}
    </div>
  );
};

export default SimulationControls; 