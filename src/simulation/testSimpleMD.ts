import * as THREE from "three";
import { SimpleMD } from "./SimpleMD";

export class TestSimpleMD {
  private md: SimpleMD;
  private timeStep: number = 1.0; // 1 femtosecond
  private currentStep: number = 0;

  constructor() {
    this.md = new SimpleMD("Ar"); // Start with Argon
  }

  // Test 1: Two-atom system (should oscillate)
  testTwoAtoms(): void {
    console.log("=== Testing Two-Atom System ===");

    // Initialize 2 atoms in a small box at room temperature
    this.md.initializeSystem(2, 2.0, 300); // 2 atoms, 2nm box, 300K

    console.log("Initial state:", this.md.getState());

    // Run for 100 steps and track energy
    const energyHistory: number[] = [];

    for (let step = 0; step < 100; step++) {
      this.md.calculateForces();
      this.md.integrate(this.timeStep);

      const state = this.md.getState();
      energyHistory.push(state.totalEnergy);

      // Log every 20 steps
      if (step % 20 === 0) {
        console.log(`Step ${step}:`, {
          temp: state.temperature.toFixed(1),
          totalE: state.totalEnergy.toFixed(3),
          kineticE: state.kineticEnergy.toFixed(3),
          potentialE: state.potentialEnergy.toFixed(3),
        });
      }
    }

    // Check energy conservation
    const initialEnergy = energyHistory[0];
    const finalEnergy = energyHistory[energyHistory.length - 1];
    const energyDrift =
      Math.abs(finalEnergy - initialEnergy) / Math.abs(initialEnergy);

    console.log(
      `Energy conservation: ${(energyDrift * 100).toFixed(3)}% drift`
    );

    if (energyDrift < 0.01) {
      console.log("✅ PASS: Energy conserved within 1%");
    } else {
      console.log("❌ FAIL: Energy drift too large");
    }
  }

  // Test 2: Temperature equilibration
  testTemperatureEquilibration(): void {
    console.log("\n=== Testing Temperature Equilibration ===");

    // Initialize 8 atoms at high temperature
    this.md.initializeSystem(8, 3.0, 600); // 8 atoms, 3nm box, 600K

    const targetTemp = 300; // Target temperature
    const tempHistory: number[] = [];

    // Run simulation and apply simple velocity scaling thermostat
    for (let step = 0; step < 200; step++) {
      this.md.calculateForces();
      this.md.integrate(this.timeStep);

      const state = this.md.getState();
      tempHistory.push(state.temperature);

      // Simple thermostat: scale velocities every 10 steps
      if (step % 10 === 0 && step > 0) {
        this.applySimpleThermostat(targetTemp);
      }

      // Log every 50 steps
      if (step % 50 === 0) {
        console.log(
          `Step ${step}: T = ${state.temperature.toFixed(
            1
          )}K (target: ${targetTemp}K)`
        );
      }
    }

    // Check final temperature
    const finalTemp = tempHistory[tempHistory.length - 1];
    const tempError = Math.abs(finalTemp - targetTemp) / targetTemp;

    console.log(`Final temperature: ${finalTemp.toFixed(1)}K`);

    if (tempError < 0.1) {
      console.log("PASS: Temperature equilibrated within 10%");
    } else {
      console.log("FAIL: Temperature equilibration failed");
    }
  }

  // Simple velocity scaling thermostat for testing
  private applySimpleThermostat(targetTemp: number): void {
    const state = this.md.getState();
    const currentTemp = state.temperature;

    if (currentTemp > 0) {
      const scaleFactor = Math.sqrt(targetTemp / currentTemp);
      this.md.scaleVelocities(scaleFactor);
      console.log(`Scaling velocities by ${scaleFactor.toFixed(3)}`);
    }
  }

  // Test 3: Force calculation accuracy
  testForceCalculation(): void {
    console.log("\n=== Testing Force Calculation ===");

    // Place two atoms at known distance and check force
    this.md.initializeSystem(2, 5.0, 0); // 2 atoms, large box, zero temperature

    // Manually set positions for known configuration
    // We need access to positions - this shows we need getter/setter methods
    const state = this.md.getState();
    console.log("Two atoms separated by known distance");
    console.log("Initial positions:", state.positions);

    this.md.calculateForces();
    const newState = this.md.getState();

    console.log("Potential energy:", newState.potentialEnergy.toFixed(3), "aJ");

    // For two Ar atoms at equilibrium distance (~3.8 Å), PE should be close to -ε
    // Turner's ε for Ar = 2.189 aJ
    console.log("Expected PE at equilibrium: ~-2.189 aJ");
  }

  // Add this method to TestSimpleMD.ts (before runAllTests())
  testCloseAtoms(): void {
    console.log("\n=== Testing Close Atoms (Should Interact) ===");

    // Initialize 2 atoms in a SMALL box so they're forced close together
    this.md.initializeSystem(2, 0.8, 300); // 2 atoms, 0.8nm box (8Å), 300K

    // Manually place atoms close to each other for guaranteed interaction
    const closePositions = [
      new THREE.Vector3(-2.0, 0, 0), // 2Å left of center
      new THREE.Vector3(2.0, 0, 0), // 2Å right of center
    ];
    this.md.setPositions(closePositions);

    console.log("Placed atoms 4Å apart (should interact since cutoff = 8.5Å)");

    // Calculate forces and check for interaction
    this.md.calculateForces();
    const state = this.md.getState();

    console.log("Results:", {
      separation: "4.0Å",
      potentialEnergy: state.potentialEnergy.toFixed(3),
      temperature: state.temperature.toFixed(1),
    });

    if (Math.abs(state.potentialEnergy) > 0.001) {
      console.log("✅ PASS: Atoms are interacting (non-zero potential energy)");
    } else {
      console.log("❌ FAIL: No interaction detected");
    }

    // Run a few steps to see if they move
    for (let step = 0; step < 5; step++) {
      this.md.integrate(1.0);
      const newState = this.md.getState();

      if (step === 0 || step === 4) {
        console.log(
          `Step ${step}: PE=${newState.potentialEnergy.toFixed(
            3
          )}, KE=${newState.kineticEnergy.toFixed(3)}`
        );
      }
    }
  }

  // Run all tests
runAllTests(): void {
  console.log("Starting SimpleMD Tests...\n");
  
  try {
    this.testTwoAtoms();
    this.testTemperatureEquilibration(); 
    this.testCloseAtoms();  // Add this line
    this.testForceCalculation();
    
    console.log("\n=== All Tests Complete ===");
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}
}

// Function to run tests from browser console
export function runMDTests(): void {
  const tester = new TestSimpleMD();
  tester.runAllTests();
}
