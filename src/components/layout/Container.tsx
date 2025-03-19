import React, { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
}

const Container: React.FC<ContainerProps> = ({ children }) => {
  return (
    <div
      className="flex w-[1084px] bg-white dark:bg-gray-800 p-4 rounded text-slate-800 dark:text-slate-200 gap-4 shadow-2xl relative 
                before:content-['Virtual_Substance'] before:text-3xl before:font-bold before:font-mono 
                before:absolute before:-top-12 before:left-0 before:w-full h-[650px]"
    >
      {children}
    </div>
  );
};

export default Container;