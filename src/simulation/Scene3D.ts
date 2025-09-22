import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SimpleMD } from "./SimpleMD";
import { rotateOpx, InputData, OutputData } from "../types/types";

interface TimeData {
  currentTime: number;
  totalTime: number;
  runTime: number;
  totalRuntime: number;
}

export class Scene3D {
  // Three.js objects
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private atoms: THREE.Mesh[] = [];
  private container: THREE.LineSegments;
  
  // Physics engine
  private md: SimpleMD;
  
  // Simulation state
  private inputData: InputData;
  private isRunning: boolean = false;
  private currentStep: number = 0;
  private simulationTime: number = 0; // ps
  private realStartTime: number = 0;
  private realTotalTime: number = 0;
  
  // Animation
  private animationFrameId: number | null = null;
  private simulationIntervalId: number | null = null;
  
  // Energy tracking for conservation monitoring (Turner's approach)
  private initialEnergy: number = 0;
  private energyHistory: number[] = [];
  private temperatureHistory: number[] = [];
  private pressureHistory: number[] = [];
  
  // Callbacks
  private onOutputUpdate?: (data: OutputData) => void;
  public onTimeUpdate?: (timeData: TimeData) => void;
  private onSimulationComplete: (() => void) | null = null;
  
  // Constants
  private static readonly CANVAS_WIDTH = 450;
  private static readonly CANVAS_HEIGHT = 450;
  
