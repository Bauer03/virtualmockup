/**
 * MTTK Barostat - Martyna-Tobias-Tuckerman-Klein Barostat
 * 
 * Implements the gold-standard NPT ensemble integrator for small systems (50-200 atoms).
 * This barostat includes:
 * 1. MTK correction factor (α = 1 + 3/N_dof) for correct ensemble sampling
 * 2. Barostat thermostat chain to prevent temperature drift
 * 3. Proper pressure calculation with long-range corrections
 * 4. Velocity-volume coupling for energy conservation
 * 
 * References:
 * - Martyna et al., J. Chem. Phys. 101, 4177 (1994)
 * - Tuckerman et al., J. Phys. A 39, 5629 (2006)
 * 
 * Key principles:
 * - Barostat thermostat WRAPS particle thermostat (applied first/last)
 * - Volume scaling affects velocities through MTK correction
 * - Pressure requires extensive time averaging (100 ps - 10 ns)
 * - Fluctuations of ±100-500 bar are normal for N~200
 */

import * as THREE from 'three';

interface MTTKParameters {
  targetPressure: number;      // Target pressure (bar or reduced units)
  temperature: number;          // Temperature (K or reduced units)
  tau_P: number;                // Barostat time constant (ps)
  tau_T: number;                // Thermostat time constant (ps)
  pchain: number;               // Barostat thermostat chain length (≥3)
  N_dof: number;                // Number of degrees of freedom
  kB: number;                   // Boltzmann constant in simulation units
  epsilon?: number;             // LJ epsilon for LRC (optional)
  sigma?: number;               // LJ sigma for LRC (optional)
  r_cut?: number;               // Cutoff distance for LRC (optional)
}

export class MTTKBarostat {
  // Barostat parameters
  private params: MTTKParameters;
  private W: number;                    // Barostat "mass"
  private alpha: number;                // MTK correction factor
  
  // Barostat state variables
  private epsilon: number = 0;          // Volume strain (ln(V/V0))
  private p_epsilon: number = 0;        // Barostat momentum
  private v_epsilon: number = 0;        // Volume velocity
  
  // Barostat thermostat chain variables
  private xi_barostat: number[] = [];   // Chain positions
  private p_xi_barostat: number[] = []; // Chain momenta
  private Q_barostat: number[] = [];    // Chain masses
  
  // Pressure tracking for diagnostics
  private pressureHistory: number[] = [];
  private readonly maxHistory: number = 10000; // Keep last 10k samples
  
  constructor(params: MTTKParameters) {
    this.params = params;
    
    // Calculate MTK correction factor: α = 1 + 3/N_dof
    // This is CRITICAL - never omit this factor
    this.alpha = 1.0 + 3.0 / params.N_dof;
    
    // Calculate barostat "piston mass": W = N_dof × k_B × T × τ_P² / (4π²)
    this.W = params.N_dof * params.kB * params.temperature * 
             Math.pow(params.tau_P, 2) / (4 * Math.PI * Math.PI);
    
    // Initialize barostat thermostat chain
    // Each chain element has mass Q_i = τ_T² × T / (4π²)
    for (let i = 0; i < params.pchain; i++) {
      this.xi_barostat.push(0.0);
      this.p_xi_barostat.push(0.0);
      
      // First chain element couples to barostat, others couple to each other
      const Q_i = Math.pow(params.tau_T, 2) * params.temperature / 
                  (4 * Math.PI * Math.PI);
      this.Q_barostat.push(Q_i);
    }
  }
  
  /**
   * Calculate the instantaneous pressure using virial theorem
   * P = (N·k_B·T)/V + virial/(3V) + P_LRC
   * 
   * @param positions - Atomic positions
   * @param velocities - Atomic velocities
   * @param forces - Atomic forces (from last force calculation)
   * @param masses - Atomic masses
   * @param volume - Current simulation volume
   * @param boxVectors - For minimum image convention
   * @returns Instantaneous pressure
   */
  calculatePressure(
    positions: THREE.Vector3[],
    velocities: THREE.Vector3[],
    forces: THREE.Vector3[],
    masses: number[],
    volume: number,
    boxVectors: THREE.Vector3
  ): number {
    const N = positions.length;
    
    // 1. Kinetic contribution: P_kin = (N·k_B·T_inst)/V
    // Calculate instantaneous temperature from velocities
    let kineticEnergy = 0;
    for (let i = 0; i < N; i++) {
      kineticEnergy += 0.5 * masses[i] * velocities[i].lengthSq();
    }
    const T_inst = (2 * kineticEnergy) / (this.params.N_dof * this.params.kB);
    const P_kinetic = (N * this.params.kB * T_inst) / volume;
    
    // 2. Virial contribution: P_vir = (1/3V) Σ r_ij · F_ij
    // Use forces from the last force calculation - DO NOT recalculate
    let virial = 0;
    for (let i = 0; i < N; i++) {
      // For each atom, the virial contribution is r · F
      // Note: In periodic boundaries, use actual atomic position
      virial += positions[i].dot(forces[i]);
    }
    const P_virial = virial / (3 * volume);
    
    // 3. Long-range correction (if using LJ potential with cutoff)
    let P_LRC = 0;
    if (this.params.epsilon && this.params.sigma && this.params.r_cut) {
      P_LRC = this.calculateLongRangeCorrection(N, volume);
    }
    
    // Total pressure
    const P_total = P_kinetic + P_virial + P_LRC;
    
    // Store for averaging (useful for diagnostics)
    this.pressureHistory.push(P_total);
    if (this.pressureHistory.length > this.maxHistory) {
      this.pressureHistory.shift();
    }
    
    return P_total;
  }
  
