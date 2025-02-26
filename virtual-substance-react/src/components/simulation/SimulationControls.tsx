import React from 'react';
import { useSimulation } from '../../hooks/useSimulation';
import Button from '../ui/Button';

const SimulationControls: React.FC = () => {
  const { 
    isBuilt, 
    isRunning, 
    toggleSimulation 
  } = useSimulation();

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
        {isBuilt && !isRunning && 'Simulation ready to run'}
      </div>
    </div>
  );
};

export default SimulationControls;