import React from 'react';
import { useSimulation } from '../../hooks/useSimulation';

const BuildControls: React.FC = () => {
  const { 
    isBuilt, 
    isRunning,
    isScriptRunning,
    toggleBuild, 
    toggleSimulation,
    rotateSubstance,
    zoomCamera
  } = useSimulation();

  // Disable controls when script is running
  const isDisabled = isScriptRunning;

  return (
    <div className="flex justify-between items-center content-center gap-4 bg-gray-100 dark:bg-gray-700 rounded p-4 shadow h-full">
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-2 items-center gap-2">
          {/* Rotation Controls */}
          <button
            className="w-10 h-10 flex items-center justify-center rounded
                      border border-gray-200 dark:border-gray-600
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors duration-200
                      text-gray-600 dark:text-gray-400
                      disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => rotateSubstance({ rotationAxis: 'y', sign: '-' })}
            disabled={isDisabled}
          >
            <span className="material-icons text-base">keyboard_arrow_left</span>
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center rounded
                      border border-gray-200 dark:border-gray-600
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors duration-200
                      text-gray-600 dark:text-gray-400
                      disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => rotateSubstance({ rotationAxis: 'x', sign: '-' })}
            disabled={isDisabled}
          >
            <span className="material-icons text-base">keyboard_arrow_up</span>
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center rounded
                      border border-gray-200 dark:border-gray-600
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors duration-200
                      text-gray-600 dark:text-gray-400
                      disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => rotateSubstance({ rotationAxis: 'y', sign: '+' })}
            disabled={isDisabled}
          >
            <span className="material-icons text-base">keyboard_arrow_right</span>
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center rounded
                      border border-gray-200 dark:border-gray-600
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors duration-200
                      text-gray-600 dark:text-gray-400
                      disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => rotateSubstance({ rotationAxis: 'x', sign: '+' })}
            disabled={isDisabled}
          >
            <span className="material-icons text-base">keyboard_arrow_down</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          {/* Zoom Controls */}
          <button
            className="w-10 h-10 flex items-center justify-center rounded
                      border border-gray-200 dark:border-gray-600
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors duration-200
                      text-gray-600 dark:text-gray-400
                      disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => zoomCamera(true)}
            disabled={isDisabled}
          >
            <span className="material-icons text-base">zoom_in</span>
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center rounded
                      border border-gray-200 dark:border-gray-600
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors duration-200
                      text-gray-600 dark:text-gray-400
                      disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => zoomCamera(false)}
            disabled={isDisabled}
          >
            <span className="material-icons text-base">zoom_out</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-content items-end">
        <button
          id="build-substance-button"
          onClick={toggleBuild}
          disabled={isDisabled}
          className="flex items-center justify-between gap-2 px-3 py-2 text-sm
                  shadow-sm dark:shadow-none rounded
                  bg-blue-200 dark:bg-blue-800 
                  hover:bg-blue-300 dark:hover:bg-blue-700
                  text-gray-800 dark:text-gray-200
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  disabled:bg-gray-300 dark:disabled:bg-gray-600
                  disabled:text-gray-500 dark:disabled:text-gray-400"
        >
          <span>{isBuilt ? 'Discard' : 'Build'}</span>
          <span className="material-icons text-sm">{isBuilt ? 'close' : 'build'}</span>
        </button>

        <button
          id="run-simulation-button"
          onClick={toggleSimulation}
          disabled={!isBuilt || isDisabled}
          className="flex items-center justify-between gap-2 px-3 py-2 text-sm
                  shadow-sm dark:shadow-none rounded
                  bg-blue-200 dark:bg-blue-800
                  hover:bg-blue-300 dark:hover:bg-blue-700
                  text-gray-800 dark:text-gray-200
                  transition-colors duration-200
                  disabled:bg-gray-300 dark:disabled:bg-gray-600
                  disabled:text-gray-500 dark:disabled:text-gray-400
                  disabled:cursor-not-allowed"
        >
          <span>{isRunning ? 'Stop' : 'Run'}</span>
          <span className="material-icons text-sm">{isRunning ? 'pause' : 'play_arrow'}</span>
        </button>
        
        {isScriptRunning && (
          <div className="text-xs text-amber-500 mt-1">
            Script running - controls disabled
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildControls;