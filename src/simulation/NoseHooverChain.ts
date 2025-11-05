/**
 * Nosé-Hoover Chain Thermostat Implementation
 * 
 * This class implements a chain of Nosé-Hoover thermostats for proper canonical (NVT) ensemble
 * sampling in molecular dynamics simulations, especially critical for small systems (N < 200 atoms).
 * 
 * PHYSICAL MOTIVATION:
 * ====================
 * A single Nosé-Hoover thermostat introduces a friction variable ξ that couples to the kinetic
 * energy. However, for small systems, a single thermostat is non-ergodic—it fails to sample the
 * full phase space properly. Chaining multiple thermostats solves this: thermostat 1 controls
 * the particles, thermostat 2 controls thermostat 1, etc. This cascade ensures ergodic sampling.
 * 
 * For N = 50-200 atoms, a chain length M = 3 is standard and sufficient.
 * 
 * EQUATIONS OF MOTION:
 * ====================
 * Each thermostat j in the chain has:
 *   - Position variable: ξⱼ (friction coefficient)
 *   - Velocity (momentum): pξⱼ = Qⱼ·ξ̇ⱼ where Qⱼ is the thermostat "mass"
 * 
 * The particle velocities evolve as:
 *   dv/dt = F/m - ξ̇₁·v
 * 
 * The first thermostat couples to kinetic energy:
 *   dpξ₁/dt = 2·KE - N_dof·kB·T - pξ₁·(pξ₂/Q₂)
 * 
 * Middle thermostats couple to their neighbors:
 *   dpξⱼ/dt = (pξⱼ₋₁²/Qⱼ₋₁ - kB·T) - pξⱼ·(pξⱼ₊₁/Qⱼ₊₁)
 * 
 * Last thermostat:
 *   dpξₘ/dt = (pξₘ₋₁²/Qₘ₋₁ - kB·T)
 * 
 * INTEGRATION METHOD:
 * ====================
 * We use the Suzuki-Yoshida decomposition with Nc sub-cycles per timestep (typically Nc=3-5).
 * The integration is split symmetrically:
 *   1. Update thermostat momenta (backward sweep from M to 1)
 *   2. Update thermostat positions
 *   3. Scale particle velocities by exp(-ξ̇₁·Δt)
 * 
 * This maintains time-reversibility and produces correct ensemble statistics.
 * 
 * REFERENCES:
 * ===========
 * - Martyna, Klein, Tuckerman, J. Chem. Phys. 97, 2635 (1992) - Original NH chains paper
 * - Tuckerman et al., J. Phys. A 39, 5629 (2006) - Integration algorithms
 * - Allen & Tildesley, "Computer Simulation of Liquids" (2017) - Practical implementation
 */

import * as THREE from "three";

// Physical constants
const KB_SI = 1.380649e-23; // Boltzmann constant in J/K
const NA = 6.02214076e23;   // Avogadro's number

export interface NoseHooverChainParams {
  chainLength: number;        // M: typically 3 for small systems
  targetTemperature: number;  // T₀ in Kelvin
  couplingTime: number;       // τ_T in picoseconds (typically 0.3-0.7 ps for small systems)
  degreesOfFreedom: number;   // N_dof = 3N - 3 (subtract COM motion)
  numSubcycles: number;       // Nc: number of integration sub-cycles (typically 3-5)
}

export class NoseHooverChain {
  private chainLength: number;
  private targetTemperature: number;
  private degreesOfFreedom: number;
  private numSubcycles: number;

  // Thermostat chain variables
  private xi: number[];       // ξⱼ: thermostat position variables (friction coefficients)
  private p_xi: number[];     // pξⱼ: thermostat momenta
  private Q: number[];        // Qⱼ: thermostat "masses"

  // Yoshida weights for 4th order integration (optional enhancement)
  private readonly YOSHIDA_WEIGHTS = [
    1.351207191959657,
    -1.702414383919315,
    1.351207191959657
  ];

