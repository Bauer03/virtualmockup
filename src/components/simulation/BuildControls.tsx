import React from 'react';
import { useSimulation } from '../../hooks/useSimulation';

const BuildControls: React.FC = () => {
  const { 
    isBuilt, 
    isRunning, 
    toggleBuild, 
    startRun,
    stopRun,
    rotateSubstance,
    zoomCamera
  } = useSimulation();

  const handleRunClick = () => {
    if (isRunning) {
      stopRun();
    } else {
      startRun();
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={toggleBuild}
        className="px-3 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
      >
        {isBuilt ? 'Destroy' : 'Build'}
      </button>
      {isBuilt && (
        <>
          <button
            onClick={handleRunClick}
            className="px-3 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            {isRunning ? 'Stop' : 'Run'}
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => rotateSubstance({ rotationAxis: 'x', sign: '+' })}
              className="px-2 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              +X
            </button>
            <button
              onClick={() => rotateSubstance({ rotationAxis: 'x', sign: '-' })}
              className="px-2 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              -X
            </button>
            <button
              onClick={() => rotateSubstance({ rotationAxis: 'y', sign: '+' })}
              className="px-2 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              +Y
            </button>
            <button
              onClick={() => rotateSubstance({ rotationAxis: 'y', sign: '-' })}
              className="px-2 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              -Y
            </button>
            <button
              onClick={() => rotateSubstance({ rotationAxis: 'z', sign: '+' })}
              className="px-2 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              +Z
            </button>
            <button
              onClick={() => rotateSubstance({ rotationAxis: 'z', sign: '-' })}
              className="px-2 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              -Z
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => zoomCamera(true)}
              className="px-2 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              +
            </button>
            <button
              onClick={() => zoomCamera(false)}
              className="px-2 py-1 text-sm font-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              -
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BuildControls; 