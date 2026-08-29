import React from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string; // Required for accessibility
  variant?: 'ghost' | 'surface';
  size?: 'sm' | 'md' | 'lg';
}

export function IconButton({ 
  icon, 
  label, 
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props 
}: IconButtonProps) {
  return (
    <button 
      className={`${styles.iconButton} ${styles[variant]} ${styles[size]} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
}
