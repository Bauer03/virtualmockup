import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { atomType, boundary, potentialModel } from '../../types/types';
import PotentialParameters from './PotentialParameters';

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

const ModelSetup: React.FC = () => {
  const { inputData, updateModelSetup } = useData();
  const modelData = inputData.ModelSetupData;

  // Update atom mass based on selected atom type
  useEffect(() => {
    if (modelData.atomType === 'He' && modelData.atomicMass !== 4.002602) {
      updateModelSetup({ atomicMass: 4.002602 });
    } else if (modelData.atomType === 'Ne' && modelData.atomicMass !== 20.1797) {
      updateModelSetup({ atomicMass: 20.1797 });
    } else if (modelData.atomType === 'Ar' && modelData.atomicMass !== 39.948) {
      updateModelSetup({ atomicMass: 39.948 });
    } else if (modelData.atomType === 'Kr' && modelData.atomicMass !== 83.798) {
      updateModelSetup({ atomicMass: 83.798 });
    } else if (modelData.atomType === 'Xe' && modelData.atomicMass !== 131.293) {
      updateModelSetup({ atomicMass: 131.293 });
    }
  }, [modelData.atomType, modelData.atomicMass, updateModelSetup]);

  // Update potential parameters when atom type changes or potential model changes
  useEffect(() => {
    if (modelData.potentialModel === 'LennardJones' || modelData.potentialModel === 'SoftSphere') {
      // Choose parameters based on the potential model
      const defaultParams = modelData.potentialModel === 'LennardJones' 
        ? LJ_PARAMS[modelData.atomType]
        : SS_PARAMS[modelData.atomType];
      
      updateModelSetup({
        potentialParams: {
          sigma: defaultParams.sigma,
          epsilon: defaultParams.epsilon
        }
      });
    }
  }, [modelData.atomType, modelData.potentialModel, updateModelSetup]);

  const handleAtomTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateModelSetup({ atomType: e.target.value as atomType });
  };

  const handleBoundaryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateModelSetup({ boundary: e.target.value as boundary });
  };

  const handlePotentialModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value as potentialModel;
    updateModelSetup({ potentialModel: newModel });
    
    // When changing to a potential model, initialize with correct parameters
    if (newModel === 'LennardJones' || newModel === 'SoftSphere') {
      // Choose parameters based on the new potential model
      const defaultParams = newModel === 'LennardJones' 
        ? LJ_PARAMS[modelData.atomType] 
        : SS_PARAMS[modelData.atomType];
      
      updateModelSetup({
        potentialParams: {
          sigma: defaultParams.sigma,
          epsilon: defaultParams.epsilon
        }
      });
    }
  };

  const handleAtomCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      updateModelSetup({ numAtoms: value });
    }
  };

  const handleAtomicMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      updateModelSetup({ atomicMass: value });
    }
  };

  // Helper functions to generate tooltip descriptions
  const getPotentialDescription = (model: potentialModel): string => {
    switch (model) {
      case 'NoPotential':
        return 'Atoms interact only through collisions, with no attractive or repulsive forces';
      case 'LennardJones':
        return 'Atoms experience both attraction (at long ranges) and repulsion (at short ranges)';
      case 'SoftSphere':
        return 'Atoms experience only repulsive forces, with no long-range attraction';
      default:
        return '';
    }
  };

  const getBoundaryDescription = (boundaryType: boundary): string => {
    switch (boundaryType) {
      case 'Fixed Walls':
        return 'Atoms bounce off the walls of the container';
      case 'Periodic':
        return 'Atoms that exit one side of the container reappear on the opposite side';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col px-3">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-8">
          <fieldset className="flex flex-col gap-2">
            <label htmlFor="AtomType" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Atom Type
            </label>
            <select 
              id="AtomType" 
              value={modelData.atomType}
              onChange={handleAtomTypeChange}
              title={`Currently selected: ${modelData.atomType}, Mass: ${modelData.atomicMass} amu`}
            >
              <option value="He">He</option>
              <option value="Ne">Ne</option>
              <option value="Ar">Ar</option>
              <option value="Kr">Kr</option>
              <option value="Xe">Xe</option>
              <option value="User">User</option>
            </select>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label htmlFor="Boundary" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Boundary
            </label>
            <select 
              id="Boundary"
              value={modelData.boundary}
              onChange={handleBoundaryChange}
              title={getBoundaryDescription(modelData.boundary)}
            >
              <option value="Fixed Walls">Fixed Walls</option>
              <option value="Periodic">Periodic</option>
            </select>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label htmlFor="PotentialModel" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Potential Model
            </label>
            <select 
              id="PotentialModel"
              value={modelData.potentialModel}
              onChange={handlePotentialModelChange}
              title={getPotentialDescription(modelData.potentialModel)}
            >
              <option value="NoPotential">No Potential</option>
              <option value="LennardJones">LennardJones</option>
              <option value="SoftSphere">Soft Sphere</option>
            </select>
          </fieldset>
        </div>

        <div className="flex gap-4 items-center justify-between" id="model-setup-inputs">
          <div className="grid gap-2 ps-0 px-2 py-2">
            <div className="flex gap-2 justify-between">
              <label htmlFor="AtomCount" className="flex justify-between items-center">
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Num. of atoms</span>
              </label>
              <input 
                type="number" 
                id="AtomCount" 
                value={modelData.numAtoms}
                onChange={handleAtomCountChange}
                className="block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                placeholder="1"
              />
            </div>

            <div className="flex gap-2 justify-between">
              <label htmlFor="AtomicMass" className="flex justify-between items-center">
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Atomic Mass</span>
              </label>
              <input 
                type="number" 
                id="AtomicMass" 
                value={modelData.atomicMass}
                onChange={handleAtomicMassChange}
                className="block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                placeholder="4.002602"
                step="0.000001"
              />
            </div>
          </div>
          
          {(modelData.potentialModel === 'LennardJones' || modelData.potentialModel === 'SoftSphere') && (
            <PotentialParameters model={modelData.potentialModel} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelSetup;