# Known Issues

## Critical Issues

### Simulation Control
1. **Cancel Functionality Not Working**
   - Status: Not Started
   - Description: The cancel feature in the scripts section fails to properly stop subsequent simulations
   - Current Behavior: When cancel is pressed during simulation 4/5, simulation 4 completes and simulation 5 still runs
   - Expected Behavior: Current simulation should complete, but subsequent simulations should not start

### UI/UX Issues

2. **Tab Reset on Discard**
   - Status: Not Started
   - Description: Tabs retain previous values after simulation discard
   - Current Behavior: Tabs maintain non-zero values after discarding a simulation
   - Expected Behavior: All tabs should reset to zero when simulation is discarded

3. **Simulation Completion State**
   - Status: Not Started
   - Description: Incomplete UI state after simulation completion
   - Current Behavior: 
     - Stop button remains in active state
     - "Copy to notebook" button stuck in "waiting for simulation to complete" state
     - Manual stop required to enable new notebook entries
   - Expected Behavior: UI should properly reflect completion state

## Resolved Issues

### Data Management
1. **Copy to Notebook Data Loss**
   - Status: Solved
   - Description: Copy to notebook functionality occasionally fails to populate data
   - Resolution: Fixed data population issue in notebook entries

2. **Tab Content Clearing**
   - Status: Solved
   - Description: Tab contents clearing during tab switches
   - Resolution: Implemented proper state persistence across tab switches

### Input Control
3. **Input Lock During Simulation**
   - Status: Solved
   - Description: Input fields remained editable during active simulation
   - Resolution: Implemented proper input field locking during simulation

4. **Visual State Management**
   - Status: Solved
   - Description: Canvas and button states not reflecting simulation state
   - Resolution: Added proper visual feedback for simulation states

### Visual Styling
5. **Theme Color Inconsistencies**
   - Status: Solved
   - Description: Incorrect color scheme in dark/light modes
   - Resolution: Implemented proper theme-based coloring

### Input Validation
6. **Script Input Restrictions**
   - Status: Solved
   - Description: Overly restrictive input validation in scripts tab
   - Resolution: Modified validation to allow proper input editing

### Simulation Control
7. **Script Simulation Cancellation**
   - Status: Solved
   - Description: Missing cancellation feature for long-running simulations
   - Resolution: Added cancellation functionality with proper UI feedback

### Data Processing
8. **Script Tab Functionality**
   - Status: Solved
   - Description: Incomplete simulation processing in scripts tab
   - Resolution: Implemented proper multi-run processing and data storage

### Data Display
9. **Time Information Display**
   - Status: Solved
   - Description: Incorrect time information in download previews
   - Resolution: Updated preview to show calculated simulation time

### Input Logic
10. **Atomic Mass Input Behavior**
    - Status: Solved
    - Description: Atomic type not updating with mass changes
    - Resolution: Implemented automatic atomic type update on mass change

### UI Consistency
11. **Potential Model Input States**
    - Status: Solved
    - Description: Inconsistent input field disabling
    - Resolution: Fixed disabled state for all input fields

### Feature Timing
12. **Notebook Copy Timing**
    - Status: Solved
    - Description: Premature notebook copy availability
    - Resolution: Added proper completion check before enabling copy

### UI Enhancement
13. **Help System**
    - Status: Solved
    - Description: Missing user guidance system
    - Resolution: Added help button with overlay documentation

### Visual Clarity
14. **Atom Visualization**
    - Status: Solved
    - Description: Poor atom distinction and camera positioning
    - Resolution: Added atom outlines and adjusted default camera position

### Spiral Spawning
    fix spawns

### Run behavior
    should be able to run runs consecutively with same OR DIFFERRENT parameters.
    should be able to run, change parameters, AND RUN AGAIN based on newly simulated run.