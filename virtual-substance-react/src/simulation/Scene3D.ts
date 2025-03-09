import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { rotateOpx, InputData, OutputData } from "../types/types";

interface TimeData {
  currentTime: number;
  totalTime: number;
  runTime: number;
  totalRuntime: number;
}

// Define realistic Lennard-Jones parameters for each atom type
const LJ_PARAMS = {
  He: { sigma: 2.56, epsilon: 0.084 },
  Ne: { sigma: 2.75, epsilon: 0.31 },
  Ar: { sigma: 3.4, epsilon: 1.0 },
  Kr: { sigma: 3.65, epsilon: 1.42 },
  Xe: { sigma: 3.98, epsilon: 1.77 },
  User: { sigma: 3.4, epsilon: 1.0 }, // Default to Argon values
};

export class Scene3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private atoms: THREE.Mesh[] = [];
  private atomVelocities: THREE.Vector3[] = [];
  private container: THREE.LineSegments;
  public rotate = false;
  private inputData: InputData;
  private outputData: OutputData = {
    basic: {
      temperature: { sample: 0, average: 0 },
      pressure: { sample: 0, average: 0 },
      volume: { sample: 0, average: 0 },
    },
    energy: {
      total: { sample: 0, average: 0 },
      kinetic: { sample: 0, average: 0 },
      potential: { sample: 0, average: 0 },
    },
  };
  private runInProgress = false;
  private containerVolume: number = 0;

  private deltaScale = 1;
  private lastTime = 0;
  private _animationFrameId: number | null = null;
  private _simulationIntervalID: number | null = null;
  private _notificationTimeoutID: number | null = null;

  // Simulation timing variables
  private currentTimeStep = 0;
  private simulationTime = 0;
  private realStartTime = 0;
  private realTotalTime = 0;
  private simulationCompleted = false;

  // For calculating averages
  private temperatureHistory: number[] = [];
  private pressureHistory: number[] = [];
  private volumeHistory: number[] = [];
  private totalEnergyHistory: number[] = [];
  private kineticEnergyHistory: number[] = [];
  private potentialEnergyHistory: number[] = [];

  // Boundaries of the container
  private containerSize = 5; // Half-width of the container

  private static readonly CANVAS_WIDTH = 400;
  private static readonly CANVAS_HEIGHT = 400;

  private controls: OrbitControls;
  private onOutputUpdate?: (data: OutputData) => void;

  // Callback for time data updates
  public onTimeUpdate?: (timeData: TimeData) => void;

  constructor(canvas: HTMLCanvasElement, inputData: InputData, onOutputUpdate?: (data: OutputData) => void) {
    this.inputData = inputData;
    this.scene = new THREE.Scene();

    // Set up camera for a wider view
    this.camera = new THREE.PerspectiveCamera(
      75,
      Scene3D.CANVAS_WIDTH / Scene3D.CANVAS_HEIGHT,
      0.1,
      1000
    );
    this.camera.position.z = 15; // Moved back to see more atoms

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });

    this.scene.background = null;
    this.renderer.setClearAlpha(0);

    // Set size with false to prevent changes to canvas style
    this.renderer.setSize(Scene3D.CANVAS_WIDTH, Scene3D.CANVAS_HEIGHT, false);
    // Cap pixel ratio at 2 to prevent performance issues on high-DPI displays
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Create container based on volume
    this.updateContainerSize();
    const boxGeometry = new THREE.BoxGeometry(
      this.containerSize * 2,
      this.containerSize * 2,
      this.containerSize * 2
    );
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const linesMaterial = new THREE.LineBasicMaterial({
      color: 0x9E9E9E, // Medium grey that works in both themes
      transparent: true,
      opacity: 0.7,
    });
    this.container = new THREE.LineSegments(edges, linesMaterial);
    this.scene.add(this.container);

    // lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(5, 5, 5);
    this.scene.add(ambientLight);
    this.scene.add(pointLight);

    // initial render
    this.renderer.render(this.scene, this.camera);

    this.animate();
    this.initializeOutputData();

    this.onOutputUpdate = onOutputUpdate;
  }

  private updateContainerSize() {
    // Calculate container size based on volume
    // For a simple scaling, we'll use the cube root of volume
    const volume = this.inputData.RunDynamicsData.initialVolume;
    // Store the volume for reference
    this.containerVolume = volume;
    // Scale factor to convert L/mol to our arbitrary units
    const scaleFactor = 2.5;
    this.containerSize = Math.pow(volume, 1 / 3) * scaleFactor;
  }

  // Method to get container volume for the SimulationContext
  getContainerVolume(): number {
    return this.containerVolume;
  }

  // Method to get atom count for the SimulationContext
  getAtomCount(): number {
    return this.atoms.length;
  }

  private animate = () => {
    this._animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();

    // Always update the time display while the simulation is running
    if (this.runInProgress) {
      this.updateTimeData();
    }

    this.renderer.render(this.scene, this.camera);

    const now = performance.now();
    const delta = now - this.lastTime;
    this.deltaScale = delta / (1000 / 60);
    this.lastTime = now;
  };

  private updateTimeData() {
    const currentRunTime = (performance.now() - this.realStartTime) / 1000;
    
    const timeData: TimeData = {
      currentTime: this.simulationTime,
      totalTime: this.inputData.RunDynamicsData.timeStep * this.inputData.RunDynamicsData.stepCount,
      runTime: currentRunTime,
      totalRuntime: this.realTotalTime + currentRunTime
    };

    // Notify about time data update
    if (this.onTimeUpdate) {
      this.onTimeUpdate(timeData);
    }
  }

  // Create a notification for simulation completion
  private showCompletionNotification() {
    // First check if a notification already exists and remove it
    this.removeCompletionNotification();

    // Create a notification element
    const notification = document.createElement("div");
    notification.id = "simulation-complete-notification";
    notification.className =
      "fixed top-6 right-6 bg-white dark:bg-gray-800 border-l-4 border-green-400 dark:border-green-600 text-gray-700 dark:text-gray-200 px-4 py-3 rounded shadow-lg";
    notification.style.transition = "opacity 0.5s ease-in-out";

    notification.innerHTML = `
      <div class="flex items-center">
        <span class="material-icons mr-2 text-green-500 dark:text-green-400">check_circle</span>
        <span><strong>Simulation Complete</strong> - ${this.inputData.RunDynamicsData.stepCount} steps finished</span>
        <button class="ml-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <span class="material-icons text-sm">close</span>
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Add event listener to close button
    const closeButton = notification.querySelector("button");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        this.removeCompletionNotification();
      });
    }

    // Automatically remove after 5 seconds
    this._notificationTimeoutID = window.setTimeout(() => {
      this.removeCompletionNotification();
    }, 5000);
  }

  private removeCompletionNotification() {
    const existingNotification = document.getElementById(
      "simulation-complete-notification"
    );
    if (existingNotification) {
      existingNotification.remove();
    }

    if (this._notificationTimeoutID !== null) {
      clearTimeout(this._notificationTimeoutID);
      this._notificationTimeoutID = null;
    }
  }

  private initializeOutputData(): void {
    this.outputData = {
      basic: {
        temperature: { sample: 0, average: 0 },
        pressure: { sample: 0, average: 0 },
        volume: { sample: 0, average: 0 },
      },
      energy: {
        total: { sample: 0, average: 0 },
        kinetic: { sample: 0, average: 0 },
        potential: { sample: 0, average: 0 },
      },
    };

    // Reset history arrays
    this.temperatureHistory = [];
    this.pressureHistory = [];
    this.volumeHistory = [];
    this.totalEnergyHistory = [];
    this.kineticEnergyHistory = [];
    this.potentialEnergyHistory = [];

    // Reset simulation completion flag
    this.simulationCompleted = false;
  }

  startRun(): void {
    this.runInProgress = true;
    this.currentTimeStep = 0;
    this.simulationTime = 0;
    this.realStartTime = performance.now();
    this.initializeOutputData();

    // Remove any existing completion notification when starting a new run
    this.removeCompletionNotification();

    // Initialize velocities if they don't exist
    if (this.atomVelocities.length !== this.atoms.length) {
      this.initializeVelocities();
    }

    // Start the simulation loop with continuous animation
    this._simulationIntervalID = window.setInterval(() => {
      this.simulationStep();
    }, Math.max(10, this.inputData.RunDynamicsData.interval * 100)); // Use minimum 10ms for smoother animation
  }

  private initializeVelocities() {
    this.atomVelocities = [];

    // Initialize velocities based on temperature (Maxwell-Boltzmann distribution)
    const temperature = this.inputData.RunDynamicsData.initialTemperature;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;

    // Scale factor for velocity based on temperature and mass
    // This is a simplified version of the Maxwell-Boltzmann distribution
    const velocityScale = Math.sqrt(temperature / atomicMass) * 0.2; // Increased scale for visible movement

    for (let i = 0; i < this.atoms.length; i++) {
      // Create random velocity components using Box-Muller transform
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);

      const vx = velocityScale * Math.sin(phi) * Math.cos(theta);
      const vy = velocityScale * Math.sin(phi) * Math.sin(theta);
      const vz = velocityScale * Math.cos(phi);

      this.atomVelocities.push(new THREE.Vector3(vx, vy, vz));
    }
  }

  private simulationStep() {
    if (!this.runInProgress) return;

    // Check if we've reached the maximum number of steps
    if (this.currentTimeStep >= this.inputData.RunDynamicsData.stepCount) {
      this.simulationCompleted = true;
      this.stopRun();
      return;
    }

    const timeStep = this.inputData.RunDynamicsData.timeStep;
    const dt = timeStep * 0.1; // Small time step for stability

    // Advance simulation by performing multiple small steps
    for (let subStep = 0; subStep < 10; subStep++) {
      this.updateAtomPositions(dt);
      this.handleCollisions();
      this.calculateForces();
    }

    // Update simulation time and step counter
    this.simulationTime += timeStep;
    this.currentTimeStep++;

    // Calculate and update output data
    this.calculateOutput();
    
    // Update time data
    this.updateTimeData();
    
    // Force render to ensure visual updates
    this.renderer.render(this.scene, this.camera);
  }

  private updateAtomPositions(dt: number) {
    // Update positions based on velocities
    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      const velocity = this.atomVelocities[i];

      // Update position - scale dt if movement is very slow
      atom.position.x += velocity.x * dt * 10;
      atom.position.y += velocity.y * dt * 10;
      atom.position.z += velocity.z * dt * 10;
    }
  }

  private handleCollisions() {
    const boundaryType = this.inputData.ModelSetupData.boundary;

    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      const velocity = this.atomVelocities[i];

      if (boundaryType === "Fixed Walls") {
        // Wall collisions with elastic reflection
        const damping = 0.98; // Less energy loss for more movement

        if (Math.abs(atom.position.x) > this.containerSize) {
          velocity.x *= -damping;
          atom.position.x = Math.sign(atom.position.x) * this.containerSize * 0.99;
        }

        if (Math.abs(atom.position.y) > this.containerSize) {
          velocity.y *= -damping;
          atom.position.y = Math.sign(atom.position.y) * this.containerSize * 0.99;
        }

        if (Math.abs(atom.position.z) > this.containerSize) {
          velocity.z *= -damping;
          atom.position.z = Math.sign(atom.position.z) * this.containerSize * 0.99;
        }
      } else if (boundaryType === "Periodic") {
        // Proper periodic boundary conditions
        // When an atom crosses one boundary, it reappears on the opposite side
        const size = this.containerSize * 2;

        // X-direction
        if (atom.position.x > this.containerSize) {
          atom.position.x -= size;
        } else if (atom.position.x < -this.containerSize) {
          atom.position.x += size;
        }

        // Y-direction
        if (atom.position.y > this.containerSize) {
          atom.position.y -= size;
        } else if (atom.position.y < -this.containerSize) {
          atom.position.y += size;
        }

        // Z-direction
        if (atom.position.z > this.containerSize) {
          atom.position.z -= size;
        } else if (atom.position.z < -this.containerSize) {
          atom.position.z += size;
        }
      }
    }

    // Get atom radius based on atom type for accurate collision detection
    const atomType = this.inputData.ModelSetupData.atomType;
    let atomRadius = 0.3; // Default

    // Adjust radius based on atom type
    if (atomType === "He") {
      atomRadius = 0.25;
    } else if (atomType === "Ne") {
      atomRadius = 0.28;
    } else if (atomType === "Ar") {
      atomRadius = 0.32;
    } else if (atomType === "Kr") {
      atomRadius = 0.35;
    } else if (atomType === "Xe") {
      atomRadius = 0.38;
    }

    const collisionDistance = atomRadius * 2;

    // Handle atom-atom collisions differently based on potential model
    const potentialModel = this.inputData.ModelSetupData.potentialModel;

    if (potentialModel === "NoPotential") {
      // For 'NoPotential', we need to handle collisions explicitly with elastic collisions
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const distanceVector = new THREE.Vector3().subVectors(
            this.atoms[i].position,
            this.atoms[j].position
          );

          const distance = distanceVector.length();

          if (distance < collisionDistance) {
            // Elastic collision
            const normal = distanceVector.normalize();

            // Calculate relative velocity
            const relativeVelocity = new THREE.Vector3().subVectors(
              this.atomVelocities[i],
              this.atomVelocities[j]
            );

            // Calculate impulse
            const impulse = (-2 * relativeVelocity.dot(normal)) / 2;

            // Apply impulse
            this.atomVelocities[i].add(normal.clone().multiplyScalar(impulse));
            this.atomVelocities[j].add(normal.clone().multiplyScalar(-impulse));

            // Prevent overlap
            const correction = (collisionDistance - distance) / 2;
            this.atoms[i].position.add(
              normal.clone().multiplyScalar(correction)
            );
            this.atoms[j].position.add(
              normal.clone().multiplyScalar(-correction)
            );
          }
        }
      }
    } else {
      // For Lennard-Jones and SoftSphere, we only need to prevent extreme overlaps
      // as the forces will naturally handle most collisions
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const distanceVector = new THREE.Vector3().subVectors(
            this.atoms[i].position,
            this.atoms[j].position
          );

          const distance = distanceVector.length();

          // Only correct extreme overlaps (atoms too close to each other)
          const minDistance = collisionDistance * 0.5;
          if (distance < minDistance) {
            const normal = distanceVector.normalize();
            const correction = (minDistance - distance) / 2;
            this.atoms[i].position.add(
              normal.clone().multiplyScalar(correction)
            );
            this.atoms[j].position.add(
              normal.clone().multiplyScalar(-correction)
            );
          }
        }
      }
    }
  }

  private calculateForces() {
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    
    // Skip if no potential model
    if (potentialModel === 'NoPotential') {
      // Even with no potential, we need some minimum energy to keep atoms moving
      for (let i = 0; i < this.atomVelocities.length; i++) {
        const velocity = this.atomVelocities[i];
        // Add a small random jitter to prevent atoms from stopping completely
        if (velocity.lengthSq() < 0.00001) {
          velocity.x += (Math.random() - 0.5) * 0.001;
          velocity.y += (Math.random() - 0.5) * 0.001;
          velocity.z += (Math.random() - 0.5) * 0.001;
        }
      }
      return;
    }
    
    // Get parameters from input data
    const atomType = this.inputData.ModelSetupData.atomType;
    
    // Choose default parameters based on the potential model
    let defaultParams;
    if (potentialModel === 'LennardJones') {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    } else if (potentialModel === 'SoftSphere') {
      // Soft Sphere typically uses the same sigma but different epsilon values
      const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      defaultParams = {
        sigma: ljParams.sigma,
        epsilon: ljParams.epsilon * 0.5 // Typically half the LJ epsilon for soft sphere
      };
    } else {
      // Fallback to LJ parameters
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    }
    
    // Use input parameters if available, otherwise use defaults
    const sigma = this.inputData.ModelSetupData.potentialParams?.sigma || defaultParams.sigma;
    const epsilon = this.inputData.ModelSetupData.potentialParams?.epsilon || defaultParams.epsilon;
    
    // Apply temperature scaling if using constant temperature simulation
    if (this.inputData.RunDynamicsData.simulationType === 'ConstVT') {
      const targetTemp = this.inputData.RunDynamicsData.initialTemperature;
      const currentTemp = this.calculateTemperature();
      
      if (currentTemp > 0) {
        // Scale velocities to maintain temperature
        const scaleFactor = Math.sqrt(targetTemp / currentTemp);
        
        for (let i = 0; i < this.atomVelocities.length; i++) {
          this.atomVelocities[i].multiplyScalar(scaleFactor);
        }
      }
    }
    
    // Apply forces based on potential model
    if (potentialModel === 'LennardJones' || potentialModel === 'SoftSphere') {
      // Adjust force calculation scaling factor based on model type and epsilon
      // Soft Sphere models need weaker scaling factors to avoid extreme accelerations
      const baseScalingFactor = potentialModel === 'LennardJones' ? 0.01 : 0.005; // Increased for more movement
      const adaptiveScaling = baseScalingFactor / Math.max(0.1, epsilon);
      
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const distanceVector = new THREE.Vector3().subVectors(
            this.atoms[i].position, 
            this.atoms[j].position
          );
          
          const distance = distanceVector.length();
          let force = 0;
          
          // Skip extreme close contacts to avoid numerical instabilities
          if (distance < 0.1 * sigma) continue;
          
          if (potentialModel === 'LennardJones') {
            // Lennard-Jones force: F = 24ε [ 2(σ/r)^12 - (σ/r)^6 ] / r
            if (distance > 0) {
              const sr6 = Math.pow(sigma / distance, 6);
              const sr12 = sr6 * sr6;
              force = 24 * epsilon * (2 * sr12 - sr6) / distance;
            }
          } else if (potentialModel === 'SoftSphere') {
            // Soft sphere: F = 12ε(σ/r)^12 / r
            if (distance > 0) {
              const sr12 = Math.pow(sigma / distance, 12);
              force = 12 * epsilon * sr12 / distance;
            }
          }
          
          // Apply force with appropriate scaling
          const forceVector = distanceVector.normalize().multiplyScalar(force * adaptiveScaling);
          
          this.atomVelocities[i].add(forceVector);
          this.atomVelocities[j].sub(forceVector);
        }
      }
    }
  }

  private calculateTemperature(): number {
    // Calculate kinetic energy
    let kineticEnergy = 0;

    for (const velocity of this.atomVelocities) {
      kineticEnergy += velocity.lengthSq();
    }

    // Scale by Boltzmann constant and atomic mass
    const atomicMass = this.inputData.ModelSetupData.atomicMass;
    const atomCount = this.atoms.length;

    if (atomCount === 0) return 0;

    // Temperature = 2/3 * KE / (k_B * N) - simplified scaling
    return (kineticEnergy * atomicMass) / (3 * atomCount);
  }

  private calculateOutput() {
    // Calculate current values
    const temperature = this.calculateTemperature();

    // Scale to realistic ranges
    const scaledTemp = temperature * 100 + 273.15;

    // Calculate volume (in L/mol)
    const volume = this.inputData.RunDynamicsData.initialVolume;

    // Calculate pressure using ideal gas law PV = nRT
    // P = nRT/V; n=1 (mol), R~8.314
    const R = 8.314;
    const pressure = (R * scaledTemp) / volume;

    // Calculate energies
    const kineticEnergy = this.calculateKineticEnergy();
    const potentialEnergy = this.calculatePotentialEnergy();
    const totalEnergy = kineticEnergy + potentialEnergy;

    // Store current values
    this.temperatureHistory.push(scaledTemp);
    this.pressureHistory.push(pressure);
    this.volumeHistory.push(volume);
    this.totalEnergyHistory.push(totalEnergy);
    this.kineticEnergyHistory.push(kineticEnergy);
    this.potentialEnergyHistory.push(potentialEnergy);

    // Calculate averages
    const tempAvg = this.calculateAverage(this.temperatureHistory);
    const pressureAvg = this.calculateAverage(this.pressureHistory);
    const volumeAvg = this.calculateAverage(this.volumeHistory);
    const totalEnergyAvg = this.calculateAverage(this.totalEnergyHistory);
    const kineticEnergyAvg = this.calculateAverage(this.kineticEnergyHistory);
    const potentialEnergyAvg = this.calculateAverage(
      this.potentialEnergyHistory
    );

    // Update output data
    this.outputData.basic.temperature.sample = scaledTemp;
    this.outputData.basic.temperature.average = tempAvg;
    this.outputData.basic.pressure.sample = pressure;
    this.outputData.basic.pressure.average = pressureAvg;
    this.outputData.basic.volume.sample = volume;
    this.outputData.basic.volume.average = volumeAvg;

    this.outputData.energy.kinetic.sample = kineticEnergy;
    this.outputData.energy.kinetic.average = kineticEnergyAvg;
    this.outputData.energy.potential.sample = potentialEnergy;
    this.outputData.energy.potential.average = potentialEnergyAvg;
    this.outputData.energy.total.sample = totalEnergy;
    this.outputData.energy.total.average = totalEnergyAvg;

    // Notify about output data update
    if (this.onOutputUpdate) {
      this.onOutputUpdate(this.outputData);
    }
  }

  private calculateKineticEnergy(): number {
    let energy = 0;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;

    for (const velocity of this.atomVelocities) {
      energy += 0.5 * atomicMass * velocity.lengthSq();
    }

    // Scale to reasonable values
    return energy * 1000;
  }

  private calculatePotentialEnergy(): number {
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    
    if (potentialModel === 'NoPotential') {
      return 0;
    }
    
    // Get parameters from input data
    const atomType = this.inputData.ModelSetupData.atomType;
    
    // Choose default parameters based on the potential model
    let defaultParams;
    if (potentialModel === 'LennardJones') {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    } else if (potentialModel === 'SoftSphere') {
      // Soft Sphere typically uses the same sigma but different epsilon values
      const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      defaultParams = {
        sigma: ljParams.sigma,
        epsilon: ljParams.epsilon * 0.5 // Typically half the LJ epsilon for soft sphere
      };
    } else {
      // Fallback to LJ parameters
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    }
    
    // Use input parameters if available, otherwise use defaults
    const sigma = this.inputData.ModelSetupData.potentialParams?.sigma || defaultParams.sigma;
    const epsilon = this.inputData.ModelSetupData.potentialParams?.epsilon || defaultParams.epsilon;
    
    let energy = 0;
    
    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const distance = new THREE.Vector3()
          .subVectors(this.atoms[i].position, this.atoms[j].position)
          .length();
        
        // Skip extreme close contacts
        if (distance < 0.1 * sigma) continue;
        
        if (distance > 0) {
          if (potentialModel === 'LennardJones') {
            // Lennard-Jones potential: 4ε[(σ/r)^12 - (σ/r)^6]
            const sr6 = Math.pow(sigma / distance, 6);
            const sr12 = sr6 * sr6;
            energy += 4 * epsilon * (sr12 - sr6);
          } else if (potentialModel === 'SoftSphere') {
            // Soft sphere: ε(σ/r)^12
            const sr12 = Math.pow(sigma / distance, 12);
            energy += epsilon * sr12;
          }
        }
      }
    }
    
    // Scale energy appropriately based on potential model
    const energyScale = potentialModel === 'LennardJones' ? 1000 : 500;
    return energy * energyScale;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private updateOutputUI() {
    // Update temperature
    const tempSample = document.getElementById("temperature-sample");
    const tempAvg = document.getElementById("temperature-average");
    if (tempSample)
      tempSample.textContent =
        this.outputData.basic.temperature.sample.toFixed(2);
    if (tempAvg)
      tempAvg.textContent =
        this.outputData.basic.temperature.average.toFixed(2);

    // Update pressure
    const pressureSample = document.getElementById("pressure-sample");
    const pressureAvg = document.getElementById("pressure-average");
    if (pressureSample)
      pressureSample.textContent =
        this.outputData.basic.pressure.sample.toFixed(2);
    if (pressureAvg)
      pressureAvg.textContent =
        this.outputData.basic.pressure.average.toFixed(2);

    // Update volume
    const volumeSample = document.getElementById("volume-sample");
    const volumeAvg = document.getElementById("volume-average");
    if (volumeSample)
      volumeSample.textContent = this.outputData.basic.volume.sample.toFixed(2);
    if (volumeAvg)
      volumeAvg.textContent = this.outputData.basic.volume.average.toFixed(2);

    // Update energy
    const totalEnergySample = document.getElementById("total-energy-sample");
    const totalEnergyAvg = document.getElementById("total-energy-average");
    if (totalEnergySample)
      totalEnergySample.textContent =
        this.outputData.energy.total.sample.toFixed(2);
    if (totalEnergyAvg)
      totalEnergyAvg.textContent =
        this.outputData.energy.total.average.toFixed(2);

    const kineticEnergySample = document.getElementById(
      "kinetic-energy-sample"
    );
    const kineticEnergyAvg = document.getElementById("kinetic-energy-average");
    if (kineticEnergySample)
      kineticEnergySample.textContent =
        this.outputData.energy.kinetic.sample.toFixed(2);
    if (kineticEnergyAvg)
      kineticEnergyAvg.textContent =
        this.outputData.energy.kinetic.average.toFixed(2);

    const potentialEnergySample = document.getElementById(
      "potential-energy-sample"
    );
    const potentialEnergyAvg = document.getElementById(
      "potential-energy-average"
    );
    if (potentialEnergySample)
      potentialEnergySample.textContent =
        this.outputData.energy.potential.sample.toFixed(2);
    if (potentialEnergyAvg)
      potentialEnergyAvg.textContent =
        this.outputData.energy.potential.average.toFixed(2);
  }

  stopRun(): OutputData {
    this.runInProgress = false;

    // Clear the simulation interval
    if (this._simulationIntervalID !== null) {
      clearInterval(this._simulationIntervalID);
      this._simulationIntervalID = null;
    }

    // Update total real time
    this.realTotalTime += (performance.now() - this.realStartTime) / 1000;

    // Update time data one last time
    this.updateTimeData();

    // Show completion notification if simulation completed naturally
    if (this.simulationCompleted) {
      this.showCompletionNotification();
    }

    return this.outputData;
  }

  addAtom(atomType: string, atomicMass: number): void {
    // Scale atom size based on the atom type - larger atoms have larger radii
    let atomRadius = 0.3; // Default size

    // Approximate relative sizes based on atomic radii
    if (atomType === "He") {
      atomRadius = 0.25;
    } else if (atomType === "Ne") {
      atomRadius = 0.28;
    } else if (atomType === "Ar") {
      atomRadius = 0.32;
    } else if (atomType === "Kr") {
      atomRadius = 0.35;
    } else if (atomType === "Xe") {
      atomRadius = 0.38;
    }

    const geometry = new THREE.SphereGeometry(atomRadius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: this.getAtomColor(atomType),
      specular: 0x444444,
      shininess: 30,
    });

    const sphere = new THREE.Mesh(geometry, material);

    // Position within the container boundaries
    sphere.position.x = (Math.random() - 0.5) * (this.containerSize * 2 * 0.8);
    sphere.position.y = (Math.random() - 0.5) * (this.containerSize * 2 * 0.8);
    sphere.position.z = (Math.random() - 0.5) * (this.containerSize * 2 * 0.8);

    this.atoms.push(sphere);
    this.scene.add(sphere);
  }

  private getAtomColor(atomType: string): number {
    // Color scheme for different atoms - using lighter colors that work well in both themes
    const colors: Record<string, number> = {
      He: 0xE1BEE7, // Light Purple
      Ne: 0xFFCCBC, // Light Coral
      Ar: 0xB3E5FC, // Light Blue
      Kr: 0xC8E6C9, // Light Green
      Xe: 0xFFE0B2, // Light Orange
      User: 0xCFD8DC, // Light Blue Grey
    };
    return colors[atomType] || 0xCFD8DC;
  }

  dispose(): void {
    // Remove any notifications
    this.removeCompletionNotification();

    // Clear any running intervals
    if (this._animationFrameId != null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    if (this._simulationIntervalID !== null) {
      clearInterval(this._simulationIntervalID);
      this._simulationIntervalID = null;
    }

    // Remove atoms from scene
    this.atoms.forEach((atom) => this.scene.remove(atom));
    this.atoms = [];
    this.atomVelocities = [];

    // Clean up scene
    this.scene.remove(this.container);
    this.scene.clear();
    
    // Reset camera position and controls
    this.camera.position.set(0, 0, 15);
    this.camera.lookAt(0, 0, 0);
    this.controls.reset();
    
    // Clear the WebGL buffer and reset background
    this.renderer.clear();
    this.scene.background = null;
    this.renderer.setClearAlpha(0);
    
    // Force a final render to ensure the canvas is cleared
    this.renderer.render(this.scene, this.camera);
    
    // Dispose of WebGL resources
    this.renderer.dispose();
  }

  rotateSubstance(rotateOpx: rotateOpx): void {
    const rotationAmount = 0.1;
    const sign = rotateOpx.sign === "-" ? -1 : 1;

    this.container.rotation[rotateOpx.rotationAxis] += rotationAmount * sign;

    // Rotate all atoms around the center
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

    this.renderer.render(this.scene, this.camera);
  }

  zoomCamera(zoomIn: boolean): void {
    const zoom = zoomIn ? 0.9 : 1.1;
    this.camera.position.z *= zoom;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
}