import React from 'react';
import { useTheme } from '../../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      className="material-icons absolute shadow-sm -top-14 right-0 text-3xl bg-white dark:bg-gray-800
        rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors 
        duration-200 h-10 w-10 flex items-center justify-center"
    >
      {theme === 'dark' ? 'light_mode' : 'dark_mode'}
    </button>
  );
};

export default ThemeToggle;