// Define realistic Lennard-Jones parameters for each atom type
export const LJ_PARAMS = {
  He: { sigma: 2.28, epsilon: 10.2 }, // these have been changed based on dr mcneil
  Ne: { sigma: 2.72, epsilon: 47 },
  Ar: { sigma: 3.4, epsilon: 123 },
  Kr: { sigma: 3.83, epsilon: 164 },
  Xe: { sigma: 3.98, epsilon: 164 }, // wrong, but doesn't matter right now.
  User: { sigma: 3.4, epsilon: 1.0 }, // random value
};

// Parameters for Soft Sphere potential (typically use the same sigma but different epsilon)
export const SS_PARAMS = {
  He: { sigma: 2.56, epsilon: 5.1 }, // Half the LJ epsilon
  Ne: { sigma: 2.75, epsilon: 0.155 }, // THESE MIGHT ALL BE WRONG OTHER THAN He
  Ar: { sigma: 3.40, epsilon: 0.5 },
  Kr: { sigma: 3.65, epsilon: 0.71 },
  Xe: { sigma: 3.98, epsilon: 0.885 },
  User: { sigma: 3.40, epsilon: 0.5 }
};