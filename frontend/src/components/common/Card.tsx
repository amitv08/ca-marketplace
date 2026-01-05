import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', hoverable = false, onClick }) => {
  const hoverStyles = hoverable ? 'hover:shadow-lg cursor-pointer transition-shadow duration-200' : '';

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 ${hoverStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