  constructor(params: NoseHooverChainParams) {
    this.chainLength = params.chainLength;
    this.targetTemperature = params.targetTemperature;
    this.degreesOfFreedom = params.degreesOfFreedom;
    this.numSubcycles = params.numSubcycles;

    // Initialize thermostat variables to zero (equilibrium starting state)
    this.xi = new Array(this.chainLength).fill(0);
    this.p_xi = new Array(this.chainLength).fill(0);
    this.Q = new Array(this.chainLength);

    // Calculate thermostat masses using standard formula
    // Q = (N_dof · kB · T · τ_T²) / (4π²)
    // This sets the time scale for thermal equilibration
    const kB_reduced = KB_SI * NA / 1000; // Convert to kJ/mol·K units commonly used in MD
    const tau_T_fs = params.couplingTime * 1000; // Convert ps to fs
    
    // First thermostat couples to all particle degrees of freedom
    this.Q[0] = (this.degreesOfFreedom * kB_reduced * this.targetTemperature * 
                 Math.pow(tau_T_fs, 2)) / (4 * Math.PI * Math.PI);
    
    // Remaining thermostats couple to single degree of freedom (previous thermostat)
    for (let i = 1; i < this.chainLength; i++) {
      this.Q[i] = (kB_reduced * this.targetTemperature * Math.pow(tau_T_fs, 2)) / 
                  (4 * Math.PI * Math.PI);
    }
  }

  /**
   * Apply thermostat for a half-timestep
   * This method should be called twice per integration step (before and after force calculation)
   * 
   * @param velocities - Array of particle velocity vectors (will be modified in-place)
   * @param atomicMass - Mass of each particle in atomic mass units
   * @param dt - Timestep in femtoseconds
   */
  public applyThermostat(velocities: THREE.Vector3[], atomicMass: number, dt: number): void {
    if (velocities.length === 0) {
      return;
    }

    // Calculate current kinetic energy in reduced units
    // KE = (1/2) Σ m·v² 
    const kineticEnergy = this.calculateKineticEnergy(velocities, atomicMass);

    // Each sub-cycle refines the integration (improves accuracy)
    const dt_subcycle = dt / this.numSubcycles;

    for (let cycle = 0; cycle < this.numSubcycles; cycle++) {
      // STEP 1: Update thermostat momenta (backward sweep: M → 1)
      // This ordering is crucial for maintaining proper time-reversibility
      
      // Last thermostat (M) has no coupling to higher thermostats
      const kB_reduced = KB_SI * NA / 1000; // kJ/mol·K
      const G_M = (this.p_xi[this.chainLength - 2] * this.p_xi[this.chainLength - 2] / 
                   this.Q[this.chainLength - 2]) - kB_reduced * this.targetTemperature;
      this.p_xi[this.chainLength - 1] += G_M * (dt_subcycle / 4);

      // Middle thermostats (M-1 down to 2)
      for (let j = this.chainLength - 2; j >= 1; j--) {
        const G_j = (this.p_xi[j - 1] * this.p_xi[j - 1] / this.Q[j - 1]) - 
                    kB_reduced * this.targetTemperature;
        const scaling = Math.exp(-(this.p_xi[j + 1] / this.Q[j + 1]) * (dt_subcycle / 8));
        this.p_xi[j] = this.p_xi[j] * scaling + G_j * (dt_subcycle / 4) * scaling;
      }

      // First thermostat (couples to particle kinetic energy)
      // G₁ = 2·KE - N_dof·kB·T
      const G_1 = 2 * kineticEnergy - this.degreesOfFreedom * kB_reduced * this.targetTemperature;
      const scaling_1 = Math.exp(-(this.p_xi[1] / this.Q[1]) * (dt_subcycle / 8));
      this.p_xi[0] = this.p_xi[0] * scaling_1 + G_1 * (dt_subcycle / 4) * scaling_1;

      // STEP 2: Update thermostat positions
      // dξⱼ/dt = pξⱼ/Qⱼ
      for (let j = 0; j < this.chainLength; j++) {
        this.xi[j] += (this.p_xi[j] / this.Q[j]) * (dt_subcycle / 2);
      }

      // STEP 3: Scale particle velocities
      // The particles experience friction from the first thermostat
      // v(t+Δt) = v(t) · exp(-ξ̇₁·Δt)
      const friction = this.p_xi[0] / this.Q[0];
      const velocity_scaling = Math.exp(-friction * dt_subcycle);
      
      for (let i = 0; i < velocities.length; i++) {
        velocities[i].multiplyScalar(velocity_scaling);
      }

      // STEP 4: Update thermostat positions again (symmetric)
      for (let j = 0; j < this.chainLength; j++) {
        this.xi[j] += (this.p_xi[j] / this.Q[j]) * (dt_subcycle / 2);
      }

      // STEP 5: Update thermostat momenta again (forward sweep: 1 → M)
      // Recalculate kinetic energy after velocity scaling
      const kineticEnergy_new = this.calculateKineticEnergy(velocities, atomicMass);
      const G_1_new = 2 * kineticEnergy_new - 
                      this.degreesOfFreedom * kB_reduced * this.targetTemperature;
      const scaling_1_new = Math.exp(-(this.p_xi[1] / this.Q[1]) * (dt_subcycle / 8));
      this.p_xi[0] = this.p_xi[0] * scaling_1_new + G_1_new * (dt_subcycle / 4) * scaling_1_new;

      for (let j = 1; j < this.chainLength - 1; j++) {
        const G_j_new = (this.p_xi[j - 1] * this.p_xi[j - 1] / this.Q[j - 1]) - 
                        kB_reduced * this.targetTemperature;
        const scaling_j = Math.exp(-(this.p_xi[j + 1] / this.Q[j + 1]) * (dt_subcycle / 8));
        this.p_xi[j] = this.p_xi[j] * scaling_j + G_j_new * (dt_subcycle / 4) * scaling_j;
      }

      const G_M_new = (this.p_xi[this.chainLength - 2] * this.p_xi[this.chainLength - 2] / 
                       this.Q[this.chainLength - 2]) - kB_reduced * this.targetTemperature;
      this.p_xi[this.chainLength - 1] += G_M_new * (dt_subcycle / 4);
    }
  }

