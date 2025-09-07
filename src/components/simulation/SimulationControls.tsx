import React from 'react';
import { useSimulation } from '../../hooks/useSimulation';
import Button from '../ui/Button';

const SimulationControls: React.FC = () => {
  const { 
    isBuilt, 
    isRunning,
    toggleSimulation,
    timeData
  } = useSimulation();

  // Check if simulation has completed by comparing current time to total time
  const isSimulationComplete = timeData.currentTime >= timeData.totalTime && !isRunning && timeData.totalTime > 0;

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={toggleSimulation}
        disabled={!isBuilt}
        variant="primary"
        icon={isRunning ? 'pause' : 'play_arrow'}
      >
        {isRunning ? 'Stop Simulation' : 'Run Simulation'}
      </Button>
      
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {!isBuilt && 'Build a substance first to run simulation'}
        {isBuilt && isRunning && 'Simulation running...'}
        {isBuilt && !isRunning && !isSimulationComplete && 'Simulation ready to run'}
        {isBuilt && isSimulationComplete && 'Simulation complete - ready for new run'}
      </div>
      
      {isSimulationComplete && (
        <div className="text-sm text-green-600 dark:text-green-400 font-medium">
          ✓ Simulation Complete
        </div>
      )}
    </div>
  );
};

export default SimulationControls;