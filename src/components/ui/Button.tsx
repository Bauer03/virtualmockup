import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: string;
  iconPosition?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  icon,
  iconPosition = 'right',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = 'flex items-center justify-center gap-2 font-medium rounded transition-colors duration-200';
  
  const variantStyles = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:bg-gray-100',
    danger: 'bg-red-500 hover:bg-red-600 text-white disabled:bg-red-300'
  };
  
  const sizeStyles = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2'
  };
  
  const disabledStyles = props.disabled ? 'cursor-not-allowed opacity-70' : '';
  
  const buttonStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`;

  return (
    <button className={buttonStyles} {...props}>
      {icon && iconPosition === 'left' && (
        <span className="material-icons text-sm">{icon}</span>
      )}
      
      {children}
      
      {icon && iconPosition === 'right' && (
        <span className="material-icons text-sm">{icon}</span>
      )}
    </button>
  );
};

export default Button;