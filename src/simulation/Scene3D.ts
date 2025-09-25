import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { rotateOpx, InputData, OutputData } from "../types/types";
import { LJ_PARAMS, SS_PARAMS } from "constants/potentialParams";

interface TimeData {
  currentTime: number;
  totalTime: number;
  runTime: number;
  totalRuntime: number;
}

// Constants for simulation accuracy
const KB = 1.380649e-23; // Boltzmann constant (J/K)
const NA = 6.02214076e23; // Avogadro's number
const R = 8.314462618; // Gas constant (J/mol·K)
const KJ_MOL_TO_J = 1000 / NA; // Unit conversion: 1 kJ/mol per particle = 1.66054e-21 J
export class Scene3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private onSimulationComplete: (() => void) | null = null;

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
  private thermostatVariable: number = 0; // ζ (zeta) - friction coefficient
  private thermostatVelocity: number = 0; // ζ̇ (zeta dot) - time derivative of friction coefficient
  private thermostatMass: number = 1.0; // Q - fictitious mass of the thermostat

  // Andersen barostat variables for NpT ensemble
  private pistonMass: number = 1000; // W - fictitious mass for volume changes
  private pistonVelocity: number = 0; // V̇ - time derivative of volume scaling
  private targetPressure: number = 1.0; // Target pressure from input data

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
  private outputUpdateCounter = 0; // Counter for output data updates

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
  public setOnSimulationComplete(callback: (() => void) | null): void {
    this.onSimulationComplete = callback;
  }
  private atomPositions: THREE.Vector3[] | null = null;
  private usesLatticePlacement: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    inputData: InputData,
    onOutputUpdate?: (data: OutputData) => void
  ) {
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
      color: 0x9e9e9e, // Medium grey that works in both themes
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
      const x = Math.floor(
        (atom.position.x + this.containerSize) / this.cellSize
      );
      const y = Math.floor(
        (atom.position.y + this.containerSize) / this.cellSize
      );
      const z = Math.floor(
        (atom.position.z + this.containerSize) / this.cellSize
      );

      // Handle boundary conditions
      const cellX = Math.max(0, Math.min(this.numCells.x - 1, x));
      const cellY = Math.max(0, Math.min(this.numCells.y - 1, y));
      const cellZ = Math.max(0, Math.min(this.numCells.z - 1, z));

      // Calculate cell index
      const cellIndex =
        cellX +
        cellY * this.numCells.x +
        cellZ * this.numCells.x * this.numCells.y;

      // Add atom to cell
      this.cells[cellIndex].push(i);
    }
  }

  private calculateForcesInCell(cellIndex: number) {
    const atomsInCell = this.cells[cellIndex];
    if (atomsInCell.length <= 1) return; // No interactions in cells with 0 or 1 atom

    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    if (potentialModel === "NoPotential" || potentialModel === "HardSphere")
      return;

    // Get parameters
    const atomType = this.inputData.ModelSetupData.atomType;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;

    // Get LJ parameters based on atom type
    let defaultParams;
    if (potentialModel === "LennardJones") {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    } else if (potentialModel === "SoftSphere") {
      const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      defaultParams = {
        sigma: ljParams.sigma,
        epsilon: ljParams.epsilon * 0.5,
      };
    } else {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    }

    // Use input parameters if available, otherwise use defaults
    const sigma =
      this.inputData.ModelSetupData.potentialParams?.sigma ||
      defaultParams.sigma;
    const epsilon =
      this.inputData.ModelSetupData.potentialParams?.epsilon ||
      defaultParams.epsilon;

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
        if (potentialModel === "LennardJones") {
          const sr6 = Math.pow(sigma / distance, 6);
          const sr12 = sr6 * sr6;
          // Use epsilon directly without unit conversion for reduced units
          forceMagnitude = (24 * epsilon * (2 * sr12 - sr6)) / distance;
        } else if (potentialModel === "SoftSphere") {
          const sr12 = Math.pow(sigma / distance, 12);
          forceMagnitude = (12 * epsilon * sr12) / distance;
        }

        // Instead of a blanket 0.01 scaling, use physically motivated scaling
        const forceScaling = 1.0; // Start with no artificial scaling

        const forceVector = distanceVector
          .clone()
          .normalize()
          .multiplyScalar(forceMagnitude * forceScaling);

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
    if (potentialModel === "NoPotential" || potentialModel === "HardSphere")
      return;

    // Get parameters
    const atomType = this.inputData.ModelSetupData.atomType;
    const atomicMass = this.inputData.ModelSetupData.atomicMass;

    // Get LJ parameters based on atom type
    let defaultParams;
    if (potentialModel === "LennardJones") {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    } else if (potentialModel === "SoftSphere") {
      const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      defaultParams = {
        sigma: ljParams.sigma,
        epsilon: ljParams.epsilon * 0.5,
      };
    } else {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    }

    // Use input parameters if available, otherwise use defaults
    const sigma =
      this.inputData.ModelSetupData.potentialParams?.sigma ||
      defaultParams.sigma;
    const epsilon =
      this.inputData.ModelSetupData.potentialParams?.epsilon ||
      defaultParams.epsilon;

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

        if (potentialModel === "LennardJones") {
          // Lennard-Jones force calculation
          const sr6 = Math.pow(sigma / distance, 6);
          const sr12 = sr6 * sr6;
          forceMagnitude = (24 * epsilon * (2 * sr12 - sr6)) / distance;

          // Apply smooth tapering at cutoff
          if (distance > 0.9 * cutoffDistance) {
            const tapering =
              1 -
              Math.pow(
                (distance - 0.9 * cutoffDistance) / (0.1 * cutoffDistance),
                2
              );
            forceMagnitude *= Math.max(0, tapering);
          }
        } else if (potentialModel === "SoftSphere") {
          // Soft sphere force calculation
          const sr12 = Math.pow(sigma / distance, 12);
          forceMagnitude = (12 * epsilon * sr12) / distance;
        }

        // Apply force with appropriate scaling
        const forceScaling = 0.0001 / Math.max(0.01, atomicMass);

        // Create normalized force vector in the direction of the distance vector
        const forceVector = distanceVector
          .clone()
          .normalize()
          .multiplyScalar(forceMagnitude * forceScaling);

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

  // Method to update inputData for new runs
  updateInputData(newInputData: InputData): void {
    this.inputData = newInputData;
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
      totalTime:
        (this.inputData.RunDynamicsData.timeStep / 1000) *
        this.inputData.RunDynamicsData.stepCount,
      runTime: currentRunTime,
      totalRuntime: this.realTotalTime + currentRunTime,
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
    console.log("Starting simulation run...");
    this.runInProgress = true;
    this.currentTimeStep = 0;
    this.simulationTime = 0;
    this.simulationCompleted = false;
    this.outputUpdateCounter = 0;
    this.realStartTime = performance.now();

    // Reset all history arrays for this run
    this.temperatureHistory = [];
    this.pressureHistory = [];
    this.volumeHistory = [];
    this.totalEnergyHistory = [];
    this.kineticEnergyHistory = [];
    this.potentialEnergyHistory = [];

    this.initializeOutputData();

    // Remove any existing completion notification when starting a new run
    this.removeCompletionNotification();

    // Initialize velocities if they don't exist
    if (this.atomVelocities.length !== this.atoms.length) {
      this.initializeVelocities();
    }

    // Initialize forces arrays for velocity Verlet
    this.atomForces = Array(this.atoms.length)
      .fill(null)
      .map(() => new THREE.Vector3());
    this.atomOldForces = Array(this.atoms.length)
      .fill(null)
      .map(() => new THREE.Vector3());

    // Initialize cell list for force calculation optimization
    this.initializeCellList();

    // Reset thermostat for new simulation
    this.resetThermostat();

    // Reset barostat for new simulation
    this.resetBarostat();

    // Calculate initial forces
    this.calculateForces();

    // Start the simulation loop with continuous animation at ~60fps
    this._simulationIntervalID = window.setInterval(() => {
      this.simulationStep();
    }, 16); // Fixed 16ms interval for ~60fps
  }

  private initializeVelocities() {
    this.atomVelocities = [];

    // Initialize velocities from Maxwell-Boltzmann distribution
    const temperature = this.inputData.RunDynamicsData.initialTemperature;
    // Guard against a zero or negative atomic mass to prevent division by zero
    const atomicMass = Math.max(this.inputData.ModelSetupData.atomicMass, 1e-9);
    const atomCount = this.atoms.length;

    // Initialize Nosé-Hoover thermostat parameters
    this.initializeThermostat(temperature, atomCount);

    // Initialize Andersen barostat parameters
    this.initializeBarostat();

    // Calculate velocity scale based on temperature
    // According to equipartition theorem: 1/2 m <v²> = 3/2 kT
    // So <v²> = 3kT/m and σv = sqrt(kT/m)
    const TEMP_SCALE = 100; // Same scale as in calculateTemperature
    const velocityScale = Math.sqrt(temperature / TEMP_SCALE); // Proper scaling for target temp

    for (let i = 0; i < atomCount; i++) {
      // Generate Gaussian-distributed velocities using Box-Muller transform
      let vx = 0,
        vy = 0,
        vz = 0;

      // X component
      const u1 = Math.random(),
        u2 = Math.random();
      vx =
        velocityScale *
        Math.sqrt(-2 * Math.log(u1)) *
        Math.cos(2 * Math.PI * u2);

      // Y component
      const u3 = Math.random(),
        u4 = Math.random();
      vy =
        velocityScale *
        Math.sqrt(-2 * Math.log(u3)) *
        Math.cos(2 * Math.PI * u4);

      // Z component
      const u5 = Math.random(),
        u6 = Math.random();
      vz =
        velocityScale *
        Math.sqrt(-2 * Math.log(u5)) *
        Math.cos(2 * Math.PI * u6);

      this.atomVelocities.push(new THREE.Vector3(vx, vy, vz));
    }

    // Remove center-of-mass motion to conserve momentum
    this.removeCenterOfMassMotion();

    // Scale velocities to exactly match target temperature
    this.scaleVelocitiesToTemperature(temperature);
  }

  private initializeThermostat(temperature: number, atomCount: number) {
    // Initialize Nosé-Hoover thermostat parameters
    // The thermostat mass Q should be chosen to give appropriate coupling
    // A common choice is Q = N_f * k_B * T * τ^2 where τ is the relaxation time
    const degreesOfFreedom = 3 * atomCount - 3; // 3N - 3 (removing center of mass motion)
    const relaxationTime = 0.1; // Relaxation time in simulation units

    // Set thermostat mass based on system size and temperature
    this.thermostatMass =
      degreesOfFreedom * KB * temperature * relaxationTime * relaxationTime;

    // Initialize thermostat variables to zero
    this.thermostatVariable = 0;
    this.thermostatVelocity = 0;
  }

  private initializeBarostat() {
    // Initialize Andersen barostat parameters
    // Set target pressure from input data
    this.targetPressure = this.inputData.RunDynamicsData.targetPressure;

    // Initialize barostat variables to zero
    this.pistonVelocity = 0;

    // Set piston mass based on system size and pressure
    // A larger mass gives slower pressure equilibration
    const atomCount = this.atoms.length;
    this.pistonMass = Math.max(100, atomCount * 10); // Scale with system size
  }

  private resetThermostat() {
    // Reset thermostat variables for new simulation
    this.thermostatVariable = 0;
    this.thermostatVelocity = 0;
  }

  private resetBarostat() {
    // Reset barostat variables for new simulation
    this.pistonVelocity = 0;
    this.targetPressure = this.inputData.RunDynamicsData.targetPressure;
  }

  private scaleVelocitiesToTemperature(targetTemp: number) {
    // Calculate current temperature
    const currentTemp = this.calculateTemperature();

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
    const baseTimeStep = 0.005; // Increase base time step
    const atomCount = this.atoms.length;

    // Less aggressive scaling with atom count
    const sizeFactor = Math.min(1.0, Math.pow(20 / atomCount, 0.25)); // Gentler scaling

    const potentialFactor =
      this.inputData.ModelSetupData.potentialModel === "LennardJones"
        ? 1.0
        : 1.2;

    // Less conservative temperature scaling
    const tempFactor = Math.min(
      1.0,
      Math.sqrt(400 / this.calculateTemperature())
    );

    return Math.max(
      0.001,
      Math.min(0.01, baseTimeStep * sizeFactor * potentialFactor * tempFactor)
    );
  }

  private simulationStep() {
    if (!this.runInProgress) return;

    if (this.currentTimeStep >= this.inputData.RunDynamicsData.stepCount) {
      this.simulationCompleted = true;
      this.stopRun();
      return;
    }

    const dt = this.inputData.RunDynamicsData.timeStep / 1000;

    // Simple integration
    this.updateAtomPositionsVerlet(dt);
    this.handleCollisions();

    // Apply simple thermostat every 10 steps
    if (this.currentTimeStep % 10 === 0) {
      this.applySimpleThermostat(dt);
    }

    // Update counters and output
    this.simulationTime += dt;
    this.currentTimeStep++;

    if (this.currentTimeStep % this.inputData.RunDynamicsData.interval === 0) {
      this.calculateOutput();
    }

    if (
      this.inputData.RunDynamicsData.simulationType === "ConstPT" &&
      this.currentTimeStep % 100 === 0
    ) {
      const pressure = this.calculatePressure();
      const temp = this.calculateTemperature();
      const targetP = this.inputData.RunDynamicsData.targetPressure;
      const targetT = this.inputData.RunDynamicsData.initialTemperature;

      console.log(
        `[NPT Debug] Step ${this.currentTimeStep}/${this.inputData.RunDynamicsData.stepCount}:`
      );
      console.log(
        `  T: ${temp.toFixed(1)}K (target: ${targetT}K, error: ${(
          temp - targetT
        ).toFixed(1)}K)`
      );
      console.log(
        `  P: ${pressure.toFixed(2)}atm (target: ${targetP}atm, error: ${(
          pressure - targetP
        ).toFixed(2)}atm)`
      );
      console.log(
        `  V: ${this.containerVolume.toFixed(2)}L/mol (initial: ${
          this.inputData.RunDynamicsData.initialVolume
        })`
      );
      console.log(`  Box size: ${(this.containerSize * 2).toFixed(2)} units`);

      // Warn if pressure isn't converging
      if (this.currentTimeStep > 500 && Math.abs(pressure - targetP) > 2.0) {
        console.warn(
          `  ⚠️ Pressure not converging! Check barostat parameters.`
        );
      }
    }
  }

  // Velocity Verlet integration with Nosé-Hoover thermostat for better energy conservation
  private updateAtomPositionsVerlet(dt: number) {
    // Guard against a zero or negative atomic mass to prevent division by zero
    const atomicMass = Math.max(this.inputData.ModelSetupData.atomicMass, 1e-9);
    const isConstVT =
      this.inputData.RunDynamicsData.simulationType === "ConstVT";

    const timeStep = this.inputData.RunDynamicsData.timeStep / 1000; // fs to ps

    // Standard Verlet without magic numbers
    for (let i = 0; i < this.atoms.length; i++) {
      const velocity = this.atomVelocities[i];
      const force = this.atomForces[i];

      // F = ma, so a = F/m (no extra scaling needed if forces are scaled properly)
      const acceleration = force
        .clone()
        .divideScalar(this.inputData.ModelSetupData.atomicMass);

      // Standard Verlet updates
      velocity.add(acceleration.clone().multiplyScalar(0.5 * timeStep));
    }

    // Then, update positions by a full step using the half-step velocities
    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      const velocity = this.atomVelocities[i];

      atom.position.x += velocity.x * dt;
      atom.position.y += velocity.y * dt;
      atom.position.z += velocity.z * dt;
    }

    // Debug: Log first atom's position occasionally
    if (this.currentTimeStep % 100 === 0 && this.atoms.length > 0) {
      console.log(
        `Step ${this.currentTimeStep}: First atom at`,
        this.atoms[0].position
      );
    }

    // Now, calculate the new forces at the new positions
    this.calculateForces();

    // Finally, complete the velocity update with another half step, using the new forces
    for (let i = 0; i < this.atoms.length; i++) {
      const velocity = this.atomVelocities[i];
      const newForce = this.atomForces[i];

      let ax = newForce.x / atomicMass;
      let ay = newForce.y / atomicMass;
      let az = newForce.z / atomicMass;

      if (isConstVT) {
        ax -= this.thermostatVariable * velocity.x;
        ay -= this.thermostatVariable * velocity.y;
        az -= this.thermostatVariable * velocity.z;
      }

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
    // Use damping ONLY for constant pressure, not constant temperature
    const useDamping =
      this.inputData.RunDynamicsData.simulationType === "ConstPT";
    const damping = useDamping ? 0.98 : 1.0; // No energy loss for NVT

    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      const velocity = this.atomVelocities[i];

      // X boundaries
      if (Math.abs(atom.position.x) > this.containerSize) {
        velocity.x *= -damping;
        atom.position.x =
          Math.sign(atom.position.x) * this.containerSize * 0.99;
      }

      // Y boundaries
      if (Math.abs(atom.position.y) > this.containerSize) {
        velocity.y *= -damping;
        atom.position.y =
          Math.sign(atom.position.y) * this.containerSize * 0.99;
      }

      // Z boundaries
      if (Math.abs(atom.position.z) > this.containerSize) {
        velocity.z *= -damping;
        atom.position.z =
          Math.sign(atom.position.z) * this.containerSize * 0.99;
      }
    }
  }

  private applySimpleThermostat(dt: number): void {
    // Only apply for constant temperature simulations
    if (this.inputData.RunDynamicsData.simulationType !== "ConstVT") {
      return;
    }

    const targetTemp = this.inputData.RunDynamicsData.initialTemperature;
    const currentTemp = this.calculateTemperature();

    // Skip if temperature is undefined or zero
    if (currentTemp <= 0) return;

    // Calculate scaling factor (Berendsen-like thermostat)
    const tau = 10; // Coupling strength (in time steps)
    const scaleFactor = Math.sqrt(
      1 + (dt / tau) * (targetTemp / currentTemp - 1)
    );

    // Limit scaling to prevent instability
    const maxScale = 1.1;
    const minScale = 0.9;
    const limitedScale = Math.max(minScale, Math.min(maxScale, scaleFactor));

    // Apply scaling to all velocities
    for (let i = 0; i < this.atomVelocities.length; i++) {
      this.atomVelocities[i].multiplyScalar(limitedScale);
    }
  }

  private handlePeriodicBoundaries() {
    const boxSize = this.containerSize * 2;

    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];

      // Apply minimum image convention for periodic boundaries
      // Use modulo arithmetic for more accurate wrapping
      atom.position.x =
        ((atom.position.x + this.containerSize) % boxSize) - this.containerSize;
      atom.position.y =
        ((atom.position.y + this.containerSize) % boxSize) - this.containerSize;
      atom.position.z =
        ((atom.position.z + this.containerSize) % boxSize) - this.containerSize;

      // Handle negative values correctly
      if (atom.position.x < -this.containerSize) atom.position.x += boxSize;
      if (atom.position.y < -this.containerSize) atom.position.y += boxSize;
      if (atom.position.z < -this.containerSize) atom.position.z += boxSize;
    }
  }

  private handleNoPotentialCollisions(collisionDistance: number) {
    // Optimized collision detection for NoPotential model
    // Since there are no long-range forces, we only need to check for collisions
    // between nearby atoms, making spatial partitioning very effective
    const atomCount = this.atoms.length;

    if (atomCount < 2) return;

    // For small systems, use simple O(N²) approach (overhead of spatial partitioning not worth it)
    if (atomCount <= 50) {
      this.handleNoPotentialCollisionsSimple(collisionDistance);
      return;
    }

    // For larger systems, use spatial partitioning to reduce complexity from O(N²) to O(N)
    this.handleNoPotentialCollisionsOptimized(collisionDistance);
  }

  private handleNoPotentialCollisionsSimple(collisionDistance: number) {
    // Simple O(N²) collision detection for small systems
    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        this.processCollision(i, j, collisionDistance);
      }
    }
  }

  private handleNoPotentialCollisionsOptimized(collisionDistance: number) {
    // Optimized collision detection using spatial partitioning
    // Create a grid with cell size equal to collision distance
    const cellSize = collisionDistance;
    const gridSize = Math.max(
      1,
      Math.ceil((this.containerSize * 2) / cellSize)
    );

    // Safety check: if grid would be too large, fall back to simple method
    if (gridSize > 100) {
      this.handleNoPotentialCollisionsSimple(collisionDistance);
      return;
    }

    // Initialize 3D grid for spatial partitioning using Map for better type safety
    const gridMap = new Map<string, number[]>();

    // Assign atoms to grid cells
    for (let i = 0; i < this.atoms.length; i++) {
      const pos = this.atoms[i].position;
      const x = Math.floor((pos.x + this.containerSize) / cellSize);
      const y = Math.floor((pos.y + this.containerSize) / cellSize);
      const z = Math.floor((pos.z + this.containerSize) / cellSize);

      // Clamp to grid bounds
      const gridX = Math.max(0, Math.min(gridSize - 1, x));
      const gridY = Math.max(0, Math.min(gridSize - 1, y));
      const gridZ = Math.max(0, Math.min(gridSize - 1, z));

      const key = `${gridX},${gridY},${gridZ}`;
      if (!gridMap.has(key)) {
        gridMap.set(key, []);
      }
      gridMap.get(key)!.push(i);
    }

    // Check collisions within each cell and neighboring cells
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const key = `${x},${y},${z}`;
          const cell = gridMap.get(key) || [];

          // Check collisions within the cell
          for (let i = 0; i < cell.length; i++) {
            for (let j = i + 1; j < cell.length; j++) {
              this.processCollision(cell[i], cell[j], collisionDistance);
            }
          }

          // Check collisions with neighboring cells
          for (let dx = 0; dx <= 1; dx++) {
            for (let dy = 0; dy <= 1; dy++) {
              for (let dz = 0; dz <= 1; dz++) {
                if (dx === 0 && dy === 0 && dz === 0) continue; // Skip self

                const nx = x + dx;
                const ny = y + dy;
                const nz = z + dz;

                if (nx < gridSize && ny < gridSize && nz < gridSize) {
                  const neighborKey = `${nx},${ny},${nz}`;
                  const neighborCell = gridMap.get(neighborKey) || [];

                  for (let i = 0; i < cell.length; i++) {
                    for (let j = 0; j < neighborCell.length; j++) {
                      this.processCollision(
                        cell[i],
                        neighborCell[j],
                        collisionDistance
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  private processCollision(
    atomIndex1: number,
    atomIndex2: number,
    collisionDistance: number
  ) {
    const distanceVector = this.getMinimumDistance(
      this.atoms[atomIndex1].position,
      this.atoms[atomIndex2].position
    );

    const distance = distanceVector.length();

    // Only process if atoms are overlapping
    if (distance < collisionDistance && distance > 0) {
      // Calculate collision normal (unit vector from atom2 to atom1)
      const normal = distanceVector.clone().normalize();

      // Calculate relative velocity
      const relativeVelocity = new THREE.Vector3().subVectors(
        this.atomVelocities[atomIndex1],
        this.atomVelocities[atomIndex2]
      );

      // Calculate relative velocity along collision normal
      const relativeSpeed = relativeVelocity.dot(normal);

      // Only process collision if atoms are approaching each other
      if (relativeSpeed < 0) {
        // Perfect elastic collision: conserve momentum and kinetic energy
        // For equal masses, velocities are simply exchanged along the collision normal
        const impulse = -relativeSpeed;

        // Apply impulse to both atoms
        this.atomVelocities[atomIndex1].add(
          normal.clone().multiplyScalar(impulse)
        );
        this.atomVelocities[atomIndex2].sub(
          normal.clone().multiplyScalar(impulse)
        );

        // Separate atoms to prevent overlap
        const overlap = collisionDistance - distance;
        const separation = normal.clone().multiplyScalar(overlap / 2);

        this.atoms[atomIndex1].position.add(separation);
        this.atoms[atomIndex2].position.sub(separation);
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
      // For 'NoPotential', handle collisions using proper elastic collision physics
      // This represents atoms that only interact through hard-sphere collisions
      this.handleNoPotentialCollisions(collisionDistance);
    } else if (potentialModel === "HardSphere") {
      // For 'HardSphere', handle collisions using elastic collision physics with hard sphere radius
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
            this.atomVelocities[i].add(
              normal.clone().multiplyScalar(impulse * 0.5)
            );
            this.atomVelocities[j].add(
              normal.clone().multiplyScalar(-impulse * 0.5)
            );

            // Prevent overlap - ensure atoms are exactly at collision distance
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

  private getMinimumDistance(
    pos1: THREE.Vector3,
    pos2: THREE.Vector3
  ): THREE.Vector3 {
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

    // Reset forces
    for (let i = 0; i < this.atomForces.length; i++) {
      this.atomForces[i].set(0, 0, 0);
    }

    if (potentialModel === "NoPotential" || potentialModel === "HardSphere") {
      return;
    }

    const atomType = this.inputData.ModelSetupData.atomType;
    const params =
      this.inputData.ModelSetupData.potentialParams ||
      LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    const cutoff = 2.5 * params.sigma;

    const FORCE_SCALE = 0.002; // Single scaling factor for ALL forces

    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const dr = this.getMinimumDistance(
          this.atoms[i].position,
          this.atoms[j].position
        );
        const r = dr.length();

        if (r > cutoff || r < 0.5 * params.sigma) continue; // Increased minimum from 0.1 to 0.5

        let forceMag = 0;
        if (potentialModel === "LennardJones") {
          const sr6 = Math.pow(params.sigma / r, 6);
          const sr12 = sr6 * sr6;
          // Standard LJ force
          forceMag = (24 * params.epsilon * (2 * sr12 - sr6)) / r;
        } else if (potentialModel === "SoftSphere") {
          const sr12 = Math.pow(params.sigma / r, 12);
          forceMag = (12 * params.epsilon * sr12) / r;
        }

        // Apply SINGLE, CONSISTENT scaling
        const forceVector = dr
          .normalize()
          .multiplyScalar(forceMag * FORCE_SCALE);
        this.atomForces[i].add(forceVector);
        this.atomForces[j].sub(forceVector);
      }
    }
  }

  // Apply Nosé-Hoover thermostat for canonical (NVT) ensemble
  // This method updates the thermostat variables (ζ and ζ̇) which are then used
  // in the equations of motion to apply the friction force
  private applyThermostat(dt?: number) {
    // Only apply thermostat for constant temperature simulations
    if (this.inputData.RunDynamicsData.simulationType !== "ConstVT") {
      return;
    }

    const targetTemp = this.inputData.RunDynamicsData.initialTemperature;
    const timeStep = dt || this.inputData.RunDynamicsData.timeStep / 1000;
    const atomCount = this.atoms.length;

    // Skip if no atoms
    if (atomCount === 0) return;

    try {
      // Calculate current kinetic energy
      let kineticEnergy = 0;
      for (const velocity of this.atomVelocities) {
        kineticEnergy += velocity.lengthSq();
      }
      kineticEnergy *= 0.5 * this.inputData.ModelSetupData.atomicMass;

      // Degrees of freedom (3N - 3 for center of mass motion removal)
      const degreesOfFreedom = 3 * atomCount - 3;

      // Nosé-Hoover equation of motion for ζ̇:
      // ζ̇ = (1/Q) * [2*KE - N_f*k_B*T_target]
      // where KE is kinetic energy, N_f is degrees of freedom, Q is thermostat mass
      const thermostatForce =
        (2 * kineticEnergy - degreesOfFreedom * KB * targetTemp) /
        this.thermostatMass;

      // Update thermostat velocity using half-step integration
      this.thermostatVelocity += thermostatForce * 0.5 * timeStep;

      // Update thermostat variable (friction coefficient ζ)
      // This is integrated for completeness but the main effect comes from the friction force
      this.thermostatVariable += this.thermostatVelocity * timeStep;

      // Recalculate kinetic energy for second half-step (velocities may have changed)
      let newKineticEnergy = 0;
      for (const velocity of this.atomVelocities) {
        newKineticEnergy += velocity.lengthSq();
      }
      newKineticEnergy *= 0.5 * this.inputData.ModelSetupData.atomicMass;

      // Complete the thermostat velocity update with the second half-step
      const newThermostatForce =
        (2 * newKineticEnergy - degreesOfFreedom * KB * targetTemp) /
        this.thermostatMass;
      this.thermostatVelocity += newThermostatForce * 0.5 * timeStep;
    } catch (error) {
      // Fallback to Berendsen thermostat if Nosé-Hoover fails
      console.warn(
        "Nosé-Hoover thermostat failed, falling back to Berendsen:",
        error
      );

      const currentTemp = this.calculateTemperature() * 100 + 273.15;
      const relaxationTime = 100; // time steps

      // Calculate scaling factor for Berendsen thermostat
      const lambda = Math.sqrt(
        1 + (timeStep / relaxationTime) * (targetTemp / currentTemp - 1)
      );

      // Apply velocity scaling to all atoms
      for (let i = 0; i < this.atomVelocities.length; i++) {
        this.atomVelocities[i].multiplyScalar(lambda);
      }
    }
  }

  // Apply Andersen barostat for isothermal-isobaric (NpT) ensemble
  // This method dynamically adjusts the simulation box volume to maintain constant pressure
  private applyBarostat(dt?: number) {
    if (this.inputData.RunDynamicsData.simulationType !== "ConstPT") {
      return;
    }

    const timeStep = dt || this.inputData.RunDynamicsData.timeStep / 1000;
    const atomCount = this.atoms.length;

    if (atomCount === 0) return;

    const currentPressure = this.calculatePressure();
    const targetPressure = this.inputData.RunDynamicsData.targetPressure;

    // More aggressive for initial equilibration
    const pressureError = Math.abs(currentPressure - targetPressure);
    const isEquilibrating = pressureError > 0.5; // More than 0.5 atm off

    // Adaptive coupling strength
    const pistonMass = isEquilibrating ? 1000 : 10000; // Faster response when far from target
    this.pistonMass = pistonMass;

    // Pressure-driven force on the piston
    const pistonForce = -(currentPressure - targetPressure);

    // Less damping for faster equilibration
    const dampingFactor = isEquilibrating ? 0.5 : 0.8;
    this.pistonVelocity =
      this.pistonVelocity * dampingFactor +
      (pistonForce / this.pistonMass) * timeStep;

    // Larger allowed changes during equilibration
    const maxVelocity = isEquilibrating ? 0.01 : 0.002;
    this.pistonVelocity = Math.max(
      -maxVelocity,
      Math.min(maxVelocity, this.pistonVelocity)
    );

    // Volume scaling
    const volumeScalingFactor = 1 + this.pistonVelocity * timeStep;

    // More permissive limits during equilibration
    const maxScaling = isEquilibrating ? 1.02 : 1.005; // 2% vs 0.5%
    const minScaling = isEquilibrating ? 0.98 : 0.995;
    const limitedScaling = Math.max(
      minScaling,
      Math.min(maxScaling, volumeScalingFactor)
    );

    // Apply scaling
    if (Math.abs(limitedScaling - 1.0) > 1e-6) {
      this.scaleSystemVolume(limitedScaling);

      // Debug output
      if (this.currentTimeStep % 100 === 0) {
        console.log(
          `[Barostat] Step ${this.currentTimeStep}: P=${currentPressure.toFixed(
            2
          )}atm (target=${targetPressure}), ` +
            `V=${this.containerVolume.toFixed(
              2
            )}L/mol, scaling=${limitedScaling.toFixed(6)}, ` +
            `mode=${isEquilibrating ? "EQUILIBRATING" : "STABLE"}`
        );
      }
    }
  }

  // Scale the entire system volume and coordinates
  private scaleSystemVolume(scalingFactor: number) {
    // Calculate linear scaling factor (cube root of volume scaling)
    const linearScaling = Math.pow(scalingFactor, 1 / 3);

    // Scale container size
    this.containerSize *= linearScaling;

    // Scale all atom positions
    for (let i = 0; i < this.atoms.length; i++) {
      this.atoms[i].position.multiplyScalar(linearScaling);
    }

    // Update container volume for calculations
    this.containerVolume *= scalingFactor;

    // Re-apply boundary conditions after scaling
    this.applyBoundaryConditionsAfterScaling();

    // Update cell list for force calculations (grid size may have changed)
    this.initializeCellList();

    // Update visual container representation
    this.updateContainerVisuals();
  }

  // Apply boundary conditions after volume scaling
  private applyBoundaryConditionsAfterScaling() {
    const boundaryType = this.inputData.ModelSetupData.boundary;

    if (boundaryType === "Periodic") {
      // For periodic boundaries, wrap atoms that may have moved outside
      this.handlePeriodicBoundaries();
    } else if (boundaryType === "Fixed Walls") {
      // For fixed walls, ensure no atoms are outside the container
      for (let i = 0; i < this.atoms.length; i++) {
        const atom = this.atoms[i];

        // Clamp positions to container bounds
        atom.position.x = Math.max(
          -this.containerSize * 0.99,
          Math.min(this.containerSize * 0.99, atom.position.x)
        );
        atom.position.y = Math.max(
          -this.containerSize * 0.99,
          Math.min(this.containerSize * 0.99, atom.position.y)
        );
        atom.position.z = Math.max(
          -this.containerSize * 0.99,
          Math.min(this.containerSize * 0.99, atom.position.z)
        );
      }
    }
  }

  // Update the visual representation of the container
  private updateContainerVisuals() {
    if (this.container) {
      // Remove old container from scene
      this.scene.remove(this.container);

      // Create new container with updated size
      const boxGeometry = new THREE.BoxGeometry(
        this.containerSize * 2,
        this.containerSize * 2,
        this.containerSize * 2
      );
      const edges = new THREE.EdgesGeometry(boxGeometry);
      const linesMaterial = new THREE.LineBasicMaterial({
        color: 0x9e9e9e, // Medium grey that works in both themes
        transparent: true,
        opacity: 0.7,
      });
      this.container = new THREE.LineSegments(edges, linesMaterial);
      this.scene.add(this.container);
    }
  }

  // Enhanced temperature calculation with better error handling
  private calculateTemperature(): number {
    if (this.atoms.length < 2)
      return this.inputData.RunDynamicsData.initialTemperature;

    let kineticEnergy = 0;

    // Calculate total kinetic energy (1/2 * m * v²)
    for (const velocity of this.atomVelocities) {
      kineticEnergy +=
        0.5 * this.inputData.ModelSetupData.atomicMass * velocity.lengthSq();
    }

    // Degrees of freedom (3N - 3 for removing COM motion)
    const degreesOfFreedom = Math.max(1, 3 * this.atoms.length - 3);

    // From equipartition theorem: KE_total = (1/2) * N_f * k_B * T
    // So: T = 2 * KE_total / (N_f * k_B)
    // In our reduced units, we calibrate this to match the input temperature

    // Calibration factor to match expected temperature
    // This should be derived from your unit system, but for now:
    const conversionFactor = 120; // Tune this to match your expected temperatures

    const temperature =
      ((2 * kineticEnergy) / degreesOfFreedom) * conversionFactor;

    return Math.max(1, Math.min(10000, temperature));
  }

  private calculateOutput() {
    // Calculate current values with accurate physics
    const temperature = this.calculateTemperature();

    // Calculate volume (in L/mol)
    const volume = this.calculateVolume();

    // Calculate pressure using virial theorem
    const pressure = this.calculatePressure();

    // Calculate energies
    const kineticEnergy = this.calculateKineticEnergy();
    const potentialEnergy = this.calculatePotentialEnergy();
    const totalEnergy = kineticEnergy + potentialEnergy;

    // Store current values for statistical averaging
    this.temperatureHistory.push(temperature);
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
    const potentialEnergyAvg = this.calculateAverage(
      this.potentialEnergyHistory
    );

    // Update output data
    this.outputData.basic.temperature.sample = temperature;
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
    const temperature = this.calculateTemperature();
    const atomCount = this.atoms.length;

    if (atomCount === 0 || volume === 0) return 0;

    // Calculate ideal gas contribution
    const PRESSURE_SCALE = (8.314 * 273.15) / 22.4;
    const idealPressure = (atomCount * temperature) / (volume * PRESSURE_SCALE);

    // Calculate virial contribution from forces
    let virial = 0;
    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const distanceVector = this.getMinimumDistance(
          this.atoms[i].position,
          this.atoms[j].position
        );

        // Calculate force between this pair (you'll need to extract this logic)
        const force = this.calculatePairwiseForce(i, j);

        // Add to virial: rᵢⱼ · Fᵢⱼ
        virial += distanceVector.dot(force);
      }
    }

    // Convert virial to pressure units
    const virialPressure = virial / (3 * volume * PRESSURE_SCALE);

    // Total pressure is sum of ideal and virial contributions
    const totalPressure = idealPressure + virialPressure;

    return Math.max(0.1, totalPressure);
  }

  private calculatePairwiseForce(i: number, j: number): THREE.Vector3 {
    const potentialModel = this.inputData.ModelSetupData.potentialModel;
    const force = new THREE.Vector3(0, 0, 0);

    if (potentialModel === "NoPotential" || potentialModel === "HardSphere") {
      return force;
    }

    const atomType = this.inputData.ModelSetupData.atomType;
    const defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    const sigma =
      this.inputData.ModelSetupData.potentialParams?.sigma ||
      defaultParams.sigma;
    const epsilon =
      this.inputData.ModelSetupData.potentialParams?.epsilon ||
      defaultParams.epsilon;

    const cutoffDistance = 2.5 * sigma;

    const distanceVector = this.getMinimumDistance(
      this.atoms[i].position,
      this.atoms[j].position
    );
    const distance = distanceVector.length();

    if (distance > cutoffDistance || distance < 0.1 * sigma || distance === 0) {
      return force;
    }

    let forceMagnitude = 0;
    if (potentialModel === "LennardJones") {
      const sr6 = Math.pow(sigma / distance, 6);
      const sr12 = sr6 * sr6;
      forceMagnitude = (24 * epsilon * (2 * sr12 - sr6)) / distance;
    } else if (potentialModel === "SoftSphere") {
      const sr12 = Math.pow(sigma / distance, 12);
      forceMagnitude = (12 * epsilon * sr12) / distance;
    }

    const forceScaling = 0.01;
    const scaledForceMagnitude = forceMagnitude * forceScaling;

    return distanceVector
      .clone()
      .normalize()
      .multiplyScalar(scaledForceMagnitude);
  }

  // Helper method to get average force magnitude for stability assessment
  private getAverageForce(): number {
    if (this.atomForces.length === 0) return 0;

    let totalForceMagnitude = 0;
    for (const force of this.atomForces) {
      totalForceMagnitude += force.length();
    }

    return totalForceMagnitude / this.atomForces.length;
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

    if (potentialModel === "NoPotential" || potentialModel === "HardSphere") {
      return 0;
    }

    const atomType = this.inputData.ModelSetupData.atomType;

    // Get appropriate parameters
    let defaultParams;
    if (potentialModel === "LennardJones") {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    } else if (potentialModel === "SoftSphere") {
      const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
      defaultParams = {
        sigma: ljParams.sigma,
        epsilon: ljParams.epsilon * 0.5,
      };
    } else {
      defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    }

    // Use input parameters if available, otherwise use defaults
    const sigma =
      this.inputData.ModelSetupData.potentialParams?.sigma ||
      defaultParams.sigma;
    const epsilon =
      this.inputData.ModelSetupData.potentialParams?.epsilon ||
      defaultParams.epsilon;

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

        if (potentialModel === "LennardJones") {
          // Lennard-Jones potential: 4ε[(σ/r)^12 - (σ/r)^6]
          const sr6 = Math.pow(sigma / distance, 6);
          const sr12 = sr6 * sr6;
          energy += 4 * epsilon * (sr12 - sr6);
        } else if (potentialModel === "SoftSphere") {
          // Soft sphere: ε(σ/r)^12
          const sr12 = Math.pow(sigma / distance, 12);
          energy += epsilon * sr12;
        }
      }
    }

    // Add long-range correction for Lennard-Jones
    if (potentialModel === "LennardJones") {
      const boxVolume = Math.pow(this.containerSize * 2, 3);
      const atomCount = this.atoms.length;
      const density = atomCount / boxVolume;

      // Long-range correction: (8πεσ³ρN/3)[(σ/rc)⁹/3 - (σ/rc)³]
      const sr3 = Math.pow(sigma / cutoff, 3);
      const sr9 = sr3 * sr3 * sr3;
      const lrc =
        ((8 * Math.PI * epsilon * Math.pow(sigma, 3) * density * atomCount) /
          3) *
        (sr9 / 3 - sr3);

      energy += lrc;
    }

    // Scale energy appropriately
    const energyScale = potentialModel === "LennardJones" ? 10 : 5;
    return energy * energyScale;
  }

  // Calculate volume in L/mol (constant in NVT ensemble, dynamic in NpT ensemble)
  private calculateVolume(): number {
    if (this.inputData.RunDynamicsData.simulationType === "ConstPT") {
      // For NpT ensemble, return current dynamic volume
      return this.containerVolume;
    } else {
      // For NVT ensemble, return initial fixed volume
      return this.inputData.RunDynamicsData.initialVolume;
    }
  }

  // Get atom radius based on atom type and Lennard-Jones sigma parameter
  private getAtomRadius(atomType: string): number {
    // The hard-sphere radius is related to the Lennard-Jones sigma parameter
    // by a conversion factor (approximately 0.5612 * sigma / 2)

    // REDUCED THE SCALING FACTOR TO MAKE ATOMS VISUALLY SMALLER
    const sigmaToRadiusFactor = 0.2; // Instead of 0.05
    const ljParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];

    // Fallback to default values if atom type is not recognized
    if (!ljParams) {
      console.warn(`Unknown atom type: ${atomType}, using default values`);
      return LJ_PARAMS.User.sigma * sigmaToRadiusFactor;
    }

    return ljParams.sigma * sigmaToRadiusFactor;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;

    // Simple arithmetic mean over the entire run
    return values.reduce((sum, value) => sum + value, 0) / values.length;
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

    // IMPORTANT: Only call the callback if the simulation completed naturally (not manually stopped)
    // This is the key fix - we need to distinguish between natural completion and manual stopping
    if (this.simulationCompleted && this.onSimulationComplete) {
      console.log(
        "Simulation completed naturally, calling completion callback"
      );
      this.onSimulationComplete();
      // Clear the callback after calling it to prevent multiple calls
      this.onSimulationComplete = null;
    }

    // Show completion notification if simulation completed naturally
    if (this.simulationCompleted) {
      this.showCompletionNotification();
    }

    return this.outputData;
  }

  public clearCompletionCallback(): void {
    this.onSimulationComplete = null;
  }

  private initializeAtomPositions(): THREE.Vector3[] {
    const atomCount = this.inputData.ModelSetupData.numAtoms;
    const volume = this.containerSize * 2;
    const atomType = this.inputData.ModelSetupData.atomType;

    // Get the sigma parameter to determine minimum safe separation
    const defaultParams = LJ_PARAMS[atomType as keyof typeof LJ_PARAMS];
    const sigma =
      this.inputData.ModelSetupData.potentialParams?.sigma ||
      defaultParams.sigma;

    // CRITICAL: Calculate minimum separation based on physics, not just visual appearance
    // For Lennard-Jones, atoms should start at least at the equilibrium distance (2^(1/6) * sigma)
    // But for initial stability, we want them even further apart
    const equilibriumDistance = Math.pow(2, 1 / 6) * sigma; // ≈ 1.12 * sigma
    const safeMinimumSeparation = equilibriumDistance * 1.5; // 50% safety margin

    console.log(
      `Initializing ${atomCount} atoms with minimum separation ${safeMinimumSeparation.toFixed(
        3
      )} (sigma=${sigma.toFixed(3)})`
    );

    // Calculate effective atomic density accounting for minimum separation requirements
    const effectiveAtomicVolume = Math.pow(safeMinimumSeparation, 3);
    const totalVolumeNeeded = atomCount * effectiveAtomicVolume;
    const availableVolume = Math.pow(volume, 3);

    console.log(
      `Volume check: need ${totalVolumeNeeded.toFixed(
        1
      )}, have ${availableVolume.toFixed(1)}, density=${(
        totalVolumeNeeded / availableVolume
      ).toFixed(3)}`
    );

    // If density is too high, we need to use a more careful placement strategy
    if (totalVolumeNeeded / availableVolume > 0.4) {
      console.log("High density detected, using careful lattice placement");
      return this.initializeHighDensityDistribution(safeMinimumSeparation);
    } else if (totalVolumeNeeded / availableVolume > 0.15) {
      console.log("Medium density detected, using liquid-like placement");
      return this.initializeMediumDensityDistribution(safeMinimumSeparation);
    } else {
      console.log("Low density detected, using gas-like placement");
      return this.initializeLowDensityDistribution(safeMinimumSeparation);
    }
  }

  private initializeLowDensityDistribution(
    minSeparation: number
  ): THREE.Vector3[] {
    const atomCount = this.inputData.ModelSetupData.numAtoms;
    const placedPositions: THREE.Vector3[] = [];

    // For low density, use random placement with collision checking
    for (let i = 0; i < atomCount; i++) {
      let position: THREE.Vector3 | null = null;
      let attempts = 0;
      const maxAttempts = 1000; // Increase attempts for better spacing

      do {
        // Use slightly smaller container to ensure we don't place atoms too close to walls
        const safeZone = 0.85;
        position = new THREE.Vector3(
          (Math.random() - 0.5) * (this.containerSize * 2 * safeZone),
          (Math.random() - 0.5) * (this.containerSize * 2 * safeZone),
          (Math.random() - 0.5) * (this.containerSize * 2 * safeZone)
        );

        attempts++;
        if (attempts > maxAttempts) {
          console.warn(
            `Could not place atom ${i} with ideal separation after ${maxAttempts} attempts`
          );
          break;
        }
      } while (
        position &&
        this.tooCloseToExistingAtoms(position, placedPositions, minSeparation)
      );

      placedPositions.push(position || this.getRandomPosition(0.8));
    }

    return placedPositions;
  }

  private initializeMediumDensityDistribution(
    minSeparation: number
  ): THREE.Vector3[] {
    // Start with a regular lattice, then add controlled random perturbations
    const latticePositions = this.createSafeLatticePlacement(
      this.inputData.ModelSetupData.numAtoms,
      minSeparation
    );

    // Add small random perturbations to break lattice artifacts
    const perturbationScale = minSeparation * 0.2; // Small perturbations (20% of minimum separation)

    for (const position of latticePositions) {
      position.x += (Math.random() - 0.5) * perturbationScale;
      position.y += (Math.random() - 0.5) * perturbationScale;
      position.z += (Math.random() - 0.5) * perturbationScale;
    }

    return latticePositions;
  }

  private initializeHighDensityDistribution(
    minSeparation: number
  ): THREE.Vector3[] {
    // For high density, we must use a careful lattice approach
    return this.createSafeLatticePlacement(
      this.inputData.ModelSetupData.numAtoms,
      minSeparation
    );
  }

  private createSafeLatticePlacement(
    numAtoms: number,
    minSeparation: number
  ): THREE.Vector3[] {
    const cellsPerSide = Math.ceil(Math.pow(numAtoms, 1 / 3));

    // Calculate the maximum spacing that fits in the container
    const availableSpace = this.containerSize * 2 * 0.95; // Use 95% to ensure margin
    const maxSpacingForContainer = availableSpace / cellsPerSide;

    // Use the spacing that fits in container, even if it's less than ideal separation
    const latticeConstant = Math.min(
      maxSpacingForContainer,
      minSeparation * 1.2
    );

    // Now create positions that will definitely fit
    const positions: THREE.Vector3[] = [];
    const offset = ((cellsPerSide - 1) * latticeConstant) / 2;

    for (let i = 0; i < cellsPerSide && positions.length < numAtoms; i++) {
      for (let j = 0; j < cellsPerSide && positions.length < numAtoms; j++) {
        for (let k = 0; k < cellsPerSide && positions.length < numAtoms; k++) {
          positions.push(
            new THREE.Vector3(
              i * latticeConstant - offset,
              j * latticeConstant - offset,
              k * latticeConstant - offset
            )
          );
        }
      }
    }

    return positions;
  }

  private tooCloseToExistingAtoms(
    position: THREE.Vector3,
    placedPositions: THREE.Vector3[],
    minSeparation: number
  ): boolean {
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
    const cellsPerSide = Math.ceil(Math.pow(cellsNeeded, 1 / 3));

    // Calculate lattice constant to fill the container
    const latticeConstant = (this.containerSize * 2) / cellsPerSide;

    // Create FCC lattice
    let atomsPlaced = 0;
    for (let i = 0; i < cellsPerSide && atomsPlaced < numAtoms; i++) {
      for (let j = 0; j < cellsPerSide && atomsPlaced < numAtoms; j++) {
        for (let k = 0; k < cellsPerSide && atomsPlaced < numAtoms; k++) {
          // FCC lattice has atoms at:
          // (0,0,0), (0,1/2,1/2), (1/2,0,1/2), (1/2,1/2,0) of each unit cell
          const baseX = (i - cellsPerSide / 2 + 0.5) * latticeConstant;
          const baseY = (j - cellsPerSide / 2 + 0.5) * latticeConstant;
          const baseZ = (k - cellsPerSide / 2 + 0.5) * latticeConstant;

          // Add the 4 atoms of the FCC unit cell
          positions.push(new THREE.Vector3(baseX, baseY, baseZ));
          atomsPlaced++;

          if (atomsPlaced < numAtoms) {
            positions.push(
              new THREE.Vector3(
                baseX,
                baseY + latticeConstant / 2,
                baseZ + latticeConstant / 2
              )
            );
            atomsPlaced++;
          }

          if (atomsPlaced < numAtoms) {
            positions.push(
              new THREE.Vector3(
                baseX + latticeConstant / 2,
                baseY,
                baseZ + latticeConstant / 2
              )
            );
            atomsPlaced++;
          }

          if (atomsPlaced < numAtoms) {
            positions.push(
              new THREE.Vector3(
                baseX + latticeConstant / 2,
                baseY + latticeConstant / 2,
                baseZ
              )
            );
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
    const position =
      this.atomPositions?.[this.atoms.length] || this.getRandomPosition(0.8);

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
      He: 0x00ffff, // Cyan
      Ne: 0xff00ff, // Magenta
      Ar: 0xff0000, // Red
      Kr: 0x00ff00, // Green
      Xe: 0x0000ff, // Blue
      User: 0xffffff, // White
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
