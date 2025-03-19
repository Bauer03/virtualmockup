import React, { useEffect, useContext } from 'react';
import { useData } from '../../hooks/useData';
import { potentialModel, atomType } from '../../types/types';
import { SimulationContext } from '../../context/SimulationContext';

interface PotentialParametersProps {
  potentialModel: potentialModel;
  potentialParams: {
    sigma: number;
    epsilon: number;
  };
  onUpdate: (params: { sigma: number; epsilon: number }) => void;
  isDisabled: boolean;
}

// Define realistic Lennard-Jones parameters for each atom type
const LJ_PARAMS = {
  He: { sigma: 2.56, epsilon: 0.084 },
  Ne: { sigma: 2.75, epsilon: 0.31 },
  Ar: { sigma: 3.40, epsilon: 1.00 },
  Kr: { sigma: 3.65, epsilon: 1.42 },
  Xe: { sigma: 3.98, epsilon: 1.77 },
  User: { sigma: 3.40, epsilon: 1.00 } // Default to Argon values
};

// Parameters for Soft Sphere potential (typically use the same sigma but different epsilon)
const SS_PARAMS = {
  He: { sigma: 2.56, epsilon: 0.042 }, // Half the LJ epsilon
  Ne: { sigma: 2.75, epsilon: 0.155 },
  Ar: { sigma: 3.40, epsilon: 0.5 },
  Kr: { sigma: 3.65, epsilon: 0.71 },
  Xe: { sigma: 3.98, epsilon: 0.885 },
  User: { sigma: 3.40, epsilon: 0.5 }
};

const PotentialParameters: React.FC<PotentialParametersProps> = ({ potentialModel, potentialParams, onUpdate, isDisabled }) => {
  const { inputData, updateModelSetup } = useData();
  const { isBuilt, isRunning } = useContext(SimulationContext);
  const { atomType } = inputData.ModelSetupData;
  
  const isDisabledCombined = isBuilt || isRunning || isDisabled;

  // Update potential parameters when atom type or model changes
  useEffect(() => {
    if (potentialModel === 'LennardJones' || potentialModel === 'SoftSphere') {
      // Choose parameters based on the potential model
      const defaultParams = potentialModel === 'LennardJones' 
        ? LJ_PARAMS[atomType as keyof typeof LJ_PARAMS]
        : SS_PARAMS[atomType as keyof typeof SS_PARAMS];
      
      // Only update if the parameters are missing or different from the defaults for this atom type and model
      const needsUpdate = !potentialParams || 
        potentialParams.sigma !== defaultParams.sigma || 
        potentialParams.epsilon !== defaultParams.epsilon;
        
      if (needsUpdate) {
        updateModelSetup({
          potentialParams: {
            sigma: defaultParams.sigma,
            epsilon: defaultParams.epsilon
          }
        });
      }
    }
  }, [atomType, potentialModel, potentialParams, updateModelSetup]);

  const handleSigmaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      updateModelSetup({
        potentialParams: {
          ...potentialParams,
          sigma: value
        }
      });
    }
  };

  const handleEpsilonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      updateModelSetup({
        potentialParams: {
          ...potentialParams,
          epsilon: value
        }
      });
    }
  };

  // Get current defaults based on atom type and model
  const defaultParams = potentialModel === 'LennardJones'
    ? LJ_PARAMS[atomType as keyof typeof LJ_PARAMS]
    : SS_PARAMS[atomType as keyof typeof SS_PARAMS];
    
  const defaultSigma = defaultParams.sigma.toFixed(2);
  const defaultEpsilon = defaultParams.epsilon.toFixed(3);
  
  // Define the potential description based on the model
  const potentialDescription = potentialModel === 'LennardJones'
    ? "Lennard-Jones: 4ε[(σ/r)¹² - (σ/r)⁶]"
    : "Soft Sphere: ε(σ/r)¹²";

  return (
    <div className="grid gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow relative" id="potential-parameters">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        {potentialDescription}
      </div>
      
      <div className="flex gap-2 justify-between">
        <label htmlFor="sigma" className="flex justify-between items-center">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Sigma (Å)</span>
        </label>
        <input
          type="number"
          id="sigma"
          value={potentialParams?.sigma || ''}
          onChange={handleSigmaChange}
          disabled={isDisabledCombined}
          className={`block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isDisabledCombined ? 'opacity-50 cursor-not-allowed' : ''}`}
          placeholder={defaultSigma}
          step="0.01"
        />
      </div>
      <div className="flex gap-2 justify-between">
        <label htmlFor="epsilon" className="flex justify-between items-center">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Epsilon (kJ/mol)</span>
        </label>
        <input
          type="number"
          id="epsilon"
          value={potentialParams?.epsilon || ''}
          onChange={handleEpsilonChange}
          disabled={isDisabledCombined}
          className={`block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isDisabledCombined ? 'opacity-50 cursor-not-allowed' : ''}`}
          placeholder={defaultEpsilon}
          step="0.001"
        />
      </div>
    </div>
  );
};

export default PotentialParameters;