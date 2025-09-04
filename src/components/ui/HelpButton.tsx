import React, { useState } from 'react';

const HelpButton: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <>
      <button
        id="help-button"
        onClick={toggleHelp}
        className="material-icons absolute shadow-sm -top-14 right-12 text-3xl bg-white dark:bg-gray-800
          rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors 
          duration-200 h-10 w-10 flex items-center justify-center"
        aria-label="Help"
      >
        info
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 
            flex items-center justify-center z-50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
              p-6 rounded-lg shadow-xl 
              max-w-3xl w-full mx-4
              max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium">
                Virtual Substance Simulator - Help
              </h2>
              <button
                className="material-icons text-gray-300 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => setShowHelp(false)}
              >
                close
              </button>
            </div>
            
            <div className="space-y-4">
              <section>
                <h3 className="text-lg font-medium mb-2">About This App</h3>
                <p>
                  This application is a molecular dynamics simulator that allows you to create and analyze virtual substances.
                  It provides a visual and numerical representation of atomic interactions under various conditions.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-medium mb-2">Getting Started</h3>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Configure your substance in the <strong>Model Setup</strong> tab</li>
                  <li>Set simulation parameters in the <strong>Run Dynamics</strong> tab</li>
                  <li>Click <strong>Build</strong> to create your substance</li>
                  <li>Click <strong>Run</strong> to start the simulation</li>
                  <li>View results in the output tabs (Basic, Energy, Time)</li>
                  <li>Save interesting results to the <strong>Notebook</strong></li>
                </ol>
              </section>

              <section>
                <h3 className="text-lg font-medium mb-2">Key Features</h3>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li><strong>3D Visualization:</strong> Interactive view of molecular dynamics</li>
                  <li><strong>Real-time Data:</strong> Monitor energy, temperature, pressure and more</li>
                  <li><strong>Notebook:</strong> Save and compare multiple simulation runs</li>
                  <li><strong>Scripts:</strong> Run multiple simulations with the same parameters</li>
                  <li><strong>Data Export:</strong> Download simulation results for further analysis</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-medium mb-2">Tips</h3>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>Use the mouse to rotate, zoom, and pan the 3D view</li>
                  <li>Toggle between light and dark mode using the theme button</li>
                  <li>Parameters cannot be changed while a simulation is running</li>
                  <li>The notebook can store multiple simulation runs for comparison</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpButton; 