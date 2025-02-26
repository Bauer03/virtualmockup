import React, { useState, useEffect } from "react";
import { useData } from "../../hooks/useData";
import { SimulationRun } from "../../types/types";

const Notebook: React.FC = () => {
  const { savedRuns, deleteRun, clearAllRuns, exportToCSV } = useData();
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [selectedRun, setSelectedRun] = useState<SimulationRun | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    // Listen for the custom event from Output component
    const handleOutputCopied = () => {
      // No need to refresh data as it will come from context
    };

    document.addEventListener("output-copied", handleOutputCopied);

    return () => {
      document.removeEventListener("output-copied", handleOutputCopied);
    };
  }, []);

  const handleShowDetails = (run: SimulationRun, index: number) => {
    setSelectedRun(run);
    setSelectedIndex(index);
    setShowDialog(true);
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all outputs?")) {
      clearAllRuns();
    }
  };

  const handleDelete = async (uid: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteRun(uid);
    } catch (error) {
      console.error("Error deleting run:", error);
    }
  };

  return (
    <div className="flex flex-col px-3 gap-4 h-full">
      <div className="flex justify-end items-center gap-4">
        <button
          className="px-2 py-1 text-xs shadow-sm rounded font-light
                  hover:bg-white dark:hover:bg-gray-800
                  bg-gray-100 dark:bg-gray-700
                  text-gray-800 dark:text-gray-200
                  border border-white dark:border-gray-600
                  transition-colors duration-200 items-center
                  flex gap-1 self-end"
          onClick={handleClearAll}
        >
          <span>Clear All</span>
          <span className="material-icons text-sm">delete</span>
        </button>

        <button
          className="px-2 py-1 text-xs shadow-sm rounded font-light
                  hover:bg-white dark:hover:bg-gray-800
                  bg-gray-100 dark:bg-gray-700
                  text-gray-800 dark:text-gray-200
                  border border-white dark:border-gray-600
                  transition-colors duration-200 items-center
                  flex gap-1 self-end"
          onClick={exportToCSV}
        >
          <span>Download</span>
          <span className="material-icons text-sm">download</span>
        </button>
      </div>

      <div
        className="flex flex-col gap-2 overflow-y-auto h-[180px] pr-2 w-fill"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(156, 163, 175, 0.5) transparent",
        }}
      >
        {savedRuns.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            No saved runs yet. Run a simulation and copy the output to see it
            here.
          </div>
        ) : (
          savedRuns.map((run, index) => (
            <div
              key={run.uid}
              className="bg-white dark:bg-gray-800 p-2 rounded shadow
                      flex justify-between items-center
                      cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600
                      transition-colors duration-200"
              onClick={() => handleShowDetails(run, index)}
            >
              <div className="text-sm flex-1">
                Saved Output - {new Date(run.timestamp).toLocaleString()}
              </div>
              <button
                className="material-icons text-sm text-gray-500 hover:text-red-500 transition-colors duration-200 ml-2"
                onClick={(e) => handleDelete(run.uid, e)}
              >
                delete
              </button>
            </div>
          ))
        )}
      </div>

      {/* Details Dialog */}
      {showDialog && selectedRun && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 
            flex items-center justify-center z-50"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
              p-6 rounded-lg shadow-xl 
              max-w-2xl w-full mx-4
              max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">
                Output {selectedIndex + 1} Details
              </h2>
              <button
                className="material-icons text-gray-300 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => setShowDialog(false)}
              >
                close
              </button>
            </div>
            <div className="grid gap-6">
              <div className="grid gap-2">
                <div className="font-medium text-sm">Basic Measurements</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pl-4">
                  <div>Temperature:</div>
                  <div>
                    {selectedRun.outputData.basic.temperature.sample.toFixed(2)}
                    K (avg:
                    {selectedRun.outputData.basic.temperature.average.toFixed(
                      2
                    )}
                    K)
                  </div>
                  <div>Pressure:</div>
                  <div>
                    {selectedRun.outputData.basic.pressure.sample.toFixed(2)}{" "}
                    atm (avg:
                    {selectedRun.outputData.basic.pressure.average.toFixed(
                      2
                    )}{" "}
                    atm)
                  </div>
                  <div>Volume:</div>
                  <div>
                    {selectedRun.outputData.basic.volume.sample.toFixed(2)}{" "}
                    L/mol (avg:
                    {selectedRun.outputData.basic.volume.average.toFixed(
                      2
                    )}{" "}
                    L/mol)
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="font-medium text-sm">Energy Measurements</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pl-4">
                  <div>Total Energy:</div>
                  <div>
                    {selectedRun.outputData.energy.total.sample.toFixed(2)}{" "}
                    J/mol (avg:
                    {selectedRun.outputData.energy.total.average.toFixed(
                      2
                    )}{" "}
                    J/mol)
                  </div>
                  <div>Kinetic Energy:</div>
                  <div>
                    {selectedRun.outputData.energy.kinetic.sample.toFixed(2)}{" "}
                    J/mol (avg:
                    {selectedRun.outputData.energy.kinetic.average.toFixed(
                      2
                    )}{" "}
                    J/mol)
                  </div>
                  <div>Potential Energy:</div>
                  <div>
                    {selectedRun.outputData.energy.potential.sample.toFixed(2)}{" "}
                    J/mol (avg:
                    {selectedRun.outputData.energy.potential.average.toFixed(
                      2
                    )}{" "}
                    J/mol)
                  </div>
                </div>
              </div>

              {/* Add Time Information Section */}
              <div className="grid gap-2">
                <div className="font-medium text-sm">Time Information</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pl-4">
                  <div>Time Step:</div>
                  <div>
                    {selectedRun.inputData.RunDynamicsData.timeStep.toFixed(5)}{" "}
                    ps
                  </div>
                  <div>Number of Steps:</div>
                  <div>{selectedRun.inputData.RunDynamicsData.stepCount}</div>
                  <div>Total Simulation Time:</div>
                  <div>
                    {(
                      selectedRun.inputData.RunDynamicsData.timeStep *
                      selectedRun.inputData.RunDynamicsData.stepCount
                    ).toFixed(4)}{" "}
                    ps
                  </div>
                  <div>Completed At:</div>
                  <div>
                    {new Date(selectedRun.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notebook;
