import React from 'react';
import Canvas3D from '../simulation/Canvas3D';
import BuildControls from '../simulation/BuildControls';

const MenuRight: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 w-[450px]">
      <div className="w-[450px] h-[450px] bg-gray-100 dark:bg-gray-700 rounded shadow">
        <Canvas3D />
      </div>
      <BuildControls />
    </div>
  );
};

export default MenuRight;