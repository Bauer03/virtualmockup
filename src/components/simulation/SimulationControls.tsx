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
  const isSimulationComplete = timeData.currentTime >= timeData.totalTime;

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={toggleSimulation}
        disabled={!isBuilt || (isSimulationComplete && !isRunning)}
        variant={isSimulationComplete && !isRunning ? "secondary" : "primary"}
        icon={isRunning ? 'pause' : 'play_arrow'}
        className={isSimulationComplete && !isRunning ? 'opacity-50 cursor-not-allowed' : ''}
      >
        {isRunning ? 'Stop Simulation' : isSimulationComplete ? 'Simulation Complete' : 'Run Simulation'}
      </Button>
      
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {!isBuilt && 'Build a substance first to run simulation'}
        {isBuilt && isRunning && 'Simulation running...'}
        {isBuilt && !isRunning && !isSimulationComplete && 'Simulation ready to run'}
        {isBuilt && isSimulationComplete && 'Simulation complete - rebuild to run again'}
      </div>
    </div>
  );
};

export default SimulationControls;