import React from 'react';
import './FunctionButtons.css';

const FunctionButtons = ({ onFunctionSelect }) => {
  const functions = [
    { id: 'canvas', label: '画布展示' }
  ];

  return (
    <div className="function-buttons">
      {functions.map(func => (
        <button
          key={func.id}
          className="function-button"
          onClick={() => onFunctionSelect(func.id)}
        >
          {func.label}
        </button>
      ))}
    </div>
  );
};

export default FunctionButtons;
