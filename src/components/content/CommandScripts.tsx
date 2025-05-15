import React, { useState, useContext, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { SimulationContext } from '../../context/SimulationContext';
import { toast } from 'react-hot-toast';

const CommandScripts: React.FC = () => {
  const { updateScriptData, saveCurrentRun, savedRuns, inputData } = useData();
  const { 
    isBuilt, 
    isRunning: isSimRunning, 
    buildSubstance, 
    startRun, 
    stopRun, 
    setScriptRunning,
    timeData
  } = useContext(SimulationContext);
  
  const [runCount, setRunCount] = useState<number | string>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  const [maxRunsReached, setMaxRunsReached] = useState<boolean>(false);

  // Maximum number of runs that can be stored in the notebook
  const MAX_STORED_RUNS = 3000;

  // Check if the input should be disabled
  const isDisabled = isBuilt || isSimRunning || isRunning;

  // Effect to check if we're approaching the max runs limit
  useEffect(() => {
    setMaxRunsReached(savedRuns.length >= MAX_STORED_RUNS);
  }, [savedRuns]);

  const handleRunCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty input for typing purposes
    if (inputValue === '') {
      setRunCount('');
      return;
    }
    
    const value = parseInt(inputValue);
    if (!isNaN(value)) {
      setRunCount(value);
      // Only update context data if value is valid (> 0)
      if (value > 0) {
        updateScriptData(value);
      }
    }
  };

  const handleCancelSimulations = () => {
    setIsCanceling(true);
    setProgress(`Canceling after current simulation completes...`);
  };

  const handleRunSimulations = async () => {
    // Ensure runCount is valid before running simulations
    if (runCount === '' || Number(runCount) <= 0) {
      setRunCount(1);
      updateScriptData(1);
      return;
    }
    
    const numericRunCount = Number(runCount);
    if (numericRunCount > 3000 || isNaN(numericRunCount)) {
      toast.error("Maximum allowed runs is 3000");
      return;
    }

    // Check if we'll exceed the maximum number of stored runs
    const remainingSlots = MAX_STORED_RUNS - savedRuns.length;
    if (numericRunCount > remainingSlots) {
      toast(`Only ${remainingSlots} more runs can be stored. Limiting to ${remainingSlots} runs.`, {
        icon: '⚠️',
        style: {
          background: '#FFF3CD',
          color: '#856404',
          border: '1px solid #FFEEBA'
        }
      });
    }

    const runsToExecute = Math.min(numericRunCount, remainingSlots);
    
    setIsRunning(true);
    setShowProgress(true);
    setIsCanceling(false);
    setScriptRunning(true); // Set script running state to true

    try {
      console.log('Starting script simulation with input data:', inputData);
      
      // Build the substance if not already built
      if (!isBuilt) {
        setProgress('Building substance...');
        await buildSubstance();
      }

      for (let i = 0; i < runsToExecute; i++) {
        // Check if cancellation was requested
        if (isCanceling) {
          console.log(`Script canceled after ${i} simulations`);
          setProgress(`Canceled after ${i} simulation${i !== 1 ? 's' : ''}`);
          break;
        }
        
        setProgress(`Running simulation ${i + 1} of ${runsToExecute}...`);
        
        // Start the simulation - just logs instead of actual simulation
        console.log(`Starting simulation ${i + 1} of ${runsToExecute}`);
        
        // Simulate the run with a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Save the results
        await saveCurrentRun();
        
        // Add a small delay to prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!isCanceling) {
        console.log(`Completed ${runsToExecute} simulations`);
        setProgress(`Completed ${runsToExecute} simulation${runsToExecute !== 1 ? 's' : ''}`);
      }
    } catch (error) {
      setProgress('Error running simulations');
      console.error('Error running simulations:', error);
    } finally {
      setIsRunning(false);
      setIsCanceling(false);
      setScriptRunning(false); // Set script running state to false
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
          max="3000" 
          value={runCount} 
          onChange={handleRunCountChange}
          onBlur={() => {
            // When input loses focus, ensure value is valid
            if (runCount === '' || Number(runCount) <= 0) {
              setRunCount(1);
              updateScriptData(1);
            }
          }}
          disabled={isDisabled}
          className={`px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <div className="text-xs text-gray-500">
          Maximum 3000 runs at a time
          {maxRunsReached && (
            <div className="text-red-500 mt-1">
              Notebook storage full! Please clear some entries before running more simulations.
            </div>
          )}
          {!maxRunsReached && savedRuns.length > 0 && (
            <div className="mt-1">
              {savedRuns.length} runs stored, {MAX_STORED_RUNS - savedRuns.length} slots remaining
            </div>
          )}
        </div>
      </div>

      {!isRunning ? (
        <button
          className={`px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${
            isDisabled || maxRunsReached ? 'opacity-50 cursor-not-allowed bg-blue-300' : ''
          }`}
          onClick={handleRunSimulations}
          disabled={isDisabled || maxRunsReached}
        >
          Run Simulations
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="px-3 py-2 bg-blue-500 text-white rounded opacity-50 cursor-not-allowed bg-blue-300"
            disabled={true}
          >
            Running...
          </button>
          <button
            className={`px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors ${isCanceling ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleCancelSimulations}
            disabled={isCanceling}
          >
            {isCanceling ? 'Canceling...' : 'Cancel'}
          </button>
        </div>
      )}

      {showProgress && (
        <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-2 rounded">
          {progress}
        </div>
      )}
    </div>
  );
};

export default CommandScripts;