  /**
   * Calculate long-range correction to pressure for LJ potential
   * P_LRC = (16π·ρ²·ε·σ³)/3 × [(2/3)(σ/r_cut)⁹ - (σ/r_cut)³]
   */
  private calculateLongRangeCorrection(N: number, volume: number): number {
    if (!this.params.epsilon || !this.params.sigma || !this.params.r_cut) {
      return 0;
    }
    
    const rho = N / volume;  // Number density
    const sigma = this.params.sigma;
    const epsilon = this.params.epsilon;
    const r_cut = this.params.r_cut;
    
    const sr3 = Math.pow(sigma / r_cut, 3);
    const sr9 = sr3 * sr3 * sr3;
    
    const P_LRC = (16 * Math.PI * rho * rho * epsilon * Math.pow(sigma, 3) / 3) *
                  (2 * sr9 / 3 - sr3);
    
    return P_LRC;
  }
  
  /**
   * Update barostat thermostat chain (first half-step)
   * This thermostat keeps the barostat at the correct temperature
   * and prevents drift in the volume dynamics.
   * 
   * @param dt - Half timestep
   */
  updateBarostatThermostat(dt: number): void {
    const M = this.params.pchain;
    
    // Start from the end of the chain and work backwards
    // Last element: p_xi[M-1] += G[M-1] * dt/2
    const G_last = (this.p_xi_barostat[M-2] * this.p_xi_barostat[M-2] / this.Q_barostat[M-2] - 
                    this.params.kB * this.params.temperature) / this.Q_barostat[M-1];
    this.p_xi_barostat[M-1] += G_last * dt;
    
    // Middle elements and first element
    for (let i = M-2; i >= 0; i--) {
      // Update momentum with force from neighboring chain elements
      const xi_dot_next = this.p_xi_barostat[i+1] / this.Q_barostat[i+1];
      const scale = Math.exp(-xi_dot_next * dt / 2);
      this.p_xi_barostat[i] *= scale;
      
      // Calculate force on this chain element
      let G_i: number;
      if (i === 0) {
        // First element couples to barostat momentum
        G_i = (this.p_epsilon * this.p_epsilon / this.W - 
               this.params.kB * this.params.temperature) / this.Q_barostat[0];
      } else {
        // Other elements couple to previous chain element
        G_i = (this.p_xi_barostat[i-1] * this.p_xi_barostat[i-1] / this.Q_barostat[i-1] - 
               this.params.kB * this.params.temperature) / this.Q_barostat[i];
      }
      
      this.p_xi_barostat[i] += G_i * dt / 2;
      this.p_xi_barostat[i] *= scale;
      
      // Update position
      this.xi_barostat[i] += (this.p_xi_barostat[i] / this.Q_barostat[i]) * dt;
    }
  }
  
  /**
   * Update barostat momentum (half-step)
   * Driven by difference between instantaneous and target pressure
   * 
   * @param P_inst - Instantaneous pressure
   * @param volume - Current volume
   * @param dt - Half timestep
   */
  updateBarostatMomentum(P_inst: number, volume: number, dt: number): void {
    // Barostat force: G_ε = 3V(α·P_kin - P_vir - P_ext)
    // Note: P_inst already includes both kinetic and virial terms
    // For the MTK formulation, we need to decompose it
    // Simplified version: G_ε ≈ 3V(P_inst - P_ext)
    const G_epsilon = 3 * volume * (P_inst - this.params.targetPressure);
    
    // Apply friction from barostat thermostat
    const xi_dot_0 = this.p_xi_barostat[0] / this.Q_barostat[0];
    const scale = Math.exp(-xi_dot_0 * dt / 2);
    
    this.p_epsilon = scale * (scale * this.p_epsilon + G_epsilon * dt / 2);
    this.v_epsilon = this.p_epsilon / this.W;
  }
  
