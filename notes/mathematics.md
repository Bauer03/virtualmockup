# Mathematics of Molecular Dynamics Simulations

## 1. Core Equations of Motion

The foundation of MD is Newton's second law:

$$
\mathbf{F}_i = m_i\mathbf{a}_i = m_i\frac{d^2\mathbf{r}_i}{dt^2}
$$

Where:
- $\mathbf{F}_i$ is the force on particle $i$
- $m_i$ is the mass of particle $i$
- $\mathbf{a}_i$ is its acceleration
- $\mathbf{r}_i$ is its position vector

## 2. Potential Energy Functions

Forces are calculated as the negative gradient of potential energy:

$$
\mathbf{F}_i = -\nabla_i V(\mathbf{r}_1, \mathbf{r}_2, ..., \mathbf{r}_N)
$$

### 2.1. Non-bonded Interactions

#### Lennard-Jones Potential (van der Waals)

$$
V_{LJ}(r) = 4\epsilon \left[ \left(\frac{\sigma}{r}\right)^{12} - \left(\frac{\sigma}{r}\right)^6 \right]
$$

Where:
- $\epsilon$ is the depth of the potential well
- $\sigma$ is the distance at which the potential is zero
- $r$ is the distance between particles

#### Coulomb Potential (Electrostatics)

$$
V_C(r) = \frac{1}{4\pi\epsilon_0}\frac{q_i q_j}{r}
$$

Where:
- $q_i$ and $q_j$ are charges of particles $i$ and $j$
- $\epsilon_0$ is the permittivity of free space

### 2.2. Bonded Interactions

#### Bond Stretching (Harmonic Potential)

$$
V_{bond}(r) = \frac{1}{2}k_b(r - r_0)^2
$$

#### Angle Bending

$$
V_{angle}(\theta) = \frac{1}{2}k_\theta(\theta - \theta_0)^2
$$

#### Dihedral (Torsional) Potential

$$
V_{dihedral}(\phi) = \sum_{n=0}^n k_n[1 + \cos(n\phi - \gamma_n)]
$$

## 3. Numerical Integration Methods

### 3.1. Verlet Algorithm

$$
\mathbf{r}(t + \Delta t) = 2\mathbf{r}(t) - \mathbf{r}(t - \Delta t) + \mathbf{a}(t)\Delta t^2 + O(\Delta t^4)
$$

### 3.2. Velocity Verlet Algorithm

$$
\mathbf{r}(t + \Delta t) = \mathbf{r}(t) + \mathbf{v}(t)\Delta t + \frac{1}{2}\mathbf{a}(t)\Delta t^2
$$

$$
\mathbf{v}(t + \Delta t) = \mathbf{v}(t) + \frac{1}{2}[\mathbf{a}(t) + \mathbf{a}(t + \Delta t)]\Delta t
$$

### 3.3. Leap-frog Algorithm

$$
\mathbf{v}(t + \frac{\Delta t}{2}) = \mathbf{v}(t - \frac{\Delta t}{2}) + \mathbf{a}(t)\Delta t
$$

$$
\mathbf{r}(t + \Delta t) = \mathbf{r}(t) + \mathbf{v}(t + \frac{\Delta t}{2})\Delta t
$$

## 4. Periodic Boundary Conditions

To simulate bulk properties with finite systems, we use periodic boundary conditions:

$$
\mathbf{r}_{image} = \mathbf{r} + n_x L_x\mathbf{i} + n_y L_y\mathbf{j} + n_z L_z\mathbf{k}
$$

Where:
- $L_x, L_y, L_z$ are box dimensions
- $n_x, n_y, n_z$ are integers

## 5. Temperature and Pressure Control

### 5.1. Berendsen Thermostat

$$
\frac{d\mathbf{v}_i}{dt} = \mathbf{a}_i - \gamma(\mathbf{v}_i - \mathbf{v}_i^{bath})
$$

Where:
- $\gamma$ is a coupling parameter
- $\mathbf{v}_i^{bath}$ is the velocity the particle would have at the bath temperature

### 5.2. Nosé-Hoover Thermostat

Introduces an additional degree of freedom $\xi$ with dynamics:

$$
\frac{d\xi}{dt} = \frac{1}{Q}\left(\sum_{i=1}^N m_i\mathbf{v}_i^2 - 3Nk_BT\right)
$$

Where:
- $Q$ is the "mass" of the thermostat
- $T$ is the target temperature

## 6. Constraint Algorithms

### SHAKE Algorithm

Uses Lagrange multipliers to enforce constraints:

$$
\mathbf{r}_i(t + \Delta t) = \mathbf{r}_i^*(t + \Delta t) + \frac{\Delta t^2}{2m_i}\sum_j \lambda_{ij}\nabla_i\sigma_{ij}
$$

Where:
- $\mathbf{r}_i^*$ is the unconstrained position
- $\lambda_{ij}$ are Lagrange multipliers
- $\sigma_{ij}$ are constraint functions 