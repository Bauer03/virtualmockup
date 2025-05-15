import { InputData, OutputData } from '../types/types';

export class SimulationManager {
  private canvas: HTMLCanvasElement;
  private isBuilt = false;
  private isRunning = false;
  private inputData: InputData;
  private outputData: OutputData;

  constructor(canvas: HTMLCanvasElement, inputData: InputData, outputData: OutputData) {
    this.canvas = canvas;
    this.inputData = inputData;
    this.outputData = outputData;
  }

  async buildSubstance(): Promise<void> {
    try {
      console.log('Build substance called with input data:', this.inputData);
      // Simple 1 second delay to simulate build process
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.isBuilt = true;
    } catch (error) {
      console.error('Error building substance:', error);
      throw error;
    }
  }

  destroySubstance(): void {
    console.log('Destroy substance called');
    this.isBuilt = false;
    this.isRunning = false;
  }

  toggleSimulation(): void {
    if (!this.isBuilt) return;
    
    if (!this.isRunning) {
      // Start simulation
      console.log('Start simulation called with input data:', this.inputData);
      this.isRunning = true;
    } else {
      // Stop simulation
      console.log('Stop simulation called');
      // Generate simple mock output data
      this.outputData = this.generateMockOutput();
      this.isRunning = false;
    }
  }

  private generateMockOutput(): OutputData {
    // Create a simple mock output with random values
    return {
      basic: {
        temperature: { sample: Math.random() * 100, average: Math.random() * 100 },
        pressure: { sample: Math.random() * 10, average: Math.random() * 10 },
        volume: { sample: this.inputData.RunDynamicsData.initialVolume, average: this.inputData.RunDynamicsData.initialVolume },
      },
      energy: {
        total: { sample: Math.random() * 1000, average: Math.random() * 1000 },
        kinetic: { sample: Math.random() * 500, average: Math.random() * 500 },
        potential: { sample: Math.random() * 500, average: Math.random() * 500 },
      },
    };
  }

  getOutput(): OutputData {
    return this.outputData;
  }

  isSubstanceBuilt(): boolean {
    return this.isBuilt;
  }

  isSimulationRunning(): boolean {
    return this.isRunning;
  }
}