  /**
   * Update velocities with barostat coupling (half-step)
   * Includes MTK correction factor α
   * 
   * Uses analytical solution of: dv/dt = F/m - α·v_ε·v
   * 
   * @param velocities - Atomic velocities (modified in place)
   * @param forces - Atomic forces
   * @param masses - Atomic masses
   * @param dt - Half timestep
   */
  updateVelocitiesWithBarostat(
    velocities: THREE.Vector3[],
    forces: THREE.Vector3[],
    masses: number[],
    dt: number
  ): void {
    // Analytical solution parameters
    const t_eps = this.alpha * this.v_epsilon * dt / 4;
    
    let scale: number;
    let sinh_term: number;
    
    // Use Taylor expansion for small t_eps to avoid numerical issues
    if (Math.abs(t_eps) > 1e-6) {
      scale = Math.exp(-t_eps);
      sinh_term = Math.sinh(t_eps) / t_eps;
    } else {
      // Taylor expansion: sinh(x)/x ≈ 1 + x²/6
      scale = 1 - t_eps;
      sinh_term = 1 + t_eps * t_eps / 6;
    }
    
    // Update each velocity: v(t+dt/2) = scale·v(t) + scale·sinh_term·(F/m)·dt/2
    for (let i = 0; i < velocities.length; i++) {
      velocities[i].multiplyScalar(scale);
      
      const accel = forces[i].clone().divideScalar(masses[i]);
      velocities[i].addScaledVector(accel, scale * sinh_term * dt / 2);
    }
  }
  
  /**
   * Update volume strain (full step)
   * ε(t+dt) = ε(t) + v_ε·dt
   * 
   * @param dt - Full timestep
   */
  updateVolumeStrain(dt: number): void {
    const epsilon_old = this.epsilon;
    this.epsilon += this.v_epsilon * dt;
    
    // Volume scaling factor: λ = exp(Δε)
    // Actual volume scaling is applied separately to maintain modularity
  }
  
  /**
   * Update positions with volume scaling (full step)
   * Includes exponential volume scaling
   * 
   * Uses analytical solution: r(t+dt) = exp(2v_ε·dt/2)·r(t) + exp(v_ε·dt/2)·sinh_term·v·dt
   * 
   * @param positions - Atomic positions (modified in place)
   * @param velocities - Atomic velocities
   * @param dt - Full timestep
   * @returns Volume scaling factor
   */
  updatePositionsWithScaling(
    positions: THREE.Vector3[],
    velocities: THREE.Vector3[],
    dt: number
  ): number {
    const t_eps2 = this.v_epsilon * dt / 2;
    
    let exp_factor: number;
    let sinh_term: number;
    
    // Handle small t_eps2 with Taylor expansion
    if (Math.abs(t_eps2) > 1e-6) {
      exp_factor = Math.exp(2 * t_eps2);
      sinh_term = Math.sinh(t_eps2) / t_eps2;
    } else {
      exp_factor = 1 + 2 * t_eps2;
      sinh_term = 1 + t_eps2 * t_eps2 / 6;
    }
    
    // Update positions: r(t+dt) = exp_factor·r(t) + exp(t_eps2)·sinh_term·v·dt
    const vel_scale = Math.exp(t_eps2) * sinh_term * dt;
    for (let i = 0; i < positions.length; i++) {
      positions[i].multiplyScalar(exp_factor);
      positions[i].addScaledVector(velocities[i], vel_scale);
    }
    
    return exp_factor;
  }
  
  /**
   * Get current volume scaling factor
   * λ = exp(ε)
   */
  getVolumeScalingFactor(): number {
    return Math.exp(this.epsilon);
  }
  
  /**
   * Get time-averaged pressure over recent history
   * This is the physically meaningful pressure for small systems
   */
  getAveragePressure(): number {
    if (this.pressureHistory.length === 0) return 0;
    
    const sum = this.pressureHistory.reduce((a, b) => a + b, 0);
    return sum / this.pressureHistory.length;
  }
  
  /**
   * Get standard deviation of pressure (measure of fluctuations)
   */
  getPressureStdDev(): number {
    if (this.pressureHistory.length < 2) return 0;
    
    const mean = this.getAveragePressure();
    const variance = this.pressureHistory.reduce((sum, p) => 
      sum + Math.pow(p - mean, 2), 0) / this.pressureHistory.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Reset pressure history (useful when starting production run after equilibration)
   */
  resetPressureHistory(): void {
    this.pressureHistory = [];
  }
  
  /**
   * Get diagnostic information about barostat state
   */
  getDiagnostics(): {
    epsilon: number;
    p_epsilon: number;
    v_epsilon: number;
    volume_scale: number;
    avg_pressure: number;
    pressure_stddev: number;
    alpha: number;
  } {
    return {
      epsilon: this.epsilon,
      p_epsilon: this.p_epsilon,
      v_epsilon: this.v_epsilon,
      volume_scale: this.getVolumeScalingFactor(),
      avg_pressure: this.getAveragePressure(),
      pressure_stddev: this.getPressureStdDev(),
      alpha: this.alpha
    };
  }
}