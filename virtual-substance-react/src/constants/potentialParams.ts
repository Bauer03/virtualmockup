// Define realistic Lennard-Jones parameters for each atom type
export const LJ_PARAMS = {
  He: { sigma: 2.56, epsilon: 0.084 },
  Ne: { sigma: 2.75, epsilon: 0.31 },
  Ar: { sigma: 3.40, epsilon: 1.00 },
  Kr: { sigma: 3.65, epsilon: 1.42 },
  Xe: { sigma: 3.98, epsilon: 1.77 },
  User: { sigma: 3.40, epsilon: 1.00 } // Default to Argon values
};

// Parameters for Soft Sphere potential (typically use the same sigma but different epsilon)
export const SS_PARAMS = {
  He: { sigma: 2.56, epsilon: 0.042 }, // Half the LJ epsilon
  Ne: { sigma: 2.75, epsilon: 0.155 },
  Ar: { sigma: 3.40, epsilon: 0.5 },
  Kr: { sigma: 3.65, epsilon: 0.71 },
  Xe: { sigma: 3.98, epsilon: 0.885 },
  User: { sigma: 3.40, epsilon: 0.5 } // Default to Argon values
};