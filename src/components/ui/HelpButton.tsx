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
              p-10 rounded-lg shadow-xl 
              max-w-3xl w-full mx-4
              max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium">
                Info
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
                <h3 className="text-lg font-medium mb-2">What is Virtual Substance?</h3>
                <p className='ml-4'>
                  Virtual Substance is a molecular dynamics simulation program. It simulates atoms according to user-selected parameters, and allows the user to measure and export these simulations. <br />
                  This program is a rewrite of the program of the same name created by Papanikolas in 2007, found <a href="https://pubs.acs.org/doi/10.1021/bk-2008-0973.ch011" target="_blank" rel="noopener noreferrer" className="underline mr-1 hover:text-slate-700 dark:hover:text-slate-300">here</a>. <br />
                </p>
              </section>

              <section>
                <h3 className="text-lg font-medium mb-2">Getting Started</h3>
                <ol className="list-disc list-inside space-y-1 ml-4">
                  <li>Configure your substance in the <strong>Model Setup</strong> tab</li>
                  <li>Set simulation parameters in the <strong>Run Dynamics</strong> tab</li>
                  <li>Click <strong>Build</strong> to create your substance</li>
                  <li>Click <strong>Run</strong> to run the simulation.</li>
                  <li>View results in the output tabs (Basic, Energy, Time)</li>
                  <li>Save results to the <strong>Notebook</strong>, and export them to .csv files</li>
                </ol>
              </section>

              <section>
                <h3 className="text-lg font-medium mb-2">Tips</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Use the mouse to rotate, zoom, and pan the 3D view</li>
                  <li>The "run dynamics" section can be modified in between subsequent runs</li>
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