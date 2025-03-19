import React, { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
        </label>
      )}
      
      <select
        className={`appearance-none py-2 pl-3 pr-8 
                    bg-white dark:bg-gray-800 
                    text-gray-900 dark:text-gray-100
                    border border-gray-300 dark:border-gray-600
                    rounded-md shadow-sm text-sm
                    focus:outline-none focus:ring-indigo-500 focus:border-indigo-500
                    ${error ? 'border-red-500' : ''}
                    ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
};

export default Select;