  constructor(
    canvas: HTMLCanvasElement,
    inputData: InputData,
    onOutputUpdate?: (data: OutputData) => void
  ) {
    this.inputData = inputData;
    this.onOutputUpdate = onOutputUpdate;
    
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = null;
    
    this.camera = new THREE.PerspectiveCamera(
      75,
      Scene3D.CANVAS_WIDTH / Scene3D.CANVAS_HEIGHT,
      0.1,
      1000
    );
    this.camera.position.set(30, 30, 30);
    this.camera.lookAt(0, 0, 0);
    
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    
    this.renderer.setClearAlpha(0);
    this.renderer.setSize(Scene3D.CANVAS_WIDTH, Scene3D.CANVAS_HEIGHT, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    // Create container visualization
    this.container = this.createContainer();
    this.scene.add(this.container);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(5, 5, 5);
    this.scene.add(ambientLight);
    this.scene.add(pointLight);
    
    // Initialize physics engine
    this.md = new SimpleMD(inputData.ModelSetupData.atomType);
    
    // Start animation loop
    this.animate();
  }
  
  private createContainer(): THREE.LineSegments {
    // Convert volume to box size (cube root)
    const volume = this.inputData.RunDynamicsData.initialVolume;
    const boxSizeNm = Math.pow(volume, 1/3) * 2.5; // Scale factor
    const boxSizeThreeJs = boxSizeNm * 5; // Visual scaling for Three.js
    
    const boxGeometry = new THREE.BoxGeometry(
      boxSizeThreeJs, boxSizeThreeJs, boxSizeThreeJs
    );
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const linesMaterial = new THREE.LineBasicMaterial({
      color: 0x9e9e9e,
      transparent: true,
      opacity: 0.7,
    });
    
    return new THREE.LineSegments(edges, linesMaterial);
  }
  
  // Add atoms to the scene (called from outside)
  addAtom(atomType: string, atomicMass: number): void {
    // Create visual representation
    const atomRadius = this.getAtomRadius(atomType);
    const geometry = new THREE.SphereGeometry(atomRadius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: this.getAtomColor(atomType),
      specular: 0x444444,
      shininess: 30,
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    
    // Position will be set by physics engine
    sphere.position.set(0, 0, 0);
    
    this.atoms.push(sphere);
    this.scene.add(sphere);
  }
  
  // Start the simulation
  startRun(): void {
    console.log("Starting MD simulation with SimpleMD engine...");
    
    this.isRunning = true;
    this.currentStep = 0;
    this.simulationTime = 0;
    this.realStartTime = performance.now();
    
    // Clear history arrays
    this.energyHistory = [];
    this.temperatureHistory = [];
    this.pressureHistory = [];
    
    // Initialize physics with current input data
    const numAtoms = this.inputData.ModelSetupData.numAtoms;
    const volume = this.inputData.RunDynamicsData.initialVolume;
    const temperature = this.inputData.RunDynamicsData.initialTemperature;
    
    // Convert volume to box size
    const boxSizeNm = Math.pow(volume, 1/3) * 2.5;
    
    this.md.initializeSystem(numAtoms, boxSizeNm, temperature);
    
    // Record initial energy for conservation monitoring (Turner's approach)
    const initialState = this.md.getState();
    this.initialEnergy = initialState.totalEnergy;
    console.log(`Initial total energy: ${this.initialEnergy.toFixed(3)}`);
    
    // Start simulation loop
    this.simulationIntervalId = window.setInterval(() => {
      this.simulationStep();
    }, 16); // ~60 FPS
  }
  
  // Stop the simulation
  stopRun(): OutputData {
    console.log("Stopping MD simulation...");
    
    this.isRunning = false;
    
    if (this.simulationIntervalId !== null) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
    }
    
    this.realTotalTime += (performance.now() - this.realStartTime) / 1000;
    
    // Report energy conservation (Turner's monitoring approach)
    if (this.energyHistory.length > 0) {
      const finalEnergy = this.energyHistory[this.energyHistory.length - 1];
      const energyDrift = Math.abs(finalEnergy - this.initialEnergy) / Math.abs(this.initialEnergy);
      console.log(`Energy drift: ${(energyDrift * 100).toFixed(3)}%`);
      
      if (energyDrift > 0.01) {
        console.warn("Warning: Energy conservation > 1% - check timestep");
      }
    }
    
    // Call completion callback if simulation completed naturally
    if (this.currentStep >= this.inputData.RunDynamicsData.stepCount && this.onSimulationComplete) {
      this.onSimulationComplete();
      this.onSimulationComplete = null;
    }
    
    // Return final output data
    return this.calculateOutputData();
  }
  
  // Single simulation step
  private simulationStep(): void {
    if (!this.isRunning) return;
    
    // Check if simulation should complete
    const maxSteps = this.inputData.RunDynamicsData.stepCount;
    if (this.currentStep >= maxSteps) {
      this.stopRun();
      return;
    }
    
    // Run MD physics (Turner recommends 1 fs timesteps)
    this.md.calculateForces();
    this.md.integrate(this.inputData.RunDynamicsData.timeStep);
    
    // Apply simple velocity rescaling thermostat if needed (optional)
    if (this.inputData.RunDynamicsData.simulationType === "ConstVT" && 
        this.currentStep % 50 === 0) {
      this.applySimpleThermostat();
    }
    
    // Update visualization
    this.updateAtomPositions();
    
    // Update simulation state
    this.currentStep++;
    this.simulationTime += this.inputData.RunDynamicsData.timeStep / 1000; // Convert fs to ps
    
    // Record data for averaging
    const state = this.md.getState();
    this.energyHistory.push(state.totalEnergy);
    this.temperatureHistory.push(state.temperature);
    
    // Update output data periodically
    if (this.currentStep % this.inputData.RunDynamicsData.interval === 0) {
      const outputData = this.calculateOutputData();
      if (this.onOutputUpdate) {
        this.onOutputUpdate(outputData);
      }
    }
    
    // Update time data
    this.updateTimeData();
    
    // Log progress occasionally
    if (this.currentStep % 100 === 0) {
      console.log(`Step ${this.currentStep}: T=${state.temperature.toFixed(1)}K, E_drift=${
        (Math.abs(state.totalEnergy - this.initialEnergy) / Math.abs(this.initialEnergy) * 100).toFixed(3)}%`);
    }
  }
  
  // Apply simple velocity rescaling thermostat
  private applySimpleThermostat(): void {
    const targetTemp = this.inputData.RunDynamicsData.initialTemperature;
    const state = this.md.getState();
    const currentTemp = state.temperature;
    
    if (currentTemp > 0) {
      // Berendsen-style velocity rescaling
      const tau = 100; // Relaxation time in timesteps
      const scaleFactor = Math.sqrt(1 + (1/tau) * (targetTemp/currentTemp - 1));
      
      // Limit scaling to prevent instability
      const limitedScale = Math.max(0.9, Math.min(1.1, scaleFactor));
      
      this.md.scaleVelocities(limitedScale);
    }
  }
  
  // Update atom positions from physics to visualization
  private updateAtomPositions(): void {
    const state = this.md.getState();
    
    for (let i = 0; i < this.atoms.length; i++) {
      if (i < state.positions.length) {
        const physicsPos = state.positions[i];
        
        // Convert from physics units (Å) to Three.js units
        const visualScale = 0.5; // Scale down for better visualization
        this.atoms[i].position.set(
          physicsPos.x * visualScale,
          physicsPos.y * visualScale,
          physicsPos.z * visualScale
        );
      }
    }
  }
  
  // Calculate output data from physics
  private calculateOutputData(): OutputData {
    const state = this.md.getState();
    
    // Convert energies to J/mol (rough conversion for display)
    const energyScale = 1000; // Arbitrary scale for display
    const kineticEnergy = state.kineticEnergy * energyScale;
    const potentialEnergy = state.potentialEnergy * energyScale;
    const totalEnergy = kineticEnergy + potentialEnergy;
    
    // Volume (from input data, could be dynamic in NPT)
    const volume = this.inputData.RunDynamicsData.initialVolume;
    
    // Simple pressure calculation (ideal gas approximation)
    const pressure = (state.numAtoms * state.temperature * 0.082) / volume; // Rough ideal gas
    
    // Calculate averages
    const tempAvg = this.calculateAverage(this.temperatureHistory);
    const energyAvg = this.calculateAverage(this.energyHistory) * energyScale;
    
    return {
      basic: {
        temperature: { sample: state.temperature, average: tempAvg },
        pressure: { sample: pressure, average: pressure },
        volume: { sample: volume, average: volume },
      },
      energy: {
        kinetic: { sample: kineticEnergy, average: kineticEnergy },
        potential: { sample: potentialEnergy, average: potentialEnergy },
        total: { sample: totalEnergy, average: energyAvg },
      },
    };
  }
  
  // Calculate average of array
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  // Update time data for UI
  private updateTimeData(): void {
    const currentRunTime = (performance.now() - this.realStartTime) / 1000;
    const totalTime = (this.inputData.RunDynamicsData.timeStep / 1000) * 
                      this.inputData.RunDynamicsData.stepCount;
    
    const timeData: TimeData = {
      currentTime: this.simulationTime,
      totalTime: totalTime,
      runTime: currentRunTime,
      totalRuntime: this.realTotalTime + currentRunTime,
    };
    
    if (this.onTimeUpdate) {
      this.onTimeUpdate(timeData);
    }
  }
  
  // Animation loop (just for rendering)
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
  
  // Get atom color
  private getAtomColor(atomType: string): number {
    const colors: Record<string, number> = {
      He: 0x00ffff, // Cyan
      Ne: 0xff00ff, // Magenta
      Ar: 0xff0000, // Red
      Kr: 0x00ff00, // Green
      Xe: 0x0000ff, // Blue
      User: 0xffffff, // White
    };
    return colors[atomType] || 0xffffff;
  }
  
  // Get atom radius for visualization
  private getAtomRadius(atomType: string): number {
    const radii: Record<string, number> = {
      He: 0.5,
      Ne: 0.8,
      Ar: 1.0,
      Kr: 1.2,
      Xe: 1.4,
      User: 1.0,
    };
    return radii[atomType] || 1.0;
  }
  
  // Methods required by SimulationContext
  
  public rotate: boolean = false;
  
  rotateSubstance(rotateOpx: rotateOpx): void {
    const rotationAmount = 0.1;
    const sign = rotateOpx.sign === "-" ? -1 : 1;
    
    // Rotate container
    this.container.rotation[rotateOpx.rotationAxis] += rotationAmount * sign;
    
    // Rotate all atoms around center
    const rotationMatrix = new THREE.Matrix4();
    if (rotateOpx.rotationAxis === "x") {
      rotationMatrix.makeRotationX(rotationAmount * sign);
    } else if (rotateOpx.rotationAxis === "y") {
      rotationMatrix.makeRotationY(rotationAmount * sign);
    } else {
      rotationMatrix.makeRotationZ(rotationAmount * sign);
    }
    
    for (const atom of this.atoms) {
      atom.position.applyMatrix4(rotationMatrix);
    }
  }
  
  zoomCamera(zoomIn: boolean): void {
    const zoom = zoomIn ? 0.9 : 1.1;
    this.camera.position.multiplyScalar(zoom);
    this.camera.updateProjectionMatrix();
  }
  
  updateInputData(newInputData: InputData): void {
    this.inputData = newInputData;
  }
  
  setOnSimulationComplete(callback: (() => void) | null): void {
    this.onSimulationComplete = callback;
  }
  
  clearCompletionCallback(): void {
    this.onSimulationComplete = null;
  }
  
  getContainerVolume(): number {
    return this.inputData.RunDynamicsData.initialVolume;
  }
  
  getAtomCount(): number {
    return this.atoms.length;
  }
  
  // Cleanup
  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.simulationIntervalId !== null) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
    }
    
    // Remove atoms
    this.atoms.forEach(atom => this.scene.remove(atom));
    this.atoms = [];
    
    // Clean up scene
    this.scene.remove(this.container);
    this.scene.clear();
    
    // Clean up renderer
    this.renderer.clear();
    this.renderer.dispose();
  }
}