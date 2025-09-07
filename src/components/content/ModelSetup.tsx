import React, { useEffect } from "react";
import { useData } from "../../hooks/useData";
import { atomType, boundary, potentialModel } from "../../types/types";
import { LJ_PARAMS, SS_PARAMS } from "../../constants/potentialParams";
import { useContext } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import PotentialParameters from "./PotentialParameters";
import "../../styles/ParameterOptimization.css";

const ModelSetup: React.FC = () => {
  const { inputData, updateModelSetup } = useData();
  const { isBuilt, isRunning } = useContext(SimulationContext);
  const modelData = inputData.ModelSetupData;

  const isDisabled = isBuilt || isRunning;

  // Update atom mass based on selected atom type (only when atom type changes)
  useEffect(() => {
    // Skip if the atom type is 'User' since that means custom mass
    if (modelData.atomType === "User") return;

    const standardAtomMasses = {
      He: 4.002602,
      Ne: 20.1797,
      Ar: 39.948,
      Kr: 83.798,
      Xe: 131.293,
    };

    const standardMass =
      standardAtomMasses[modelData.atomType as keyof typeof standardAtomMasses];
    if (standardMass && modelData.atomicMass !== standardMass) {
      updateModelSetup({ atomicMass: standardMass });
    }
  }, [modelData.atomType, modelData.atomicMass, updateModelSetup]);

  // Update potential parameters when atom type changes or potential model changes
  useEffect(() => {
    if (
      modelData.potentialModel === "LennardJones" ||
      modelData.potentialModel === "SoftSphere"
    ) {
      // Choose parameters based on the potential model
      const defaultParams =
        modelData.potentialModel === "LennardJones"
          ? LJ_PARAMS[modelData.atomType]
          : SS_PARAMS[modelData.atomType];

      updateModelSetup({
        potentialParams: {
          sigma: defaultParams.sigma,
          epsilon: defaultParams.epsilon,
        },
      });
    }
  }, [modelData.atomType, modelData.potentialModel, updateModelSetup]);

  const handleAtomTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateModelSetup({ atomType: e.target.value as atomType });
  };

  const handleBoundaryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateModelSetup({ boundary: e.target.value as boundary });
  };

  const handlePotentialModelChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newModel = e.target.value as potentialModel;
    updateModelSetup({ potentialModel: newModel });

    // When changing to a potential model, initialize with correct parameters
    if (newModel === "LennardJones" || newModel === "SoftSphere") {
      // Choose parameters based on the new potential model
      const defaultParams =
        newModel === "LennardJones"
          ? LJ_PARAMS[modelData.atomType]
          : SS_PARAMS[modelData.atomType];

      updateModelSetup({
        potentialParams: {
          sigma: defaultParams.sigma,
          epsilon: defaultParams.epsilon,
        },
      });
    }
  };

  const handleAtomCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      // Enforce maximum of 200 atoms
      if (value > 200) {
        alert("Maximum allowed atoms is 200");
        updateModelSetup({ numAtoms: 200 });
      } else {
        updateModelSetup({ numAtoms: value });
      }
    }
  };

  const handleAtomicMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow empty input for better user experience
    if (inputValue === "") {
      // Just update the display value without validation
      // This allows users to clear the field before typing a new value
      updateModelSetup({
        atomicMass: 0, // Temporary value that will be displayed as empty
        atomType: "User", // Also set to User type when manually clearing
      });
      return;
    }

    const value = parseFloat(inputValue);
    if (!isNaN(value) && value > 0) {
      // Check if the atom type needs to be changed to 'User'
      const standardAtomMasses = {
        He: 4.002602,
        Ne: 20.1797,
        Ar: 39.948,
        Kr: 83.798,
        Xe: 131.293,
      };

      // If the current atom type is not 'User' and the mass doesn't match the standard mass
      const currentType = modelData.atomType;
      const standardMass =
        standardAtomMasses[currentType as keyof typeof standardAtomMasses];

      if (currentType !== "User" && value !== standardMass) {
        // Update both atomic mass and atom type
        updateModelSetup({
          atomicMass: value,
          atomType: "User",
        });
      } else {
        // Just update the atomic mass
        updateModelSetup({ atomicMass: value });
      }
    }
  };

  // Helper functions to generate tooltip descriptions
  const getPotentialDescription = (model: potentialModel): string => {
    switch (model) {
      case "NoPotential":
        return "Atoms interact only through collisions, with no attractive or repulsive forces";
      case "LennardJones":
        return "Atoms experience both attraction (at long ranges) and repulsion (at short ranges)";
      case "SoftSphere":
        return "Atoms experience only repulsive forces, with no long-range attraction";
      default:
        return "";
    }
  };

  const getBoundaryDescription = (boundaryType: boundary): string => {
    switch (boundaryType) {
      case "Fixed Walls":
        return "Atoms bounce off the walls of the container";
      case "Periodic":
        return "Atoms that exit one side of the container reappear on the opposite side";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col px-3">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-8">
          <fieldset className="flex flex-col gap-2">
            <label
              htmlFor="AtomType"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Atom Type
            </label>
            <select
              id="AtomType"
              value={modelData.atomType}
              onChange={handleAtomTypeChange}
              disabled={isDisabled}
              title={`Currently selected: ${modelData.atomType}, Mass: ${modelData.atomicMass} amu`}
              className={`block w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                isDisabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
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
            <label
              htmlFor="Boundary"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Boundary
            </label>
            <select
              id="Boundary"
              value={modelData.boundary}
              onChange={handleBoundaryChange}
              disabled={isDisabled}
              title={getBoundaryDescription(modelData.boundary)}
              className={`block w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                isDisabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <option value="Fixed Walls">Fixed Walls</option>
              <option value="Periodic">Periodic</option>
            </select>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label
              htmlFor="PotentialModel"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Potential Model
            </label>
            <select
              id="PotentialModel"
              value={modelData.potentialModel}
              onChange={handlePotentialModelChange}
              disabled={isDisabled}
              title={getPotentialDescription(modelData.potentialModel)}
              className={`block w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                isDisabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <option value="NoPotential">No Potential</option>
              <option value="LennardJones">Lennard-Jones</option>
              <option value="SoftSphere">Soft Sphere</option>
            </select>
          </fieldset>
        </div>

        <div
          className="flex gap-4 items-center justify-between"
          id="model-setup-inputs"
        >
          <div className="grid gap-2 ps-0 px-2 py-2">
            <div className="flex gap-2 justify-between">
              <label
                htmlFor="NumAtoms"
                className="flex justify-between items-center"
              >
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Num. of atoms
                </span>
              </label>
              <input
                type="number"
                id="NumAtoms"
                value={modelData.numAtoms}
                onChange={handleAtomCountChange}
                disabled={isDisabled}
                min="1"
                max="200"
                className={`block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                  isDisabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
                placeholder="1"
              />
            </div>
            <div className="text-xs text-gray-500 -mt-1">
              Maximum of 200 atoms
            </div>
            <div className="flex gap-2 justify-between">
              <label
                htmlFor="AtomicMass"
                className="flex justify-between items-center"
              >
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Atomic Mass
                </span>
              </label>
              <input
                type="number"
                id="AtomicMass"
                value={modelData.atomicMass === 0 ? "" : modelData.atomicMass}
                onChange={handleAtomicMassChange}
                disabled={isDisabled}
                className={`block w-20 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                  isDisabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
                placeholder="4.002602"
                step="0.000001"
              />
            </div>
          </div>
          {(modelData.potentialModel === "LennardJones" ||
            modelData.potentialModel === "SoftSphere") &&
            modelData.potentialParams && (
              <PotentialParameters
                potentialModel={modelData.potentialModel}
                potentialParams={modelData.potentialParams}
                onUpdate={(params) =>
                  updateModelSetup({ potentialParams: params })
                }
                isDisabled={isDisabled}
              />
            )}
        </div>
      </div>
    </div>
  );
};

export default ModelSetup;