  /**
   * Calculate the kinetic energy of the system
   * KE = (1/2) Σᵢ m·vᵢ²
   * 
   * @param velocities - Array of particle velocity vectors
   * @param atomicMass - Mass of each particle in atomic mass units
   * @returns Kinetic energy in kJ/mol (reduced units)
   */
  private calculateKineticEnergy(velocities: THREE.Vector3[], atomicMass: number): number {
    let kineticEnergy = 0;
    
    for (const velocity of velocities) {
      const v_squared = velocity.lengthSq();
      kineticEnergy += 0.5 * atomicMass * v_squared;
    }
    
    return kineticEnergy;
  }

  /**
   * Calculate the conserved quantity (Hamiltonian) of the extended system
   * This should remain constant if the integration is working correctly
   * 
   * H = KE + PE + Σⱼ(pξⱼ²/2Qⱼ) + N_dof·kB·T·ξ₁ + kB·T·Σⱼ₌₂ᴹ ξⱼ
   * 
   * @param kineticEnergy - Current kinetic energy
   * @param potentialEnergy - Current potential energy
   * @returns The conserved quantity (useful for validation)
   */
  public calculateConservedQuantity(kineticEnergy: number, potentialEnergy: number): number {
    const kB_reduced = KB_SI * NA / 1000; // kJ/mol·K
    
    let conserved = kineticEnergy + potentialEnergy;
    
    // Add thermostat kinetic energies
    for (let j = 0; j < this.chainLength; j++) {
      conserved += 0.5 * this.p_xi[j] * this.p_xi[j] / this.Q[j];
    }
    
    // Add thermostat potential energies
    conserved += this.degreesOfFreedom * kB_reduced * this.targetTemperature * this.xi[0];
    for (let j = 1; j < this.chainLength; j++) {
      conserved += kB_reduced * this.targetTemperature * this.xi[j];
    }
    
    return conserved;
  }

  /**
   * Reset the thermostat to equilibrium state
   * Useful when starting a new simulation
   */
  public reset(): void {
    this.xi.fill(0);
    this.p_xi.fill(0);
  }

  /**
   * Get current state for diagnostics
   */
  public getState(): { xi: number[], p_xi: number[], Q: number[] } {
    return {
      xi: [...this.xi],
      p_xi: [...this.p_xi],
      Q: [...this.Q]
    };
  }

  /**
   * Update target temperature (useful for temperature ramping)
   */
  public setTargetTemperature(newTemperature: number): void {
    this.targetTemperature = newTemperature;
    
    // Recalculate thermostat masses for new temperature
    const kB_reduced = KB_SI * NA / 1000;
    const tau_T_fs = 500; // Use default coupling time
    
    this.Q[0] = (this.degreesOfFreedom * kB_reduced * this.targetTemperature * 
                 Math.pow(tau_T_fs, 2)) / (4 * Math.PI * Math.PI);
    
    for (let i = 1; i < this.chainLength; i++) {
      this.Q[i] = (kB_reduced * this.targetTemperature * Math.pow(tau_T_fs, 2)) / 
                  (4 * Math.PI * Math.PI);
    }
  }
}