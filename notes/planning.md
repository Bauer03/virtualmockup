### Initial Project Structure
 - Post rewrite, w help from mr claude/cursor

## General:

virtual-substance-react/
├── public/                  # Static assets
├── src/                     # Source code
│   ├── components/          # React components
│   │   ├── layout/          # Layout components
│   │   ├── tabs/            # Tab system components
│   │   ├── ui/              # UI components
│   │   ├── simulation/      # Simulation components
│   │   └── content/         # Tab content components
│   ├── hooks/               # Custom React hooks
│   ├── context/             # React context for state management
│   ├── services/            # Service classes
│   ├── utils/               # Utility functions
│   ├── simulation/          # Simulation logic and 3D scene
│   ├── types/               # TypeScript type definitions
│   ├── App.tsx              # Main App component
│   ├── index.tsx            # Entry point
│   └── index.css            # Global styles
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies and scripts

## Detailed:

virtual-substance-react/
├── notes/
│   ├── issues.md
│   ├── mcneil.md
│   └── planning.md
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Container.tsx
│   │   │   ├── MenuLeft.tsx
│   │   │   └── MenuRight.tsx
│   │   ├── tabs/
│   │   │   ├── TabSystem.tsx
│   │   │   └── TabContent.tsx
│   │   ├── ui/
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── Button.tsx
│   │   │   └── Select.tsx
│   │   ├── simulation/
│   │   │   ├── Canvas3D.tsx
│   │   │   ├── BuildControls.tsx
│   │   │   └── SimulationControls.tsx
│   │   └── content/
│   │       ├── ModelSetup.tsx
│   │       ├── RunDynamics.tsx
│   │       ├── CommandScripts.tsx
│   │       ├── Output.tsx
│   │       ├── Notebook.tsx
│   │       └── PotentialParameters.tsx
│   ├── hooks/
│   │   ├── useTheme.ts
│   │   ├── useSimulation.ts
│   │   └── useDatabase.ts
│   ├── context/
│   │   ├── ThemeContext.tsx
│   │   ├── SimulationContext.tsx
│   │   └── DataContext.tsx
│   ├── services/
│   │   ├── DatabaseService.ts
│   │   └── ExportService.ts
│   ├── utils/
│   │   ├── wait.ts
│   │   └── helpers.ts
│   ├── simulation/
│   │   ├── Scene3D.ts
│   │   └── SimulationManager.ts
│   ├── types/
│   │   └── types.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── index.css
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md