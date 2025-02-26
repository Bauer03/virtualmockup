import { InputData, OutputData } from '../types/types';
import { Scene3D } from './Scene3D';

export class SimulationManager {
  private scene: Scene3D | null = null;
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
      this.scene = new Scene3D(this.canvas, this.inputData);
      
      const numAtoms = this.inputData.ModelSetupData.numAtoms;
      const atomType = this.inputData.ModelSetupData.atomType;
      const atomicMass = this.inputData.ModelSetupData.atomicMass;
      
      for (let i = 0; i < numAtoms; i++) {
        this.scene.addAtom(atomType, atomicMass);
      }
      
      this.isBuilt = true;
    } catch (error) {
      console.error('Error building substance:', error);
      throw error;
    }
  }

  destroySubstance(): void {
    if (this.scene) {
      this.scene.rotate = false;
      this.scene.dispose();
      this.scene = null;
    }
    this.isBuilt = false;
    this.isRunning = false;
  }

  toggleSimulation(): void {
    if (!this.scene || !this.isBuilt) return;
    
    if (!this.isRunning) {
      // Start simulation
      this.scene.startRun();
      this.scene.rotate = true;
      this.isRunning = true;
    } else {
      // Stop simulation
      this.scene.rotate = false;
      const output = this.scene.stopRun();
      if (output) {
        this.outputData = output;
      }
      this.isRunning = false;
    }
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