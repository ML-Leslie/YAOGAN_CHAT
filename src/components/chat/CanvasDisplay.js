import React, { useState } from 'react';
import Canvas from '../Canvas';
import ImageCanvas from '../ImageCanvas';
import './CanvasDisplay.css';

const CanvasDisplay = ({ width, height, onClose }) => {
  const [canvasMode, setCanvasMode] = useState('basic'); // 'basic' 或 'image'

  return (
    <div className="canvas-display">
      <div className="canvas-header">
        <h2>遥感图像标记工具</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="canvas-content">
        {canvasMode === 'basic' ? (
          <Canvas width={width} height={height} />
        ) : (
          <ImageCanvas width={width} height={height} />
        )}
      </div>
      
      <div className="canvas-controls">
        <button 
          className={`canvas-mode-button ${canvasMode === 'basic' ? 'active' : ''}`}
          onClick={() => setCanvasMode('basic')}
        >
          基础画布
        </button>
        <button 
          className={`canvas-mode-button ${canvasMode === 'image' ? 'active' : ''}`}
          onClick={() => setCanvasMode('image')}
        >
          图像画布
        </button>
      </div>
      
      <div className="canvas-helper">
        <h3>标记指南</h3>
        <p>使用此工具可以在遥感图像上标记感兴趣的区域。基础画布模式用于简单图形，图像画布模式用于处理真实遥感图像。</p>
        <p>您可以使用标记工具对地物进行分类、测量或标注，完成后可以导出标记结果。</p>
      </div>
    </div>
  );
};

export default CanvasDisplay;
