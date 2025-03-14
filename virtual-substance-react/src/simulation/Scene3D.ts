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

// Constants for simulation accuracy
const KB = 1.380649e-23; // Boltzmann constant (J/K)
const NA = 6.02214076e23; // Avogadro's number
const R = 8.314462618; // Gas constant (J/mol·K)

export class Scene3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private atoms: THREE.Mesh[] = [];
  private atomVelocities: THREE.Vector3[] = [];
  private atomForces: THREE.Vector3[] = []; // Array to store forces for velocity Verlet
  private atomOldForces: THREE.Vector3[] = []; // Previous forces for velocity Verlet
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

    // Initialize forces arrays for velocity Verlet
    this.atomForces = Array(this.atoms.length).fill(null).map(() => new THREE.Vector3());
    this.atomOldForces = Array(this.atoms.length).fill(null).map(() => new THREE.Vector3());

    // Calculate initial forces
    this.calculateForces();

    // Start the simulation loop with continuous animation
    this._simulationIntervalID = window.setInterval(() => {
      this.simulationStep();
    }, Math.max(10, this.inputData.RunDynamicsData.interval * 100)); // Use minimum 10ms for smoother animation
  }

  private initializeVelocities() {
    this.atomVelocities = [];

    // Initialize velocities based on temperature using Maxwell-Boltzmann distribution
    const temperature = this.inputData.RunDynamicsData.initialTemperature;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;

    // Calculate proper velocity scale based on the equipartition theorem
    // Each degree of freedom contributes kB*T/2 energy
    const kB = 1.380649e-23; // Boltzmann constant (J/K)
    const velocityScale = Math.sqrt(3 * kB * temperature / atomicMass) * 0.2;

    for (let i = 0; i < this.atoms.length; i++) {
      // Generate random velocities using Box-Muller transform for proper Gaussian distribution
      let vx = 0, vy = 0, vz = 0;
      
      // Box-Muller for x-component
      const u1 = Math.random(), u2 = Math.random();
      vx = velocityScale * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      
      // Box-Muller for y-component
      const u3 = Math.random(), u4 = Math.random();
      vy = velocityScale * Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
      
      // Box-Muller for z-component
      const u5 = Math.random(), u6 = Math.random();
      vz = velocityScale * Math.sqrt(-2 * Math.log(u5)) * Math.cos(2 * Math.PI * u6);

      this.atomVelocities.push(new THREE.Vector3(vx, vy, vz));
    }

    // Remove center-of-mass motion to prevent drift
    this.removeCenterOfMassMotion();
  }

  // Remove center-of-mass motion to conserve momentum
  private removeCenterOfMassMotion() {
    if (this.atomVelocities.length === 0) return;

    // Calculate the center-of-mass velocity
    const comVelocity = new THREE.Vector3();
    for (const velocity of this.atomVelocities) {
      comVelocity.add(velocity);
    }
    comVelocity.divideScalar(this.atomVelocities.length);

    // Subtract the COM velocity from each atom's velocity
    for (const velocity of this.atomVelocities) {
      velocity.sub(comVelocity);
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

    // Advance simulation by performing multiple small steps for better accuracy
    for (let subStep = 0; subStep < 10; subStep++) {
      this.updateAtomPositionsVerlet(dt);
      this.handleCollisions();
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

  // Velocity Verlet integration for better energy conservation
  private updateAtomPositionsVerlet(dt: number) {
    // First half of velocity Verlet integration
    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      const velocity = this.atomVelocities[i];
      const force = this.atomForces[i];
      
      // Save current forces for second half of the update
      this.atomOldForces[i].copy(force);
      
      // Update position: r(t+dt) = r(t) + v(t)*dt + (1/2)*a(t)*dt^2
      atom.position.x += velocity.x * dt + 0.5 * force.x * dt * dt;
      atom.position.y += velocity.y * dt + 0.5 * force.y * dt * dt;
      atom.position.z += velocity.z * dt + 0.5 * force.z * dt * dt;
      
      // First half of velocity update: v(t+dt/2) = v(t) + (1/2)*a(t)*dt
      velocity.x += 0.5 * force.x * dt;
      velocity.y += 0.5 * force.y * dt;
      velocity.z += 0.5 * force.z * dt;
    }
    
    // Calculate new forces at the updated positions
    this.calculateForces();
    
    // Second half of velocity Verlet integration
    for (let i = 0; i < this.atoms.length; i++) {
      const velocity = this.atomVelocities[i];
      const newForce = this.atomForces[i];
      
      // Second half of velocity update: v(t+dt) = v(t+dt/2) + (1/2)*a(t+dt)*dt
      velocity.x += 0.5 * newForce.x * dt;
      velocity.y += 0.5 * newForce.y * dt;
      velocity.z += 0.5 * newForce.z * dt;
    }
  }

  private handleCollisions() {
    const boundaryType = this.inputData.ModelSetupData.boundary;

    if (boundaryType === "Fixed Walls") {
      this.handleFixedWallCollisions();
    } else if (boundaryType === "Periodic") {
      this.handlePeriodicBoundaries();
    }

    // Handle atom-atom collisions based on potential model
    this.handleAtomAtomCollisions();
  }

  private handleFixedWallCollisions() {
    const damping = 0.98; // Less energy loss for more movement

    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      const velocity = this.atomVelocities[i];

      // X boundaries with momentum conservation
      if (Math.abs(atom.position.x) > this.containerSize) {
        velocity.x *= -damping;
        atom.position.x = Math.sign(atom.position.x) * this.containerSize * 0.99;
      }

      // Y boundaries with momentum conservation
      if (Math.abs(atom.position.y) > this.containerSize) {
        velocity.y *= -damping;
        atom.position.y = Math.sign(atom.position.y) * this.containerSize * 0.99;
      }

      // Z boundaries with momentum conservation
      if (Math.abs(atom.position.z) > this.containerSize) {
        velocity.z *= -damping;
        atom.position.z = Math.sign(atom.position.z) * this.containerSize * 0.99;
      }
    }
  }

  private handlePeriodicBoundaries() {
    const boxSize = this.containerSize * 2;

    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];

      // Apply minimum image convention for periodic boundaries
      // When an atom crosses one boundary, it reappears on the opposite side
      
      // X-direction
      if (atom.position.x > this.containerSize) {
        atom.position.x -= boxSize;
      } else if (atom.position.x < -this.containerSize) {
        atom.position.x += boxSize;
      }

      // Y-direction
      if (atom.position.y > this.containerSize) {
        atom.position.y -= boxSize;
      } else if (atom.position.y < -this.containerSize) {
        atom.position.y += boxSize;
      }

      // Z-direction
      if (atom.position.z > this.containerSize) {
        atom.position.z -= boxSize;
      } else if (atom.position.z < -this.containerSize) {
        atom.position.z += boxSize;
      }
    }
  }

  private handleAtomAtomCollisions() {
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    const atomType = this.inputData.ModelSetupData.atomType;
    
    // Get atom radius based on atom type using Lennard-Jones sigma parameter
    const atomRadius = this.getAtomRadius(atomType);
    const collisionDistance = atomRadius * 2;

    if (potentialModel === "NoPotential") {
      // For 'NoPotential', handle collisions using elastic collision physics
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const distanceVector = this.getMinimumDistance(
            this.atoms[i].position,
            this.atoms[j].position
          );

          const distance = distanceVector.length();

          if (distance < collisionDistance) {
            // Elastic collision with momentum and energy conservation
            const normal = distanceVector.normalize();

            // Calculate relative velocity
            const relativeVelocity = new THREE.Vector3().subVectors(
              this.atomVelocities[i],
              this.atomVelocities[j]
            );

            // Calculate impulse scalar (assuming equal masses)
            const impulse = -relativeVelocity.dot(normal);

            // Apply impulse
            this.atomVelocities[i].add(normal.clone().multiplyScalar(impulse * 0.5));
            this.atomVelocities[j].add(normal.clone().multiplyScalar(-impulse * 0.5));

            // Prevent overlap
            const correction = (collisionDistance - distance) / 2;
            this.atoms[i].position.add(normal.clone().multiplyScalar(correction));
            this.atoms[j].position.add(normal.clone().multiplyScalar(-correction));
          }
        }
      }
    } else {
      // For Lennard-Jones and SoftSphere, prevent extreme overlaps
      // The continuous potential forces will handle normal interactions
      const minDistance = collisionDistance * 0.5;
      
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const distanceVector = this.getMinimumDistance(
            this.atoms[i].position,
            this.atoms[j].position
          );

          const distance = distanceVector.length();

          // Only correct extreme overlaps (atoms too close to each other)
          if (distance < minDistance) {
            const normal = distanceVector.normalize();
            const correction = (minDistance - distance) / 2;
            this.atoms[i].position.add(normal.clone().multiplyScalar(correction));
            this.atoms[j].position.add(normal.clone().multiplyScalar(-correction));
          }
        }
      }
    }
  }

  // Get minimum image distance vector for periodic boundaries
  private getMinimumDistance(pos1: THREE.Vector3, pos2: THREE.Vector3): THREE.Vector3 {
    const distVector = new THREE.Vector3().subVectors(pos1, pos2);
    
    // Apply minimum image convention for periodic boundaries
    if (this.inputData.ModelSetupData.boundary === "Periodic") {
      const boxSize = this.containerSize * 2;
      
      // X component
      if (distVector.x > this.containerSize) distVector.x -= boxSize;
      else if (distVector.x < -this.containerSize) distVector.x += boxSize;
      
      // Y component
      if (distVector.y > this.containerSize) distVector.y -= boxSize;
      else if (distVector.y < -this.containerSize) distVector.y += boxSize;
      
      // Z component
      if (distVector.z > this.containerSize) distVector.z -= boxSize;
      else if (distVector.z < -this.containerSize) distVector.z += boxSize;
    }
    
    return distVector;
  }

  private calculateForces() {
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    
    // Reset forces for all atoms
    for (let i = 0; i < this.atomForces.length; i++) {
      this.atomForces[i].set(0, 0, 0);
    }
    
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
    
    // Apply forces based on potential model
    if (potentialModel === 'LennardJones' || potentialModel === 'SoftSphere') {
      // Force scaling factor calibrated for stability and accurate physics
      const baseScalingFactor = potentialModel === 'LennardJones' ? 0.01 : 0.005;
      const adaptiveScaling = baseScalingFactor / Math.max(0.1, epsilon);
      
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const distanceVector = this.getMinimumDistance(
            this.atoms[i].position, 
            this.atoms[j].position
          );
          
          const distance = distanceVector.length();
          let force = 0;
          
          // Skip extreme close contacts to avoid numerical instabilities
          if (distance < 0.1 * sigma) continue;
          
          if (potentialModel === 'LennardJones') {
            // Lennard-Jones force: F = 24ε [ 2(σ/r)¹² - (σ/r)⁶ ] / r
            if (distance > 0) {
              const sr6 = Math.pow(sigma / distance, 6);
              const sr12 = sr6 * sr6;
              force = 24 * epsilon * (2 * sr12 - sr6) / distance;
            }
          } else if (potentialModel === 'SoftSphere') {
            // Soft sphere: F = 12ε(σ/r)¹² / r
            if (distance > 0) {
              const sr12 = Math.pow(sigma / distance, 12);
              force = 12 * epsilon * sr12 / distance;
            }
          }
          
          // Apply force with appropriate scaling - using normalized direction vector
          if (force !== 0) {
            const forceVector = distanceVector.normalize().multiplyScalar(force * adaptiveScaling);
            
            // Apply equal and opposite forces (Newton's third law)
            this.atomForces[i].add(forceVector);
            this.atomForces[j].sub(forceVector);
          }
        }
      }
    }
    
    // Apply temperature control if using constant temperature simulation
    if (this.inputData.RunDynamicsData.simulationType === 'ConstVT') {
      this.applyThermostat();
    }
  }

  // Apply Berendsen thermostat for better temperature control
  private applyThermostat() {
    const targetTemp = this.inputData.RunDynamicsData.initialTemperature;
    const currentTemp = this.calculateTemperature() * 100 + 273.15; // Convert to real temperature scale
    
    if (currentTemp > 0) {
      // Berendsen thermostat with relaxation parameter
      const relaxationTime = 100; // time steps
      const timeStep = this.inputData.RunDynamicsData.timeStep;
      
      // Calculate scaling factor
      const lambda = Math.sqrt(1 + (timeStep / relaxationTime) * ((targetTemp / currentTemp) - 1));
      
      // Apply velocity scaling to all atoms
      for (let i = 0; i < this.atomVelocities.length; i++) {
        this.atomVelocities[i].multiplyScalar(lambda);
      }
    }
  }

  private calculateTemperature(): number {
    // Calculate temperature using equipartition theorem: 3/2 NkT = KE
    let kineticEnergy = 0;

    for (const velocity of this.atomVelocities) {
      kineticEnergy += velocity.lengthSq();
    }

    // Scale by Boltzmann constant and atomic mass
    const atomicMass = this.inputData.ModelSetupData.atomicMass;
    const atomCount = this.atoms.length;

    if (atomCount === 0) return 0;

    // Temperature = 2/3 * KE / (k_B * N)
    // Degrees of freedom = 3N - constraints (typically 3 for center of mass motion)
    const degreesOfFreedom = Math.max(1, 3 * atomCount - 3);
    return (kineticEnergy * atomicMass) / degreesOfFreedom;
  }

  private calculateOutput() {
    // Calculate current values with accurate physics
    const temperature = this.calculateTemperature();
    const scaledTemp = temperature * 100 + 273.15; // Scale to real temperature range

    // Calculate volume (in L/mol)
    const volume = this.calculateVolume();

    // Calculate pressure using virial theorem
    const pressure = this.calculatePressure();

    // Calculate energies
    const kineticEnergy = this.calculateKineticEnergy();
    const potentialEnergy = this.calculatePotentialEnergy();
    const totalEnergy = kineticEnergy + potentialEnergy;

    // Store current values for statistical averaging
    this.temperatureHistory.push(scaledTemp);
    this.pressureHistory.push(pressure);
    this.volumeHistory.push(volume);
    this.totalEnergyHistory.push(totalEnergy);
    this.kineticEnergyHistory.push(kineticEnergy);
    this.potentialEnergyHistory.push(potentialEnergy);

    // Calculate averages with proper time-averaging
    const tempAvg = this.calculateAverage(this.temperatureHistory);
    const pressureAvg = this.calculateAverage(this.pressureHistory);
    const volumeAvg = this.calculateAverage(this.volumeHistory);
    const totalEnergyAvg = this.calculateAverage(this.totalEnergyHistory);
    const kineticEnergyAvg = this.calculateAverage(this.kineticEnergyHistory);
    const potentialEnergyAvg = this.calculateAverage(this.potentialEnergyHistory);

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

  // Calculate pressure using the virial equation
  private calculatePressure(): number {
    const volume = this.calculateVolume();
    const temperature = this.calculateTemperature() * 100 + 273.15; // Convert to real temperature scale
    const atomCount = this.atoms.length;
    
    if (atomCount === 0 || volume === 0) return 0;
    
    // Ideal gas contribution: nRT/V
    const idealPressure = (atomCount * R * temperature) / (NA * volume);
    
    // Calculate virial contribution for real gas behavior
    let virial = 0;
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    
    if (potentialModel !== 'NoPotential') {
      const atomType = this.inputData.ModelSetupData.atomType;
      let sigma = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS].sigma;
      let epsilon = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS].epsilon;
      
      if (this.inputData.ModelSetupData.potentialParams) {
        sigma = this.inputData.ModelSetupData.potentialParams.sigma || sigma;
        epsilon = this.inputData.ModelSetupData.potentialParams.epsilon || epsilon;
      }
      
      // Calculate virial term: sum(r·F) for all pairs
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const distVector = this.getMinimumDistance(
            this.atoms[i].position,
            this.atoms[j].position
          );
          
          const distance = distVector.length();
          
          // Skip if atoms are too close
          if (distance < 0.1 * sigma) continue;
          
          let force = 0;
          
          if (potentialModel === 'LennardJones') {
            const sr6 = Math.pow(sigma / distance, 6);
            const sr12 = sr6 * sr6;
            force = 24 * epsilon * (2 * sr12 - sr6) / distance;
          } else if (potentialModel === 'SoftSphere') {
            const sr12 = Math.pow(sigma / distance, 12);
            force = 12 * epsilon * sr12 / distance;
          }
          
          // Add r·F contribution to virial
          virial += distance * force;
        }
      }
      
      // Scale virial term appropriately
      virial *= 0.001; // Convert to appropriate units
    }
    
    // Apply virial correction to pressure
    const virialCorrection = virial / (3 * volume);
    const pressure = (idealPressure - virialCorrection) * 0.987; // Convert to atm
    
    return pressure;
  }

  private calculateKineticEnergy(): number {
    // Calculate kinetic energy: KE = 1/2 * m * v²
    let energy = 0;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;

    for (const velocity of this.atomVelocities) {
      energy += 0.5 * atomicMass * velocity.lengthSq();
    }

    // Scale to reasonable values for display (J/mol)
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
        const distVector = this.getMinimumDistance(
          this.atoms[i].position,
          this.atoms[j].position
        );
        
        const distance = distVector.length();
        
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

  // Calculate volume in L/mol (this is constant in NVT ensemble)
  private calculateVolume(): number {
    return this.inputData.RunDynamicsData.initialVolume;
  }

  // Get atom radius based on atom type and Lennard-Jones sigma parameter
  private getAtomRadius(atomType: string): number {
    // The hard-sphere radius is related to the Lennard-Jones sigma parameter
    // by a conversion factor (approximately 0.5612 * sigma / 2)
    const sigmaToRadiusFactor = 0.5 * 0.5612;
    const sigma = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS].sigma;
    return sigma * sigmaToRadiusFactor;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    
    // Using proper statistical averaging
    const n = values.length;
    
    // For small samples, simple mean is reasonable
    if (n < 10) {
      return values.reduce((sum, value) => sum + value, 0) / n;
    }
    
    // For larger samples, use weighted averaging with more weight on recent values
    // to better represent equilibrium properties
    const halfLife = Math.floor(n / 2);
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < n; i++) {
      // Recent values get higher weights
      const weight = i < halfLife ? 0.5 : 1.0;
      weightedSum += values[i] * weight;
      weightSum += weight;
    }
    
    return weightedSum / weightSum;
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
    let atomRadius = this.getAtomRadius(atomType);

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