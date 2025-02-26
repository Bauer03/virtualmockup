import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { SimulationProvider } from './context/SimulationContext';
import { DataProvider } from './context/DataContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <DataProvider>
        <SimulationProvider>
          <App />
        </SimulationProvider>
      </DataProvider>
    </ThemeProvider>
  </React.StrictMode>
);