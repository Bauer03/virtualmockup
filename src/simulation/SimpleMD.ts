import * as THREE from "three";

// Simplified unit system (like Turner's reduced units):
// Distance: Angstroms (Å) 
// Time: reduced time units
// Energy: reduced energy units (ε)
// Mass: relative to reference mass
// This avoids unit conversion errors

interface LJParameters {
  sigma: number;    // Å
  epsilon: number;  // relative energy units
}

// Simplified LJ parameters (reduced units)
const LJ_PARAMS_SIMPLE: Record<string, LJParameters> = {
  He: { sigma: 2.56, epsilon: 1.0 },
  Ne: { sigma: 2.75, epsilon: 3.0 },  
  Ar: { sigma: 3.4, epsilon: 8.0 },
  Kr: { sigma: 3.8, epsilon: 12.0 },
  User: { sigma: 3.4, epsilon: 8.0 }
};

// Simple mass ratios (relative to reference)
const MASS_RATIOS: Record<string, number> = {
  He: 0.1,    // Light
  Ne: 0.5,    // Medium-light  
  Ar: 1.0,    // Reference
  Kr: 2.0,    // Heavy
  User: 1.0   // Default
};

export class SimpleMD {
  // Basic simulation state
  private numAtoms: number = 0;
  private atomType: string = "Ar";
  
  // Position and motion arrays (reduced units)
  private positions: THREE.Vector3[] = [];      // Å
  private velocities: THREE.Vector3[] = [];     // reduced velocity units
  private forces: THREE.Vector3[] = [];         // reduced force units
  private masses: number[] = [];                // relative mass
  
  // Simulation box
  private boxSize: number = 20.0;  // Å (half-width)
  
  // LJ parameters for this system
  private ljParams: LJParameters;
  
  // Energy tracking
  private kineticEnergy: number = 0;    // reduced energy units
  private potentialEnergy: number = 0;  // reduced energy units
  
  constructor(atomType: string = "Ar") {
    this.atomType = atomType;
    this.ljParams = LJ_PARAMS_SIMPLE[atomType] || LJ_PARAMS_SIMPLE.Ar;
    console.log(`SimpleMD initialized for ${atomType}:`, this.ljParams);
  }
  
  // Initialize system with N atoms
  initializeSystem(numAtoms: number, boxSizeNm: number, temperature: number): void {
    this.numAtoms = numAtoms;
    this.boxSize = boxSizeNm * 10;  // Convert nm to Å
    
    console.log(`Initializing ${numAtoms} ${this.atomType} atoms in ${this.boxSize}Å box at ${temperature}K`);
    
    // Clear arrays
    this.positions = [];
    this.velocities = [];
    this.forces = [];
    this.masses = [];
    
    // Set up atoms
    const mass = MASS_RATIOS[this.atomType];
    for (let i = 0; i < numAtoms; i++) {
      this.masses.push(mass);
      this.forces.push(new THREE.Vector3(0, 0, 0));
    }
    
    // Initialize positions and velocities
    this.initializePositions();
    this.initializeVelocities(temperature);
    
    console.log("System initialized successfully");
  }
  
  // Place atoms in a simple cubic lattice
  private initializePositions(): void {
    const atomsPerSide = Math.ceil(Math.pow(this.numAtoms, 1/3));
    const spacing = (this.boxSize * 1.6) / atomsPerSide;  // Leave margin
    
    let atomIndex = 0;
    for (let i = 0; i < atomsPerSide && atomIndex < this.numAtoms; i++) {
      for (let j = 0; j < atomsPerSide && atomIndex < this.numAtoms; j++) {
        for (let k = 0; k < atomsPerSide && atomIndex < this.numAtoms; k++) {
          const x = (i - atomsPerSide/2 + 0.5) * spacing;
          const y = (j - atomsPerSide/2 + 0.5) * spacing;
          const z = (k - atomsPerSide/2 + 0.5) * spacing;
          
          this.positions.push(new THREE.Vector3(x, y, z));
          atomIndex++;
        }
      }
    }
    
    console.log(`Placed ${this.positions.length} atoms in lattice with spacing ${spacing.toFixed(1)}Å`);
  }
  
