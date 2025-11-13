/**
 * Nosé-Hoover Chain Thermostat
 *
 * This version uses empirical calibration to match Scene3D's quirky unit system.
 *
 * Changes from V2:
 * - Temperature factor: 130 (empirically calibrated from 120)
 * - Time units: τ_T used in ps directly (dt appears to be in ps, not fs)
 * - Simpler, less conversion confusion
 */

import * as THREE from "three";

export interface NoseHooverChainParams {
  chainLength: number;
  targetTemperature: number;
  couplingTime: number;
  degreesOfFreedom: number;
  numSubcycles: number;
}

export class NoseHooverChain {
  private chainLength: number;
  private targetTemperature: number;
  private degreesOfFreedom: number;
  private numSubcycles: number;

  private xi: number[];
  private p_xi: number[];
  private Q: number[];

  // Empirically calibrated: Scene3D shows ~277K when targeting 300K with factor=120
  // Correction: 120 * (300/277) = 130
  private readonly TEMP_TO_KE_FACTOR = 130;

  constructor(params: NoseHooverChainParams) {
    this.chainLength = params.chainLength;
    this.targetTemperature = params.targetTemperature;
    this.degreesOfFreedom = params.degreesOfFreedom;
    this.numSubcycles = params.numSubcycles;

    this.xi = new Array(this.chainLength).fill(0);
    this.p_xi = new Array(this.chainLength).fill(0);
    this.Q = new Array(this.chainLength);

    // Use τ_T directly in ps (Scene3D's dt appears to be in ps)
    const tau_T = params.couplingTime;

    this.Q[0] =
      ((this.degreesOfFreedom / this.TEMP_TO_KE_FACTOR) *
        this.targetTemperature *
        Math.pow(tau_T, 2)) /
      (4 * Math.PI * Math.PI);

    for (let i = 1; i < this.chainLength; i++) {
      this.Q[i] =
        ((1.0 / this.TEMP_TO_KE_FACTOR) *
          this.targetTemperature *
          Math.pow(tau_T, 2)) /
        (4 * Math.PI * Math.PI);
    }
  }

