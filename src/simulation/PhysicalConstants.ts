/**
 * Physical Constants for MD Simulation
 * 
 * Unit System:
 * - Length: Ångströms (Å)
 * - Energy: Kelvin (K) via ε parameters
 * - Temperature: Kelvin (K)
 * - Mass: atomic mass units (amu)
 * - Time: picoseconds (ps)
 * - Pressure: bar
 * - Volume: Å³
 * 
 * This unit system is chosen for educational clarity and compatibility
 * with the existing codebase. For small systems (50-200 atoms), the
 * computational overhead of unit conversions is negligible.
 */

export class PhysicalConstants {
  // ========================================
  // BOLTZMANN CONSTANT
  // ========================================
  
  /**
   * Boltzmann constant in simulation units
   * Derived from temperature conversion factor: k_B = 1/120
   * 
   * This value makes the ideal gas law P*V = N*k_B*T dimensionally
   * consistent with the temperature calculation:
   * T = (2*KE / N_dof) * 120
   * 
   * Reasoning:
   * - Equipartition: KE = (1/2) * N_dof * k_B * T
   * - Substituting: T = (2*KE/N_dof) * 120
   * - Solving: k_B = 1/120
   */
  static readonly BOLTZMANN_CONSTANT = 1.0 / 120.0; // ≈ 0.008333
  
  // ========================================
  // FORCE SCALING
  // ========================================
  
  /**
   * Force scaling factor for numerical stability
   * This is NOT arbitrary - it's essential for preventing
   * integration instabilities in the Velocity Verlet scheme.
   * 
   * DO NOT MODIFY without extensive testing.
   */
  static readonly FORCE_SCALE = 0.002;
  
  // ========================================
  // LENNARD-JONES PARAMETERS
  // ========================================
  
  /**
   * Standard LJ cutoff distance (in units of σ)
   * At 2.5σ, LJ potential is ~1% of ε minimum
   * 
   * For small systems, use at least 3.0σ for better accuracy
   * or include long-range corrections (LRC)
   */
  static readonly LJ_CUTOFF_SIGMA = 2.5;
  
  /**
   * LJ potential minimum occurs at r = 2^(1/6) * σ ≈ 1.122σ
   */
  static readonly LJ_R_MIN_FACTOR = Math.pow(2, 1/6);
  
  // ========================================
  // PRESSURE CALCULATION
  // ========================================
  
  /**
   * Include long-range corrections for cutoff potentials?
   * Recommended: true for r_cut < 4.0σ
   * 
   * LRC adds ~5-15% to pressure at typical liquid densities
   */
  static readonly INCLUDE_LRC = true;
  
  // ========================================
  // SMALL SYSTEM CORRECTIONS
  // ========================================
  
  /**
   * For systems with N < 200 atoms:
   * - Enhanced fluctuations scale as 1/√N
   * - Finite-size effects contribute 5-10% uncertainty
   * - Pressure requires extensive time averaging
   */
  
  /**
   * Minimum system size for reliable pressure calculation
   * Below this, results have >10% uncertainty even with long averaging
   */
  static readonly MIN_ATOMS_FOR_RELIABLE_PRESSURE = 100;
  
  /**
   * Expected pressure fluctuation magnitude (bar) for small systems
   * This is NORMAL PHYSICS, not a bug
   */
  static getPressureFluctuationEstimate(N: number): number {
    // Empirical: σ_P ≈ 1000/√N for typical liquid LJ systems
    return 1000.0 / Math.sqrt(N);
  }
  
  // ========================================
  // ENSEMBLE PARAMETERS (DEFAULTS)
  // ========================================
  
  /**
   * Default thermostat time constant (picoseconds)
   * For small systems, use shorter values than bulk MD
   */
  static readonly DEFAULT_TAU_T = 0.5; // ps
  
  /**
   * Default barostat time constant (picoseconds)
   * Should be 5-10x larger than τ_T
   */
  static readonly DEFAULT_TAU_P = 1.0; // ps (2x ratio, can increase to 5-10x)
  
  /**
   * Default Nosé-Hoover chain length
   * For N < 200, use at least 3 for ergodicity
   */
  static readonly DEFAULT_CHAIN_LENGTH = 3;
  
  // ========================================
  // UTILITY FUNCTIONS
  // ========================================
  
  /**
   * Calculate MTK correction factor: α = 1 + 3/N_dof
   * This is CRITICAL for correct NPT ensemble
   * 
   * @param N_dof - Number of degrees of freedom (typically 3N - 3)
   * @returns MTK alpha factor
   */
  static calculateMTKAlpha(N_dof: number): number {
    return 1.0 + 3.0 / N_dof;
  }
  
  /**
   * Check if system size is adequate for pressure calculation
   * 
   * @param N - Number of atoms
   * @returns {ok: boolean, message: string}
   */
  static checkSystemSizeForPressure(N: number): {ok: boolean, message: string} {
    if (N < 50) {
      return {
        ok: false,
        message: `System too small (N=${N}). Pressure is unreliable for N<50. Consider NVT ensemble instead.`
      };
    } else if (N < this.MIN_ATOMS_FOR_RELIABLE_PRESSURE) {
      const fluctuation = this.getPressureFluctuationEstimate(N);
      return {
        ok: true,
        message: `Warning: Small system (N=${N}). Expect pressure fluctuations of ±${fluctuation.toFixed(0)} bar. Average over 1-10 ns for meaningful results.`
      };
    } else {
      return {
        ok: true,
        message: `System size adequate (N=${N}) for pressure calculation.`
      };
    }
  }
}

/**
 * Type-safe access to physical constants
 * Use this instead of magic numbers in code
 */
export const k_B = PhysicalConstants.BOLTZMANN_CONSTANT;
export const FORCE_SCALE = PhysicalConstants.FORCE_SCALE;