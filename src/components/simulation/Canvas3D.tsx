import React, { useEffect, useRef } from 'react';
import { useSimulation } from '../../hooks/useSimulation';

const Canvas3D: React.FC = () => {
  const { canvasRef, isBuilt, isRunning } = useSimulation();
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  // Set up the canvas and draw placeholder content
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      contextRef.current = canvas.getContext('2d');
      
      // Make the canvas responsive
      const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
          drawPlaceholder();
        }
      };
      
      // Initial resize
      resizeCanvas();
      
      // Listen for window resize
      window.addEventListener('resize', resizeCanvas);
      
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [canvasRef]);
  
  // Draw placeholder content based on simulation state
  useEffect(() => {
    drawPlaceholder();
  }, [isBuilt, isRunning]);
  
  // Draw placeholder content
  const drawPlaceholder = () => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    
    if (!ctx || !canvas) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set background color
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw placeholder text
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (!isBuilt) {
      ctx.fillText('Build a substance to see visualization', canvas.width / 2, canvas.height / 2);
    } else if (isRunning) {
      // Draw mock animation (just a simple circle)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.2;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(75, 150, 255, 0.6)';
      ctx.fill();
      ctx.strokeStyle = '#3366cc';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw some particles
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius * 0.8;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        const particleRadius = 5 + Math.random() * 5;
        
        ctx.beginPath();
        ctx.arc(x, y, particleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 100, 75, 0.8)';
        ctx.fill();
      }
      
      ctx.fillStyle = '#333';
      ctx.fillText('Simulation Running', centerX, centerY - radius - 20);
    } else {
      // Draw static placeholder for built but not running
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.2;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw some static particles
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const distance = radius * 0.7;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        const particleRadius = 8;
        
        ctx.beginPath();
        ctx.arc(x, y, particleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        ctx.fill();
      }
      
      ctx.fillStyle = '#333';
      ctx.fillText('Ready to Run', centerX, centerY - radius - 20);
    }
  };

  return <canvas ref={canvasRef as React.RefObject<HTMLCanvasElement>} className="w-full h-full" />;
};

export default Canvas3D;