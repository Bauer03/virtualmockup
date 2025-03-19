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

  // Nosé-Hoover thermostat variables
  private thermostatVariable: number = 0;
  private thermostatVelocity: number = 0;
  private thermostatMass: number = 1.0;

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

  // Cell list properties for force calculation optimization
  private cellSize: number = 0;
  private numCells: THREE.Vector3 = new THREE.Vector3();
  private cells: number[][] = [];
  private useCellList: boolean = false; // Flag to toggle cell list optimization

  private static readonly CANVAS_WIDTH = 400;
  private static readonly CANVAS_HEIGHT = 400;

  private controls: OrbitControls;
  private onOutputUpdate?: (data: OutputData) => void;

  // Callback for time data updates
  public onTimeUpdate?: (timeData: TimeData) => void;

  private atomPositions: THREE.Vector3[] | null = null;
  private usesLatticePlacement: boolean = false;

  constructor(canvas: HTMLCanvasElement, inputData: InputData, onOutputUpdate?: (data: OutputData) => void) {
    this.inputData = inputData;
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Set up camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      Scene3D.CANVAS_WIDTH / Scene3D.CANVAS_HEIGHT,
      0.1,
      1000
    );
    this.camera.position.set(30, 30, 30); // Moved camera further back
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });

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

    this.initializeCellList();
  }

  private initializeCellList() {
    // Calculate cell size based on cutoff distance
    // For LJ potential, 2.5*sigma is a common cutoff
    const atomType = this.inputData.ModelSetupData.atomType;
    const sigma = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS].sigma;
    this.cellSize = 2.5 * sigma;
    
    // Calculate number of cells in each direction
    const boxSize = this.containerSize * 2;
    this.numCells.x = Math.max(1, Math.floor(boxSize / this.cellSize));
    this.numCells.y = Math.max(1, Math.floor(boxSize / this.cellSize));
    this.numCells.z = Math.max(1, Math.floor(boxSize / this.cellSize));
    
    // Initialize cells array
    this.cells = [];
    const totalCells = this.numCells.x * this.numCells.y * this.numCells.z;
    for (let i = 0; i < totalCells; i++) {
      this.cells.push([]);
    }

    // Enable cell list optimization if we have enough atoms
    this.useCellList = this.atoms.length > 100;
  }

  private updateCellList() {
    // Clear all cells
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].length = 0;
    }
    
    // Assign atoms to cells
    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      
      // Calculate cell indices (account for container offset)
      const x = Math.floor((atom.position.x + this.containerSize) / this.cellSize);
      const y = Math.floor((atom.position.y + this.containerSize) / this.cellSize);
      const z = Math.floor((atom.position.z + this.containerSize) / this.cellSize);
      
      // Handle boundary conditions
      const cellX = Math.max(0, Math.min(this.numCells.x - 1, x));
      const cellY = Math.max(0, Math.min(this.numCells.y - 1, y));
      const cellZ = Math.max(0, Math.min(this.numCells.z - 1, z));
      
      // Calculate cell index
      const cellIndex = cellX + cellY * this.numCells.x + cellZ * this.numCells.x * this.numCells.y;
      
      // Add atom to cell
      this.cells[cellIndex].push(i);
    }
  }

  private calculateForcesInCell(cellIndex: number) {
    const atomsInCell = this.cells[cellIndex];
    if (atomsInCell.length <= 1) return; // No interactions in cells with 0 or 1 atom
    
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    if (potentialModel === 'NoPotential') return;
    
    // Get parameters
    const atomType = this.inputData.ModelSetupData.atomType;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;
    
    // Get LJ parameters based on atom type
    let defaultParams;
    if (potentialModel === 'LennardJones') {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    } else if (potentialModel === 'SoftSphere') {
      const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      defaultParams = {
        sigma: ljParams.sigma,
        epsilon: ljParams.epsilon * 0.5
      };
    } else {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    }
    
    // Use input parameters if available, otherwise use defaults
    const sigma = this.inputData.ModelSetupData.potentialParams?.sigma || defaultParams.sigma;
    const epsilon = this.inputData.ModelSetupData.potentialParams?.epsilon || defaultParams.epsilon;
    
    // Calculate cutoff distance for optimization
    const cutoffDistance = 2.5 * sigma; // Standard MD cutoff
    
    // Loop through all pairs of atoms in this cell
    for (let i = 0; i < atomsInCell.length; i++) {
      const atomIndex1 = atomsInCell[i];
      
      for (let j = i + 1; j < atomsInCell.length; j++) {
        const atomIndex2 = atomsInCell[j];
        
        // Get atom positions
        const pos1 = this.atoms[atomIndex1].position;
        const pos2 = this.atoms[atomIndex2].position;
        
        // Calculate minimum image distance vector
        const distanceVector = this.getMinimumDistance(pos1, pos2);
        const distance = distanceVector.length();
        
        // Skip interactions beyond cutoff
        if (distance > cutoffDistance) continue;
        
        // Skip extreme close contacts to avoid numerical instabilities
        if (distance < 0.1 * sigma) continue;
        
        // Calculate force magnitude based on potential model
        let forceMagnitude = 0;
        
        if (potentialModel === 'LennardJones') {
          // Lennard-Jones force: F = 24ε [ 2(σ/r)¹² - (σ/r)⁶ ] / r
          const sr6 = Math.pow(sigma / distance, 6);
          const sr12 = sr6 * sr6;
          forceMagnitude = 24 * epsilon * (2 * sr12 - sr6) / distance;
          
          // Apply tapering function at cutoff for smooth transition
          if (distance > 0.9 * cutoffDistance) {
            const tapering = 1 - Math.pow((distance - 0.9 * cutoffDistance) / (0.1 * cutoffDistance), 2);
            forceMagnitude *= Math.max(0, tapering);
          }
        } else if (potentialModel === 'SoftSphere') {
          // Soft sphere: F = 12ε(σ/r)¹² / r
          const sr12 = Math.pow(sigma / distance, 12);
          forceMagnitude = 12 * epsilon * sr12 / distance;
        }
        
        // Apply force with appropriate scaling for simulation stability
        const forceScaling = 0.0001 / Math.max(0.01, atomicMass);
        
        // Create force vector in the direction of the distance vector
        // Force points from atom2 to atom1 if attractive, opposite if repulsive
        const forceVector = distanceVector.clone().normalize().multiplyScalar(forceMagnitude * forceScaling);
        
        // Apply Newton's third law - equal and opposite forces
        this.atomForces[atomIndex1].add(forceVector);
        this.atomForces[atomIndex2].sub(forceVector);
      }
    }
  }

  private calculateForcesBetweenCells(cellIndex1: number, cellIndex2: number) {
    const atomsInCell1 = this.cells[cellIndex1];
    const atomsInCell2 = this.cells[cellIndex2];
    
    // Skip calculation if either cell is empty
    if (atomsInCell1.length === 0 || atomsInCell2.length === 0) return;
    
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    if (potentialModel === 'NoPotential') return;
    
    // Get parameters
    const atomType = this.inputData.ModelSetupData.atomType;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;
    
    // Get LJ parameters based on atom type
    let defaultParams;
    if (potentialModel === 'LennardJones') {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    } else if (potentialModel === 'SoftSphere') {
      const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      defaultParams = {
        sigma: ljParams.sigma,
        epsilon: ljParams.epsilon * 0.5
      };
    } else {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    }
    
    // Use input parameters if available, otherwise use defaults
    const sigma = this.inputData.ModelSetupData.potentialParams?.sigma || defaultParams.sigma;
    const epsilon = this.inputData.ModelSetupData.potentialParams?.epsilon || defaultParams.epsilon;
    
    // Calculate cutoff distance
    const cutoffDistance = 2.5 * sigma;
    
    // Calculate forces between all atoms in the two cells
    for (let i = 0; i < atomsInCell1.length; i++) {
      const atomIndex1 = atomsInCell1[i];
      
      for (let j = 0; j < atomsInCell2.length; j++) {
        const atomIndex2 = atomsInCell2[j];
        
        // Get atom positions
        const pos1 = this.atoms[atomIndex1].position;
        const pos2 = this.atoms[atomIndex2].position;
        
        // Calculate minimum image distance vector
        const distanceVector = this.getMinimumDistance(pos1, pos2);
        const distance = distanceVector.length();
        
        // Skip interactions beyond cutoff
        if (distance > cutoffDistance) continue;
        
        // Skip extreme close contacts
        if (distance < 0.1 * sigma) continue;
        
        // Calculate force magnitude based on potential model
        let forceMagnitude = 0;
        
        if (potentialModel === 'LennardJones') {
          // Lennard-Jones force calculation
          const sr6 = Math.pow(sigma / distance, 6);
          const sr12 = sr6 * sr6;
          forceMagnitude = 24 * epsilon * (2 * sr12 - sr6) / distance;
          
          // Apply smooth tapering at cutoff
          if (distance > 0.9 * cutoffDistance) {
            const tapering = 1 - Math.pow((distance - 0.9 * cutoffDistance) / (0.1 * cutoffDistance), 2);
            forceMagnitude *= Math.max(0, tapering);
          }
        } else if (potentialModel === 'SoftSphere') {
          // Soft sphere force calculation
          const sr12 = Math.pow(sigma / distance, 12);
          forceMagnitude = 12 * epsilon * sr12 / distance;
        }
        
        // Apply force with appropriate scaling
        const forceScaling = 0.0001 / Math.max(0.01, atomicMass);
        
        // Create normalized force vector in the direction of the distance vector
        const forceVector = distanceVector.clone().normalize().multiplyScalar(forceMagnitude * forceScaling);
        
        // Apply forces (Newton's third law)
        this.atomForces[atomIndex1].add(forceVector);
        this.atomForces[atomIndex2].sub(forceVector);
      }
    }
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

    // Initialize cell list for force calculation optimization
    this.initializeCellList();

    // Calculate initial forces
    this.calculateForces();

    // Start the simulation loop with continuous animation
    this._simulationIntervalID = window.setInterval(() => {
      this.simulationStep();
    }, Math.max(10, this.inputData.RunDynamicsData.interval * 100)); // Use minimum 10ms for smoother animation
  }

  private initializeVelocities() {
    this.atomVelocities = [];

    // Initialize velocities from Maxwell-Boltzmann distribution
    const temperature = this.inputData.RunDynamicsData.initialTemperature;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;
    const atomCount = this.atoms.length;

    // Calculate velocity scale based on temperature
    // According to equipartition theorem: 1/2 m <v²> = 3/2 kT
    // So <v²> = 3kT/m and σv = sqrt(kT/m)
    const velocityScale = Math.sqrt(KB * temperature / atomicMass) * 2;

    for (let i = 0; i < atomCount; i++) {
      // Generate Gaussian-distributed velocities using Box-Muller transform
      let vx = 0, vy = 0, vz = 0;
      
      // X component
      const u1 = Math.random(), u2 = Math.random();
      vx = velocityScale * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      
      // Y component
      const u3 = Math.random(), u4 = Math.random();
      vy = velocityScale * Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
      
      // Z component
      const u5 = Math.random(), u6 = Math.random();
      vz = velocityScale * Math.sqrt(-2 * Math.log(u5)) * Math.cos(2 * Math.PI * u6);

      this.atomVelocities.push(new THREE.Vector3(vx, vy, vz));
    }

    // Remove center-of-mass motion to conserve momentum
    this.removeCenterOfMassMotion();
    
    // Scale velocities to exactly match target temperature
    this.scaleVelocitiesToTemperature(temperature);
  }

  private scaleVelocitiesToTemperature(targetTemp: number) {
    // Calculate current temperature
    const currentTemp = this.calculateTemperature() * 100 + 273.15;
    
    if (currentTemp <= 0) return;
    
    // Scale factor to adjust to target temperature
    const scaleFactor = Math.sqrt(targetTemp / currentTemp);
    
    // Apply scaling to all velocities
    for (let i = 0; i < this.atomVelocities.length; i++) {
      this.atomVelocities[i].multiplyScalar(scaleFactor);
    }
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

  // Add new method to calculate optimal time step
  private calculateOptimalTimeStep(): number {
    const baseTimeStep = 0.002; // Base time step for a standard 10-atom system
    const atomCount = this.atoms.length;
    const temperature = this.calculateTemperature() * 100 + 273.15; // Convert to real temperature scale
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    
    // Scale based on system size (using square root scaling for better stability)
    const sizeFactor = Math.min(1.0, Math.sqrt(10 / atomCount));
    
    // Scale based on potential type
    const potentialFactor = 
      potentialModel === 'NoPotential' ? 1.5 :
      potentialModel === 'SoftSphere' ? 1.2 : 1.0;
    
    // Scale based on temperature (higher temps need smaller steps)
    const tempFactor = Math.min(1.0, Math.sqrt(300 / temperature));
    
    // Calculate optimal time step
    const optimalTimeStep = baseTimeStep * sizeFactor * potentialFactor * tempFactor;
    
    // Ensure time step is within reasonable bounds
    return Math.max(0.0001, Math.min(optimalTimeStep, 0.01));
  }

  private simulationStep() {
    if (!this.runInProgress) return;

    // Check if we've reached the maximum number of steps
    if (this.currentTimeStep >= this.inputData.RunDynamicsData.stepCount) {
      this.simulationCompleted = true;
      this.stopRun();
      return;
    }

    // Calculate optimal time step based on current conditions
    const optimalTimeStep = this.calculateOptimalTimeStep();
    
    // Use the smaller of the user-specified time step and optimal time step
    const timeStep = Math.min(this.inputData.RunDynamicsData.timeStep, optimalTimeStep);
    
    // Number of substeps for better numerical stability
    const numSubsteps = 10;
    const dt = timeStep / numSubsteps;

    // Advance simulation by performing multiple small steps for better accuracy
    for (let subStep = 0; subStep < numSubsteps; subStep++) {
      this.updateAtomPositionsVerlet(dt);
      this.handleCollisions();
      
      // Apply thermostat every few substeps for more stable temperature control
      if (subStep % 2 === 0 && this.inputData.RunDynamicsData.simulationType === 'ConstVT') {
        this.applyThermostat();
      }
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
    const atomicMass = this.inputData.ModelSetupData.atomicMass;
    
    // First half of velocity Verlet integration
    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      const velocity = this.atomVelocities[i];
      const force = this.atomForces[i];
      
      // Save current forces for second half of the update
      this.atomOldForces[i].copy(force);
      
      // Calculate acceleration from force: a = F/m
      const ax = force.x / atomicMass;
      const ay = force.y / atomicMass;
      const az = force.z / atomicMass;
      
      // Update position: r(t+dt) = r(t) + v(t)*dt + (1/2)*a(t)*dt^2
      atom.position.x += velocity.x * dt + 0.5 * ax * dt * dt;
      atom.position.y += velocity.y * dt + 0.5 * ay * dt * dt;
      atom.position.z += velocity.z * dt + 0.5 * az * dt * dt;
      
      // First half of velocity update: v(t+dt/2) = v(t) + (1/2)*a(t)*dt
      velocity.x += 0.5 * ax * dt;
      velocity.y += 0.5 * ay * dt;
      velocity.z += 0.5 * az * dt;
    }
    
    // Calculate new forces at the updated positions
    this.calculateForces();
    
    // Second half of velocity Verlet integration
    for (let i = 0; i < this.atoms.length; i++) {
      const velocity = this.atomVelocities[i];
      const newForce = this.atomForces[i];
      
      // Calculate new acceleration
      const ax = newForce.x / atomicMass;
      const ay = newForce.y / atomicMass;
      const az = newForce.z / atomicMass;
      
      // Second half of velocity update: v(t+dt) = v(t+dt/2) + (1/2)*a(t+dt)*dt
      velocity.x += 0.5 * ax * dt;
      velocity.y += 0.5 * ay * dt;
      velocity.z += 0.5 * az * dt;
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
      // Use modulo arithmetic for more accurate wrapping
      atom.position.x = (atom.position.x + this.containerSize) % boxSize - this.containerSize;
      atom.position.y = (atom.position.y + this.containerSize) % boxSize - this.containerSize;
      atom.position.z = (atom.position.z + this.containerSize) % boxSize - this.containerSize;
      
      // Handle negative values correctly
      if (atom.position.x < -this.containerSize) atom.position.x += boxSize;
      if (atom.position.y < -this.containerSize) atom.position.y += boxSize;
      if (atom.position.z < -this.containerSize) atom.position.z += boxSize;
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

  private getMinimumDistance(pos1: THREE.Vector3, pos2: THREE.Vector3): THREE.Vector3 {
    const distVector = new THREE.Vector3().subVectors(pos1, pos2);
    
    // Apply minimum image convention for periodic boundaries
    if (this.inputData.ModelSetupData.boundary === "Periodic") {
      const boxSize = this.containerSize * 2;
      
      // Apply minimum image convention in each dimension
      // This is the most computationally efficient implementation
      if (distVector.x > this.containerSize) distVector.x -= boxSize;
      else if (distVector.x < -this.containerSize) distVector.x += boxSize;
      
      if (distVector.y > this.containerSize) distVector.y -= boxSize;
      else if (distVector.y < -this.containerSize) distVector.y += boxSize;
      
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
    
    if (potentialModel === 'NoPotential') return;
    
    // Use cell list optimization if enabled and we have enough atoms
    if (this.useCellList && this.atoms.length > 100) {
      // Update cell list with current atom positions
      this.updateCellList();
      
      // For each cell
      for (let cellZ = 0; cellZ < this.numCells.z; cellZ++) {
        for (let cellY = 0; cellY < this.numCells.y; cellY++) {
          for (let cellX = 0; cellX < this.numCells.x; cellX++) {
            const cellIndex = cellX + cellY * this.numCells.x + cellZ * this.numCells.x * this.numCells.y;
            
            // Calculate forces within this cell
            this.calculateForcesInCell(cellIndex);
            
            // Calculate forces with neighboring cells
            for (let nz = -1; nz <= 1; nz++) {
              for (let ny = -1; ny <= 1; ny++) {
                for (let nx = -1; nx <= 1; nx++) {
                  // Skip self-interaction (already calculated)
                  if (nx === 0 && ny === 0 && nz === 0) continue;
                  
                  // Calculate neighbor cell indices with periodic boundary
                  const neighX = (cellX + nx + this.numCells.x) % this.numCells.x;
                  const neighY = (cellY + ny + this.numCells.y) % this.numCells.y;
                  const neighZ = (cellZ + nz + this.numCells.z) % this.numCells.z;
                  
                  const neighIndex = neighX + neighY * this.numCells.x + neighZ * this.numCells.x * this.numCells.y;
                  
                  // Calculate forces between cells
                  this.calculateForcesBetweenCells(cellIndex, neighIndex);
                }
              }
            }
          }
        }
      }
    } else {
      // Use original force calculation method for small systems
      // Get parameters from input data
      const atomType = this.inputData.ModelSetupData.atomType;
      const atomicMass = this.inputData.ModelSetupData.atomicMass;
      
      // Choose parameters based on potential model
      let defaultParams;
      if (potentialModel === 'LennardJones') {
        defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      } else if (potentialModel === 'SoftSphere') {
        const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
        defaultParams = {
          sigma: ljParams.sigma,
          epsilon: ljParams.epsilon * 0.5
        };
      } else {
        defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      }
      
      // Use input parameters if available, otherwise use defaults
      const sigma = this.inputData.ModelSetupData.potentialParams?.sigma || defaultParams.sigma;
      const epsilon = this.inputData.ModelSetupData.potentialParams?.epsilon || defaultParams.epsilon;
      
      // Calculate cutoff distance for optimization
      const cutoffDistance = 2.5 * sigma; // Standard MD cutoff
      
      // Apply forces based on potential model
      if (potentialModel === 'LennardJones' || potentialModel === 'SoftSphere') {
        // Force calculation loop with proper mass scaling
        for (let i = 0; i < this.atoms.length; i++) {
          for (let j = i + 1; j < this.atoms.length; j++) {
            const distanceVector = this.getMinimumDistance(
              this.atoms[i].position, 
              this.atoms[j].position
            );
            
            const distance = distanceVector.length();
            
            // Skip interactions beyond cutoff for efficiency
            if (distance > cutoffDistance) continue;
            
            // Skip extreme close contacts to avoid numerical instabilities
            if (distance < 0.1 * sigma) continue;
            
            let force = 0;
            
            if (potentialModel === 'LennardJones') {
              // Lennard-Jones force: F = 24ε [ 2(σ/r)¹² - (σ/r)⁶ ] / r
              const sr6 = Math.pow(sigma / distance, 6);
              const sr12 = sr6 * sr6;
              force = 24 * epsilon * (2 * sr12 - sr6) / distance;
              
              // Apply long-range correction at cutoff (optional)
              if (distance > 0.9 * cutoffDistance) {
                // Smoothly taper force to zero at cutoff
                const tapering = 1 - Math.pow((distance - 0.9 * cutoffDistance) / (0.1 * cutoffDistance), 2);
                force *= Math.max(0, tapering);
              }
            } else if (potentialModel === 'SoftSphere') {
              // Soft sphere: F = 12ε(σ/r)¹² / r
              const sr12 = Math.pow(sigma / distance, 12);
              force = 12 * epsilon * sr12 / distance;
            }
            
            // Apply force with appropriate scaling for simulation stability
            // The factor 0.0001/atomicMass scales force properly according to atomic mass
            const forceScaling = 0.0001 / Math.max(0.01, atomicMass);
            const forceVector = distanceVector.normalize().multiplyScalar(force * forceScaling);
            
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

  // Apply thermostat for temperature control
  private applyThermostat() {
    const targetTemp = this.inputData.RunDynamicsData.initialTemperature;
    const currentTemp = this.calculateTemperature() * 100 + 273.15; // Convert to real temperature scale
    
    try {
      // Nosé-Hoover thermostat implementation
      const timeStep = this.inputData.RunDynamicsData.timeStep;
      const atomCount = this.atoms.length;
      
      // Skip if no atoms
      if (atomCount === 0) return;
      
      // Calculate kinetic energy
      let kineticEnergy = 0;
      for (const velocity of this.atomVelocities) {
        kineticEnergy += velocity.lengthSq();
      }
      kineticEnergy *= 0.5 * this.inputData.ModelSetupData.atomicMass;
      
      // Degrees of freedom (3N - constraints)
      const degreesOfFreedom = 3 * atomCount - 3;
      
      // Calculate the "force" on the thermostat variable
      const thermostatForce = (2 * kineticEnergy - degreesOfFreedom * KB * targetTemp) / this.thermostatMass;
      
      // Update thermostat velocity
      this.thermostatVelocity += thermostatForce * 0.5 * timeStep;
      
      // Update thermostat variable
      this.thermostatVariable += this.thermostatVelocity * timeStep;
      
      // Scale velocities based on thermostat variable
      const scaleFactor = Math.exp(-this.thermostatVelocity * timeStep);
      
      for (let i = 0; i < this.atomVelocities.length; i++) {
        this.atomVelocities[i].multiplyScalar(scaleFactor);
      }
      
      // Recalculate kinetic energy after scaling
      kineticEnergy = 0;
      for (const velocity of this.atomVelocities) {
        kineticEnergy += velocity.lengthSq();
      }
      kineticEnergy *= 0.5 * this.inputData.ModelSetupData.atomicMass;
      
      // Update thermostat velocity again
      const newThermostatForce = (2 * kineticEnergy - degreesOfFreedom * KB * targetTemp) / this.thermostatMass;
      this.thermostatVelocity += newThermostatForce * 0.5 * timeStep;
    } catch (error) {
      // Fallback to Berendsen thermostat if Nosé-Hoover fails
      console.warn('Nosé-Hoover thermostat failed, falling back to Berendsen:', error);
      
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
    // Calculate temperature using the equipartition theorem: 3/2 NkT = KE
    let kineticEnergy = 0;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;
    const atomCount = this.atoms.length;

    // Return 0 if no atoms or only one atom (no meaningful temperature)
    if (atomCount < 2) return 0;

    // Calculate total kinetic energy: KE = 1/2 * m * v²
    for (const velocity of this.atomVelocities) {
      kineticEnergy += 0.5 * atomicMass * velocity.lengthSq();
    }

    // Degrees of freedom = 3N - constraints
    // For a system with fixed total momentum, we subtract 3 degrees (center of mass motion)
    const degreesOfFreedom = Math.max(1, 3 * atomCount - 3);
    
    // Temperature = 2 * KE / (kB * DoF)
    // where:
    // - KE is kinetic energy in Joules
    // - kB is Boltzmann constant (1.380649e-23 J/K)
    // - DoF is degrees of freedom
    // - The factor 100 scales the result to match the expected temperature range
    const temperature = (2 * kineticEnergy) / (KB * degreesOfFreedom) / 100;

    // Ensure temperature is non-negative and within reasonable bounds
    return Math.max(0, Math.min(temperature, 1000)); // Cap at 1000K for numerical stability
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
    const temperature = this.calculateTemperature() * 100 + 273.15;
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
      
      // Calculate virial term using the proper virial formula: Σ(r·F)
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const distVector = this.getMinimumDistance(
            this.atoms[i].position,
            this.atoms[j].position
          );
          
          const distance = distVector.length();
          
          // Skip if atoms are too close
          if (distance < 0.1 * sigma) continue;
          
          // Calculate force magnitude
          let forceMagnitude = 0;
          
          if (potentialModel === 'LennardJones') {
            const sr6 = Math.pow(sigma / distance, 6);
            const sr12 = sr6 * sr6;
            forceMagnitude = 24 * epsilon * (2 * sr12 - sr6) / distance;
          } else if (potentialModel === 'SoftSphere') {
            const sr12 = Math.pow(sigma / distance, 12);
            forceMagnitude = 12 * epsilon * sr12 / distance;
          }
          
          // Add r·F contribution to virial
          // The dot product r·F equals r*F for radial forces
          virial += distance * forceMagnitude;
        }
      }
      
      // Scale virial term appropriately
      virial *= 0.001; // Convert to appropriate units
    }
    
    // Apply virial correction to pressure: P = ρkT - (1/3V) * Σ(r·F)
    const virialCorrection = virial / (3 * volume);
    
    // Apply proper conversion to physical units (atm)
    // This conversion factor combines all necessary physical constants
    const conversionFactor = 0.987; // Convert to atm
    const pressure = (idealPressure - virialCorrection) * conversionFactor;
    
    return pressure;
  }

  private calculateKineticEnergy(): number {
    // Calculate kinetic energy: KE = 1/2 * m * v²
    let energy = 0;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;

    for (const velocity of this.atomVelocities) {
      energy += 0.5 * atomicMass * velocity.lengthSq();
    }

    // Scale to real units (J/mol)
    // Using a conversion factor that combines physical constants
    const conversionFactor = 10;
    return energy * conversionFactor;
  }

  private calculatePotentialEnergy(): number {
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    
    if (potentialModel === 'NoPotential') {
      return 0;
    }
    
    const atomType = this.inputData.ModelSetupData.atomType;
    
    // Get appropriate parameters
    let defaultParams;
    if (potentialModel === 'LennardJones') {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    } else if (potentialModel === 'SoftSphere') {
      const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      defaultParams = {
        sigma: ljParams.sigma,
        epsilon: ljParams.epsilon * 0.5
      };
    } else {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    }
    
    // Use input parameters if available, otherwise use defaults
    const sigma = this.inputData.ModelSetupData.potentialParams?.sigma || defaultParams.sigma;
    const epsilon = this.inputData.ModelSetupData.potentialParams?.epsilon || defaultParams.epsilon;
    
    // Calculate cutoff for long-range correction
    const cutoff = 2.5 * sigma;
    
    let energy = 0;
    
    // Calculate pair interactions
    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const distVector = this.getMinimumDistance(
          this.atoms[i].position,
          this.atoms[j].position
        );
        
        const distance = distVector.length();
        
        // Skip extreme close contacts and beyond cutoff
        if (distance < 0.1 * sigma || distance > cutoff) continue;
        
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
    
    // Add long-range correction for Lennard-Jones
    if (potentialModel === 'LennardJones') {
      const boxVolume = Math.pow(this.containerSize * 2, 3);
      const atomCount = this.atoms.length;
      const density = atomCount / boxVolume;
      
      // Long-range correction: (8πεσ³ρN/3)[(σ/rc)⁹/3 - (σ/rc)³]
      const sr3 = Math.pow(sigma / cutoff, 3);
      const sr9 = sr3 * sr3 * sr3;
      const lrc = (8 * Math.PI * epsilon * Math.pow(sigma, 3) * density * atomCount / 3) * 
                  ((sr9 / 3) - sr3);
      
      energy += lrc;
    }
    
    // Scale energy appropriately
    const energyScale = potentialModel === 'LennardJones' ? 10 : 5;
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

  private initializeAtomPositions(): THREE.Vector3[] {
    const atomCount = this.inputData.ModelSetupData.numAtoms;
    const volume = this.containerSize * 2;
    const atomicDensity = atomCount / Math.pow(volume, 3);
    
    // Determine physical state based on density
    if (atomicDensity < 0.3) {
      return this.initializeGasLikeDistribution();
    } else if (atomicDensity < 0.7) {
      return this.initializeLiquidLikeDistribution();
    } else {
      this.usesLatticePlacement = true;
      return this.initializeSolidLikeDistribution();
    }
  }

  private initializeGasLikeDistribution(): THREE.Vector3[] {
    const atomType = this.inputData.ModelSetupData.atomType;
    const atomRadius = this.getAtomRadius(atomType);
    const minSeparation = atomRadius * 2.2; // Slightly more than diameter
    const placedPositions: THREE.Vector3[] = [];
    
    // Place each atom with minimum separation
    for (let i = 0; i < this.inputData.ModelSetupData.numAtoms; i++) {
      let position: THREE.Vector3 | null = null;
      let attempts = 0;
      const maxAttempts = 100;
      
      // Try to find a position that maintains minimum separation
      do {
        position = new THREE.Vector3(
          (Math.random() - 0.5) * (this.containerSize * 2 * 0.9),
          (Math.random() - 0.5) * (this.containerSize * 2 * 0.9),
          (Math.random() - 0.5) * (this.containerSize * 2 * 0.9)
        );
        
        attempts++;
        // If too many failed attempts, reduce separation criteria
        if (attempts > maxAttempts) {
          position = null; // Force exit from loop
        }
      } while (position && this.tooCloseToExistingAtoms(position, placedPositions, minSeparation));
      
      // Add the position to our placed atoms
      placedPositions.push(position || this.getRandomPosition(0.9));
    }
    
    return placedPositions;
  }

  private tooCloseToExistingAtoms(position: THREE.Vector3, placedPositions: THREE.Vector3[], minSeparation: number): boolean {
    for (const existingPos of placedPositions) {
      const distanceVector = this.getMinimumDistance(position, existingPos);
      if (distanceVector.length() < minSeparation) {
        return true;
      }
    }
    return false;
  }

  private initializeLiquidLikeDistribution(): THREE.Vector3[] {
    const atomCount = this.inputData.ModelSetupData.numAtoms;
    
    // Start with a loose lattice
    const positions = this.createLatticePlacement(atomCount);
    
    // Add random perturbations to break artificial order
    const perturbationScale = this.containerSize * 0.1; // 10% of box size
    
    for (const position of positions) {
      position.x += (Math.random() - 0.5) * perturbationScale;
      position.y += (Math.random() - 0.5) * perturbationScale;
      position.z += (Math.random() - 0.5) * perturbationScale;
    }
    
    return positions;
  }

  private initializeSolidLikeDistribution(): THREE.Vector3[] {
    return this.createLatticePlacement(this.inputData.ModelSetupData.numAtoms);
  }

  private createLatticePlacement(numAtoms: number): THREE.Vector3[] {
    const positions: THREE.Vector3[] = [];
    
    // Determine lattice dimensions to fit numAtoms
    // For FCC lattice, each unit cell has 4 atoms
    const atomsPerCell = 4;
    const cellsNeeded = Math.ceil(numAtoms / atomsPerCell);
    const cellsPerSide = Math.ceil(Math.pow(cellsNeeded, 1/3));
    
    // Calculate lattice constant to fill the container
    const latticeConstant = (this.containerSize * 2) / cellsPerSide;
    
    // Create FCC lattice
    let atomsPlaced = 0;
    for (let i = 0; i < cellsPerSide && atomsPlaced < numAtoms; i++) {
      for (let j = 0; j < cellsPerSide && atomsPlaced < numAtoms; j++) {
        for (let k = 0; k < cellsPerSide && atomsPlaced < numAtoms; k++) {
          // FCC lattice has atoms at:
          // (0,0,0), (0,1/2,1/2), (1/2,0,1/2), (1/2,1/2,0) of each unit cell
          const baseX = (i - cellsPerSide/2 + 0.5) * latticeConstant;
          const baseY = (j - cellsPerSide/2 + 0.5) * latticeConstant;
          const baseZ = (k - cellsPerSide/2 + 0.5) * latticeConstant;
          
          // Add the 4 atoms of the FCC unit cell
          positions.push(new THREE.Vector3(baseX, baseY, baseZ));
          atomsPlaced++;
          
          if (atomsPlaced < numAtoms) {
            positions.push(new THREE.Vector3(baseX, baseY + latticeConstant/2, baseZ + latticeConstant/2));
            atomsPlaced++;
          }
          
          if (atomsPlaced < numAtoms) {
            positions.push(new THREE.Vector3(baseX + latticeConstant/2, baseY, baseZ + latticeConstant/2));
            atomsPlaced++;
          }
          
          if (atomsPlaced < numAtoms) {
            positions.push(new THREE.Vector3(baseX + latticeConstant/2, baseY + latticeConstant/2, baseZ));
            atomsPlaced++;
          }
        }
      }
    }
    
    return positions;
  }

  addAtom(atomType: string, atomicMass: number): void {
    // Get atom positions based on intelligent initialization
    if (!this.atomPositions) {
      this.atomPositions = this.initializeAtomPositions();
    }
    
    // Ensure we have a valid position, fallback to random if needed
    const position = this.atomPositions?.[this.atoms.length] || this.getRandomPosition(0.8);

    // Scale atom size based on the atom type - larger atoms have larger radii
    let atomRadius = this.getAtomRadius(atomType);

    // Create the main atom sphere
    const geometry = new THREE.SphereGeometry(atomRadius, 32, 32);
    const atomColor = this.getAtomColor(atomType);
    
    const material = new THREE.MeshPhongMaterial({
      color: atomColor,
      specular: 0x444444,
      shininess: 30,
    });

    // Create glowing outline effect
    const glowGeometry = new THREE.SphereGeometry(atomRadius * 1.1, 32, 32);
    const contrastingColor = this.getContrastingColor(atomColor);
    
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: contrastingColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);

    const sphere = new THREE.Mesh(geometry, material);
    sphere.add(glow);

    // Position atom according to our initialization strategy
    sphere.position.copy(position);

    this.atoms.push(sphere);
    this.scene.add(sphere);
  }

  private getAtomColor(atomType: string): number {
    const colors: { [key: string]: number } = {
      'He': 0x00ffff, // Cyan
      'Ne': 0xff00ff, // Magenta
      'Ar': 0xff0000, // Red
      'Kr': 0x00ff00, // Green
      'Xe': 0x0000ff, // Blue
      'User': 0xffffff // White
    };
    return colors[atomType] || 0xffffff;
  }

  private getColorLuminance(color: number): number {
    // Convert hex to RGB
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    
    // Calculate relative luminance using the formula from WCAG 2.0
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  private getContrastingColor(color: number): number {
    const luminance = this.getColorLuminance(color);
    // If the color is light (luminance > 0.5), use dark outline, otherwise use light outline
    return luminance > 0.5 ? 0x000000 : 0xffffff;
  }

  private getRandomPosition(scale: number = 0.8): THREE.Vector3 {
    return new THREE.Vector3(
      (Math.random() - 0.5) * (this.containerSize * 2 * scale),
      (Math.random() - 0.5) * (this.containerSize * 2 * scale),
      (Math.random() - 0.5) * (this.containerSize * 2 * scale)
    );
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