import React from 'react';
import './FunctionButtons.css';

const FunctionButtons = ({ onFunctionSelect }) => {
  const functions = [
    { id: 'canvas', label: '画布展示' },
    { id: 'video', label: '视频分析' },
    { id: 'research', label: '深度研究' },
    { id: 'image', label: '图像处理' }
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
