import React from 'react';
import TabSystem from '../tabs/TabSystem';
import ModelSetup from '../content/ModelSetup';
import RunDynamics from '../content/RunDynamics';
import CommandScripts from '../content/CommandScripts';
import Output from '../content/Output';
import Notebook from '../content/Notebook';
import { Tab } from '../../types/types';

const MenuLeft: React.FC = () => {
  const topTabs: Tab[] = [
    {
      id: 'model-setup',
      label: 'Model Setup',
      content: <ModelSetup />,
      materialIcon: 'settings'
    },
    {
      id: 'run-dynamics',
      label: 'Run Dynamics',
      content: <RunDynamics />,
      materialIcon: 'play_arrow'
    },
    {
      id: 'command-scripts',
      label: 'Scripts',
      content: <CommandScripts />,
      materialIcon: 'code'
    }
  ];

  const bottomTabs: Tab[] = [
    {
      id: 'output',
      label: 'Output',
      content: <Output />,
      materialIcon: 'output'
    },
    {
      id: 'notebook',
      label: 'Notebook',
      content: <Notebook />,
      materialIcon: 'edit_note'
    }
  ];

  return (
    <div className="grid gap-4">
      <div id="top-menu-container" className="bg-gray-100 dark:bg-gray-700 p-4 rounded shadow grid gap-4 content-start h-full">
        <TabSystem tabs={topTabs} />
      </div>
      <div id="bottom-menu-container" className="bg-gray-100 dark:bg-gray-700 p-4 rounded shadow grid gap-4 content-start h-full">
        <TabSystem tabs={bottomTabs} />
      </div>
    </div>
  );
};

export default MenuLeft;