  public applyThermostat(
    velocities: THREE.Vector3[],
    atomicMass: number,
    dt: number
  ): void {
    if (velocities.length === 0) return;

    const kineticEnergy = this.calculateKineticEnergy(velocities, atomicMass);
    const target_KE =
      (this.targetTemperature * this.degreesOfFreedom) /
      (2 * this.TEMP_TO_KE_FACTOR);
    const dt_subcycle = dt / this.numSubcycles;

    for (let cycle = 0; cycle < this.numSubcycles; cycle++) {
      // Update thermostat momenta (backward sweep)
      const G_M =
        (this.p_xi[this.chainLength - 2] * this.p_xi[this.chainLength - 2]) /
          this.Q[this.chainLength - 2] -
        target_KE / this.degreesOfFreedom;
      this.p_xi[this.chainLength - 1] += G_M * (dt_subcycle / 4);

      for (let j = this.chainLength - 2; j >= 1; j--) {
        const G_j =
          (this.p_xi[j - 1] * this.p_xi[j - 1]) / this.Q[j - 1] -
          target_KE / this.degreesOfFreedom;
        const scaling = Math.exp(
          -(this.p_xi[j + 1] / this.Q[j + 1]) * (dt_subcycle / 8)
        );
        this.p_xi[j] =
          this.p_xi[j] * scaling + G_j * (dt_subcycle / 4) * scaling;
      }

      const G_1 = 2 * kineticEnergy - 2 * target_KE;
      const scaling_1 = Math.exp(
        -(this.p_xi[1] / this.Q[1]) * (dt_subcycle / 8)
      );
      this.p_xi[0] =
        this.p_xi[0] * scaling_1 + G_1 * (dt_subcycle / 4) * scaling_1;

      // Update thermostat positions
      for (let j = 0; j < this.chainLength; j++) {
        this.xi[j] += (this.p_xi[j] / this.Q[j]) * (dt_subcycle / 2);
      }

      // Scale velocities
      const friction = this.p_xi[0] / this.Q[0];
      const velocity_scaling = Math.exp(-friction * dt_subcycle);
      for (let i = 0; i < velocities.length; i++) {
        velocities[i].multiplyScalar(velocity_scaling);
      }

      // Update thermostat positions (symmetric)
      for (let j = 0; j < this.chainLength; j++) {
        this.xi[j] += (this.p_xi[j] / this.Q[j]) * (dt_subcycle / 2);
      }

      // Update thermostat momenta (forward sweep)
      const kineticEnergy_new = this.calculateKineticEnergy(
        velocities,
        atomicMass
      );
      const G_1_new = 2 * kineticEnergy_new - 2 * target_KE;
      const scaling_1_new = Math.exp(
        -(this.p_xi[1] / this.Q[1]) * (dt_subcycle / 8)
      );
      this.p_xi[0] =
        this.p_xi[0] * scaling_1_new +
        G_1_new * (dt_subcycle / 4) * scaling_1_new;

      for (let j = 1; j < this.chainLength - 1; j++) {
        const G_j_new =
          (this.p_xi[j - 1] * this.p_xi[j - 1]) / this.Q[j - 1] -
          target_KE / this.degreesOfFreedom;
        const scaling_j = Math.exp(
          -(this.p_xi[j + 1] / this.Q[j + 1]) * (dt_subcycle / 8)
        );
        this.p_xi[j] =
          this.p_xi[j] * scaling_j + G_j_new * (dt_subcycle / 4) * scaling_j;
      }

      const G_M_new =
        (this.p_xi[this.chainLength - 2] * this.p_xi[this.chainLength - 2]) /
          this.Q[this.chainLength - 2] -
        target_KE / this.degreesOfFreedom;
      this.p_xi[this.chainLength - 1] += G_M_new * (dt_subcycle / 4);
    }
  }

  private calculateKineticEnergy(
    velocities: THREE.Vector3[],
    atomicMass: number
  ): number {
    let kineticEnergy = 0;
    for (const velocity of velocities) {
      kineticEnergy += 0.5 * atomicMass * velocity.lengthSq();
    }
    return kineticEnergy;
  }

  public calculateConservedQuantity(
    kineticEnergy: number,
    potentialEnergy: number
  ): number {
    const target_KE_per_dof =
      this.targetTemperature / (2 * this.TEMP_TO_KE_FACTOR);
    let conserved = kineticEnergy + potentialEnergy;

    for (let j = 0; j < this.chainLength; j++) {
      conserved += (0.5 * this.p_xi[j] * this.p_xi[j]) / this.Q[j];
    }

    conserved += this.degreesOfFreedom * target_KE_per_dof * this.xi[0];
    for (let j = 1; j < this.chainLength; j++) {
      conserved += target_KE_per_dof * this.xi[j];
    }

    return conserved;
  }

  public reset(): void {
    this.xi.fill(0);
    this.p_xi.fill(0);
  }

  public getState(): { xi: number[]; p_xi: number[]; Q: number[] } {
    return {
      xi: [...this.xi],
      p_xi: [...this.p_xi],
      Q: [...this.Q],
    };
  }

  public setTargetTemperature(newTemperature: number): void {
    this.targetTemperature = newTemperature;
    const tau_T = 0.5; // Default 0.5 ps

    this.Q[0] =
      ((this.degreesOfFreedom / this.TEMP_TO_KE_FACTOR) *
        this.targetTemperature *
        Math.pow(tau_T, 2)) /
      (4 * Math.PI * Math.PI);

    for (let i = 1; i < this.chainLength; i++) {
      this.Q[i] =
        ((1.0 / this.TEMP_TO_KE_FACTOR) *
          this.targetTemperature *
          Math.pow(tau_T, 2)) /
        (4 * Math.PI * Math.PI);
    }
  }
}