  // Initialize velocities from Maxwell-Boltzmann distribution (reduced units)
  private initializeVelocities(temperature: number): void {
    // Simple reduced unit approach: 
    // Target temperature corresponds to target kinetic energy per atom
    // KE = (1/2)mv² = (3/2)kT per atom
    // In reduced units, set velocity scale based on temperature
    
    const tempScale = Math.sqrt(temperature / 300.0);  // Scale relative to 300K
    const velocityScale = tempScale * 0.1;  // Reasonable velocity scale
    
    console.log(`Velocity scale: ${velocityScale.toFixed(3)} for T=${temperature}K`);
    
    // Generate Gaussian-distributed velocities
    for (let i = 0; i < this.numAtoms; i++) {
      const vx = this.gaussianRandom() * velocityScale;
      const vy = this.gaussianRandom() * velocityScale;
      const vz = this.gaussianRandom() * velocityScale;
      
      this.velocities.push(new THREE.Vector3(vx, vy, vz));
    }
    
    // Remove center-of-mass motion
    this.removeCenterOfMassMotion();
    
    console.log("Velocities initialized");
  }
  
  // Box-Muller method for Gaussian random numbers
  private gaussianRandom(): number {
    const u = Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  
  // Remove center-of-mass motion to conserve momentum
  private removeCenterOfMassMotion(): void {
    const comVel = new THREE.Vector3(0, 0, 0);
    
    // Calculate COM velocity
    for (const vel of this.velocities) {
      comVel.add(vel);
    }
    comVel.divideScalar(this.numAtoms);
    
    // Subtract from each atom
    for (const vel of this.velocities) {
      vel.sub(comVel);
    }
  }
  
  // Calculate forces using simple LJ potential
  calculateForces(): void {
    // Reset forces
    for (const force of this.forces) {
      force.set(0, 0, 0);
    }
    
    this.potentialEnergy = 0;
    
    const sigma = this.ljParams.sigma;
    const epsilon = this.ljParams.epsilon;
    const cutoff = 2.5 * sigma;  // Standard LJ cutoff
    
    // Calculate pairwise forces
    for (let i = 0; i < this.numAtoms; i++) {
      for (let j = i + 1; j < this.numAtoms; j++) {
        
        // Distance vector
        const dr = new THREE.Vector3().subVectors(this.positions[i], this.positions[j]);
        const r = dr.length();
        
        // Skip if beyond cutoff or too close
        if (r > cutoff || r < 0.5) continue;
        
        // LJ force calculation (standard formula)
        const sr = sigma / r;
        const sr6 = Math.pow(sr, 6);
        const sr12 = sr6 * sr6;
        
        // Force magnitude: F = 24ε/r * [2(σ/r)^12 - (σ/r)^6]
        const forceMagnitude = (24 * epsilon / r) * (2 * sr12 - sr6);
        
        // Force vector (repulsive if positive)
        const forceVec = dr.clone().normalize().multiplyScalar(forceMagnitude);
        
        // Apply Newton's third law
        this.forces[i].add(forceVec);
        this.forces[j].sub(forceVec);
        
        // Add to potential energy: U = 4ε[(σ/r)^12 - (σ/r)^6]
        this.potentialEnergy += 4 * epsilon * (sr12 - sr6);
      }
    }
  }
  
  // Simple velocity Verlet integration
  integrate(dt: number): void {
    const timeStep = dt * 0.001;  // Reduce time step for stability
    
    // Step 1: Update positions
    for (let i = 0; i < this.numAtoms; i++) {
      const mass = this.masses[i];
      const acc = this.forces[i].clone().divideScalar(mass);
      
      // x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt²
      this.positions[i].add(
        this.velocities[i].clone().multiplyScalar(timeStep)
      ).add(
        acc.clone().multiplyScalar(0.5 * timeStep * timeStep)
      );
    }
    
    // Apply boundary conditions
    this.applyBoundaryConditions();
    
    // Step 2: Calculate new forces
    const oldForces = this.forces.map(f => f.clone());
    this.calculateForces();
    
    // Step 3: Update velocities using average acceleration
    for (let i = 0; i < this.numAtoms; i++) {
      const mass = this.masses[i];
      
      // Average acceleration
      const avgAcc = oldForces[i].clone().add(this.forces[i])
        .divideScalar(2 * mass);
      
      // v(t+dt) = v(t) + <a>*dt
      this.velocities[i].add(avgAcc.clone().multiplyScalar(timeStep));
    }
    
    // Calculate kinetic energy
    this.calculateKineticEnergy();
  }
  
  // Simple wall boundary conditions
  private applyBoundaryConditions(): void {
    for (let i = 0; i < this.numAtoms; i++) {
      const pos = this.positions[i];
      const vel = this.velocities[i];
      
      // Reflect off walls with damping
      const damping = 0.95;
      
      if (Math.abs(pos.x) > this.boxSize) {
        vel.x *= -damping;
        pos.x = Math.sign(pos.x) * this.boxSize * 0.99;
      }
      if (Math.abs(pos.y) > this.boxSize) {
        vel.y *= -damping;
        pos.y = Math.sign(pos.y) * this.boxSize * 0.99;
      }
      if (Math.abs(pos.z) > this.boxSize) {
        vel.z *= -damping;
        pos.z = Math.sign(pos.z) * this.boxSize * 0.99;
      }
    }
  }
  
  // Calculate kinetic energy in reduced units
  private calculateKineticEnergy(): void {
    this.kineticEnergy = 0;
    
    for (let i = 0; i < this.numAtoms; i++) {
      const mass = this.masses[i];
      const vel2 = this.velocities[i].lengthSq();
      
      // KE = 0.5 * m * v²
      this.kineticEnergy += 0.5 * mass * vel2;
    }
  }
  
  // Calculate temperature from kinetic energy (reduced units)
  calculateTemperature(): number {
    // From equipartition theorem: (3/2)NkT = KE_total
    // In reduced units: T ∝ KE_total / N
    
    if (this.numAtoms === 0) return 0;
    
    const degreesOfFreedom = Math.max(1, 3 * this.numAtoms - 3);
    const temperature = (2 * this.kineticEnergy * 300) / degreesOfFreedom;
    
    return Math.max(0, temperature);
  }
  
  // Get current system state
  getState() {
    return {
      positions: this.positions.map(p => p.clone()),
      velocities: this.velocities.map(v => v.clone()),
      kineticEnergy: this.kineticEnergy,
      potentialEnergy: this.potentialEnergy,
      totalEnergy: this.kineticEnergy + this.potentialEnergy,
      temperature: this.calculateTemperature(),
      numAtoms: this.numAtoms
    };
  }
  
  // Method to manually set positions (for testing)
  setPositions(positions: THREE.Vector3[]): void {
    if (positions.length !== this.numAtoms) {
      throw new Error(`Expected ${this.numAtoms} positions, got ${positions.length}`);
    }
    this.positions = positions.map(p => p.clone());
  }

  // Method to scale velocities (for simple thermostat)
  scaleVelocities(scaleFactor: number): void {
    for (const vel of this.velocities) {
      vel.multiplyScalar(scaleFactor);
    }
  }

  // Method to get individual atom data (for visualization)
  getAtomData(index: number) {
    if (index < 0 || index >= this.numAtoms) {
      throw new Error(`Atom index ${index} out of range`);
    }
    
    return {
      position: this.positions[index].clone(),
      velocity: this.velocities[index].clone(),
      force: this.forces[index].clone(),
      mass: this.masses[index]
    };
  }
  
  // Update box size
  setBoxSize(newSize: number): void {
    this.boxSize = newSize * 10;  // Convert nm to Å
  }
  
  // Get box size in nm
  getBoxSize(): number {
    return this.boxSize / 10;  // Convert Å to nm
  }
}