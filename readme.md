# Virtual Substance React

A molecular simulation web application built with React, Three.js, and TypeScript.

## Features

- Interactive 3D visualization of atomic simulations
- Dark/light theme support
- Tabbed interface for configuration and output
- Save simulation results to IndexedDB
- Export results to CSV

## Technologies Used

- React 18
- TypeScript
- Three.js for 3D visualization
- Tailwind CSS for styling
- IndexedDB for local storage

## Project Structure

View more details in planning.md

```
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
```

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/virtual-substance-react.git
   cd virtual-substance-react
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```
   npm start
   # or
   yarn start
   ```

4. Open http://localhost:3000 in your browser

## Building for Production

```
npm run build
# or
yarn build
```

This will create a production-optimized build in the `build` directory.

## License

This project is licensed under the MIT License.