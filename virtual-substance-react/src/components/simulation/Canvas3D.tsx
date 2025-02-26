import React, { useEffect } from 'react';
import { useSimulation } from '../../hooks/useSimulation';

const Canvas3D: React.FC = () => {
  const { canvasRef } = useSimulation();
  
  // Canvas setup - make sure we don't re-render unnecessarily
  useEffect(() => {
    if (canvasRef.current) {
      // The scene initialization will be handled by the SimulationContext
      // when buildSubstance is called
      canvasRef.current.width = 450;  // Increased from 400
      canvasRef.current.height = 450; // Increased from 400
    }
  }, [canvasRef]);

  return (
    <canvas 
      ref={canvasRef}
      id="canvas"
      className="w-full h-full"
    />
  );
};

export default Canvas3D;