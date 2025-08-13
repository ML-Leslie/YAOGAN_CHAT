import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image, Transformer, Rect, Line, Text } from 'react-konva';
import Konva from 'konva';

// 可拖动图像组件
const DraggableImage = ({ image, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected) {
      // 将 transformer 附加到当前选中的图像
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Image
        ref={shapeRef}
        image={image.imageObj}
        x={image.x}
        y={image.y}
        width={image.width}
        height={image.height}
        rotation={image.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...image,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={() => {
          // transformer工作的方式是改变缩放，而不是宽度/高度
          // 所以我们需要手动重新计算宽度/高度
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          // 重置缩放，以便宽度/高度反映当前大小
          node.scaleX(1);
          node.scaleY(1);
          
          onChange({
            ...image,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            // 限制大小
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

// 主画布组件
const ImageCanvas = ({ width, height }) => {
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const stageRef = useRef();
  
  // 处理图片上传
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      
      img.onload = () => {
        // 计算图像尺寸，确保适合画布
        let imgWidth = img.width;
        let imgHeight = img.height;
        
        // 如果图像太大，等比例缩小
        const maxWidth = width * 0.8;
        const maxHeight = height * 0.8;
        
        if (imgWidth > maxWidth) {
          const scale = maxWidth / imgWidth;
          imgWidth = maxWidth;
          imgHeight *= scale;
        }
        
        if (imgHeight > maxHeight) {
          const scale = maxHeight / imgHeight;
          imgHeight = maxHeight;
          imgWidth *= scale;
        }
        
        // 添加图像到状态
        const newImage = {
          id: Date.now().toString(),
          imageObj: img,
          x: (width - imgWidth) / 2,
          y: (height - imgHeight) / 2,
          width: imgWidth,
          height: imgHeight,
          rotation: 0,
        };
        
        setImages([...images, newImage]);
      };
    };
    
    reader.readAsDataURL(file);
    // 重置文件输入，以便用户可以再次上传同一个文件
    e.target.value = '';
  };
  
  // 保存画布为图像
  const saveCanvas = () => {
    // 将画布保存为PNG
    const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
    
    // 创建下载链接
    const link = document.createElement('a');
    link.download = 'canvas-export.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // 清除选中状态
  const checkDeselect = (e) => {
    // 如果点击空白处，取消选择
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  return (
    <div className="image-canvas-container">
      <div className="canvas-tools">
        <label className="upload-button">
          上传图片
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={handleImageUpload} 
          />
        </label>
        <button onClick={saveCanvas}>导出画布</button>
        {selectedId && (
          <button onClick={() => {
            setImages(images.filter(img => img.id !== selectedId));
            setSelectedId(null);
          }}>删除选中图像</button>
        )}
      </div>
      
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
        style={{ 
          border: '1px solid #ccc',
          background: '#fff'
        }}
      >
        <Layer>
          {images.map((image) => (
            <DraggableImage
              key={image.id}
              image={image}
              isSelected={image.id === selectedId}
              onSelect={() => setSelectedId(image.id)}
              onChange={(newAttrs) => {
                // 更新图像属性
                const updatedImages = images.map((img) => {
                  if (img.id === image.id) {
                    return newAttrs;
                  }
                  return img;
                });
                setImages(updatedImages);
              }}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default ImageCanvas;
