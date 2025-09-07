import { SimulationRun } from '../types/types';

export class ExportService {
  static exportToCSV(runs: SimulationRun[]): void {
    if (runs.length === 0) {
      alert("There's nothing to download right now! Try copying your simulation results to the notebook first.");
      return;
    }

    const headers = [
      'UID',
      'Run Number',
      'Timestamp',
      'Atom Type',
      'Number of Atoms',
      'Boundary Type',
      'Simulation Type',
      'Initial Temperature (K)',
      'Initial Volume (L/mol)',
      'Time Step (fs)', 
      'Number of Steps',
      'Update Interval (s)',
      'Sample Temperature (K)',
      'Avg Temperature (K)',
      'Sample Pressure (atm)',
      'Avg Pressure (atm)',
      'Sample Volume (L/mol)',
      'Avg Volume (L/mol)',
      'Sample Total Energy (J/mol)',
      'Avg Total Energy (J/mol)',
      'Sample Kinetic Energy (J/mol)',
      'Avg Kinetic Energy (J/mol)',
      'Sample Potential Energy (J/mol)',
      'Avg Potential Energy (J/mol)',
    ].join(',');

    const rows = runs.map(run => {
      return [
        run.uid,
        run.runNumber,
        run.timestamp,
        run.inputData.ModelSetupData.atomType,
        run.inputData.ModelSetupData.numAtoms,
        run.inputData.ModelSetupData.boundary,
        run.inputData.RunDynamicsData.simulationType,
        run.inputData.RunDynamicsData.initialTemperature,
        run.inputData.RunDynamicsData.initialVolume,
        run.inputData.RunDynamicsData.timeStep,
        run.inputData.RunDynamicsData.stepCount,
        run.inputData.RunDynamicsData.interval,
        run.outputData.basic.temperature.sample,
        run.outputData.basic.temperature.average,
        run.outputData.basic.pressure.sample,
        run.outputData.basic.pressure.average,
        run.outputData.basic.volume.sample,
        run.outputData.basic.volume.average,
        run.outputData.energy.total.sample,
        run.outputData.energy.total.average,
        run.outputData.energy.kinetic.sample,
        run.outputData.energy.kinetic.average,
        run.outputData.energy.potential.sample,
        run.outputData.energy.potential.average
      ].join(',');
    });
   
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'simulationResults.csv';
    link.click();
  }
}