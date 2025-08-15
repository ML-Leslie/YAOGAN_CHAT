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

// 标记框组件
const BoundingBox = ({ box, color = 'red', label }) => {
  const { x, y, width, height } = box;
  
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke={color}
        strokeWidth={2}
        dash={[5, 2]}
        fill="transparent"
      />
      {label && (
        <Text
          x={x}
          y={y - 20}
          text={label}
          fontSize={16}
          fill={color}
          padding={2}
          background="#ffffff88"
        />
      )}
    </>
  );
};

// 主画布组件
const ImageCanvas = ({ width, height, initialImageUrl, objectCoordinates }) => {
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const stageRef = useRef();
  
  // 加载初始图像
  useEffect(() => {
    if (initialImageUrl) {
      console.log('加载初始图像:', initialImageUrl);
      const img = new window.Image();
      // 设置跨域属性，确保图像可以正确导出
      img.crossOrigin = 'anonymous';
      
      // 处理图像加载错误
      img.onerror = (error) => {
        console.error('图像加载失败:', error);
        // 尝试不使用跨域加载
        console.log('尝试不使用跨域方式加载图像');
        const fallbackImg = new window.Image();
        fallbackImg.src = initialImageUrl;
        
        fallbackImg.onload = () => handleImageLoaded(fallbackImg);
        fallbackImg.onerror = (fallbackError) => {
          console.error('备用图像加载方式也失败:', fallbackError);
        };
      };
      
      // 图像加载成功处理函数
      const handleImageLoaded = (loadedImg) => {
        // 计算图像尺寸，确保适合画布
        let imgWidth = loadedImg.width;
        let imgHeight = loadedImg.height;
        
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
          id: 'main-image',
          imageObj: loadedImg,
          x: (width - imgWidth) / 2,
          y: (height - imgHeight) / 2,
          width: imgWidth,
          height: imgHeight,
          rotation: 0,
        };
        
        setImages([newImage]);
        
        // 图像加载完成后，检查是否有坐标数据
        console.log('图像加载完成，检查坐标数据:', !!objectCoordinates);
        
        // 强制触发坐标处理
        setTimeout(() => {
          if (objectCoordinates) {
            console.log('图像加载完成后强制处理坐标');
            // 手动触发坐标处理函数
            processCoordinatesData(objectCoordinates, newImage);
          }
        }, 100);
      };
      
      // 设置加载事件
      img.onload = () => handleImageLoaded(img);
      
      // 开始加载图像
      img.src = initialImageUrl;
      
      // 对于已经缓存的图像，onload可能不会触发
      if (img.complete) {
        handleImageLoaded(img);
      }
    }
  }, [initialImageUrl, width, height, objectCoordinates]);
  
  // 提取坐标处理逻辑为独立函数，便于在任何地方调用
  const processCoordinatesData = (coordinates, mainImage = null) => {
    if (!coordinates) return;
    
    // 使用当前主图像或从状态中获取
    const imageToUse = mainImage || images.find(img => img.id === 'main-image');
    if (!imageToUse) {
      console.log('无法处理坐标：未找到主图像');
      return;
    }
    
    console.log('开始处理坐标数据');
    
    // 根据对象坐标数据创建边界框
    const boxes = [];
    
    try {
      let parsedCoordinates;
      
      // 处理不同格式的坐标数据
      if (typeof coordinates === 'string') {
        try {
          parsedCoordinates = JSON.parse(coordinates);
        } catch (e) {
          console.error('解析JSON坐标字符串失败:', e);
          
          // 尝试提取JSON部分
          try {
            const jsonRegex = /(\{.*\}|\[.*\])/s;
            const match = coordinates.match(jsonRegex);
            if (match) {
              parsedCoordinates = JSON.parse(match[0]);
            }
          } catch (extractError) {
            console.error('提取JSON部分失败:', extractError);
          }
        }
      } else {
        parsedCoordinates = coordinates;
      }
      
      if (parsedCoordinates) {
        if (Array.isArray(parsedCoordinates)) {
          if (parsedCoordinates.length >= 4 && typeof parsedCoordinates[0] === 'number') {
            // 单个坐标数组 [x1, y1, x2, y2]
            const boxData = {
              x: parsedCoordinates[0] * imageToUse.width + imageToUse.x,
              y: parsedCoordinates[1] * imageToUse.height + imageToUse.y,
              width: (parsedCoordinates[2] - parsedCoordinates[0]) * imageToUse.width,
              height: (parsedCoordinates[3] - parsedCoordinates[1]) * imageToUse.height,
              label: '对象 1'
            };
            boxes.push(boxData);
          } else {
            // 对象数组
            parsedCoordinates.forEach((coord, index) => {
              if (!coord) return;
              
              if (coord.bbox && Array.isArray(coord.bbox)) {
                const boxData = {
                  x: coord.bbox[0] * imageToUse.width + imageToUse.x,
                  y: coord.bbox[1] * imageToUse.height + imageToUse.y,
                  width: (coord.bbox[2] - coord.bbox[0]) * imageToUse.width,
                  height: (coord.bbox[3] - coord.bbox[1]) * imageToUse.height,
                  label: coord.label || `对象 ${index + 1}`
                };
                boxes.push(boxData);
              } else if (coord.label && typeof coord.label === 'string') {
                // 尝试从对象中提取坐标信息
                let x1, y1, x2, y2, width, height;
                
                // 尝试各种可能的属性名
                if ('x' in coord) x1 = parseFloat(coord.x);
                if ('y' in coord) y1 = parseFloat(coord.y);
                if ('width' in coord) width = parseFloat(coord.width);
                if ('height' in coord) height = parseFloat(coord.height);
                if ('x2' in coord) x2 = parseFloat(coord.x2);
                if ('y2' in coord) y2 = parseFloat(coord.y2);
                
                // 计算宽高
                if (x1 !== undefined && x2 !== undefined && width === undefined) {
                  width = x2 - x1;
                }
                if (y1 !== undefined && y2 !== undefined && height === undefined) {
                  height = y2 - y1;
                }
                
                if (x1 !== undefined && y1 !== undefined && width !== undefined && height !== undefined) {
                  const boxData = {
                    x: x1 * imageToUse.width + imageToUse.x,
                    y: y1 * imageToUse.height + imageToUse.y,
                    width: width * imageToUse.width,
                    height: height * imageToUse.height,
                    label: coord.label
                  };
                  boxes.push(boxData);
                }
              }
            });
          }
        } else if (typeof parsedCoordinates === 'object') {
          // 单个对象，检查是否有label和bbox属性
          if (parsedCoordinates.label && parsedCoordinates.bbox) {
            const boxData = {
              x: parsedCoordinates.bbox[0] * imageToUse.width + imageToUse.x,
              y: parsedCoordinates.bbox[1] * imageToUse.height + imageToUse.y,
              width: (parsedCoordinates.bbox[2] - parsedCoordinates.bbox[0]) * imageToUse.width,
              height: (parsedCoordinates.bbox[3] - parsedCoordinates.bbox[1]) * imageToUse.height,
              label: parsedCoordinates.label
            };
            boxes.push(boxData);
          }
        }
      }
      
      console.log(`处理完成，创建了 ${boxes.length} 个边界框`);
      if (boxes.length > 0) {
        setBoundingBoxes(boxes);
      }
    } catch (error) {
      console.error('处理坐标时发生错误:', error);
    }
  };

  // 处理对象坐标数据，生成边界框
  useEffect(() => {
    // 添加清晰的日志，跟踪何时执行此Effect
    console.log('ImageCanvas: objectCoordinates effect triggered', { 
      hasCoordinates: !!objectCoordinates,
      imagesLength: images.length,
      objectCoordinatesType: typeof objectCoordinates,
      isArray: Array.isArray(objectCoordinates),
      objectCoordinatesValue: objectCoordinates
    });
    
    if (objectCoordinates && images.length > 0) {
      // 获取主图像
      const mainImage = images.find(img => img.id === 'main-image');
      if (!mainImage) {
        console.log('主图像未找到');
        return;
      }
      
      // 根据对象坐标数据创建边界框
      const boxes = [];
      
      try {
        console.log('处理对象坐标数据:', 
          typeof objectCoordinates === 'string' ? 
          objectCoordinates.substring(0, 100) + '...' : // 只打印字符串的前100个字符
          objectCoordinates
        );
        
        let parsedCoordinates;
        // 处理不同格式的坐标数据
        if (typeof objectCoordinates === 'string') {
          try {
            // 尝试解析JSON字符串
            parsedCoordinates = JSON.parse(objectCoordinates);
            console.log('成功解析JSON字符串');
          } catch (e) {
            console.error('解析JSON坐标字符串失败:', e);
            
            // 如果解析失败，尝试提取JSON部分
            try {
              // 查找第一个有效的JSON对象或数组
              const jsonRegex = /(\{.*\}|\[.*\])/s;
              const match = objectCoordinates.match(jsonRegex);
              if (match) {
                parsedCoordinates = JSON.parse(match[0]);
                console.log('提取的JSON部分');
              }
            } catch (extractError) {
              console.error('提取JSON部分失败:', extractError);
            }
          }
        } else {
          parsedCoordinates = objectCoordinates;
          console.log('使用非字符串坐标数据，类型:', Array.isArray(parsedCoordinates) ? 'Array' : typeof parsedCoordinates);
        }
        
        if (parsedCoordinates) {
          console.log('解析后的坐标数据类型:', Array.isArray(parsedCoordinates) ? 'Array' : typeof parsedCoordinates);
          
          if (Array.isArray(parsedCoordinates)) {
            // 数组格式
            if (parsedCoordinates.length === 0) {
              console.log('坐标数组为空');
            } else if (parsedCoordinates.length >= 4 && 
                typeof parsedCoordinates[0] === 'number') {
              // 单个坐标数组 [x1, y1, x2, y2]
              console.log('处理单个坐标数组');
              processCoordinates([parsedCoordinates]);
            } else {
              // 对象数组 [{...}, {...}]
              console.log('处理对象数组，包含', parsedCoordinates.length, '个项目');
              processCoordinates(parsedCoordinates);
            }
          } else if (typeof parsedCoordinates === 'object') {
            // 单个对象
            console.log('处理单个对象');
            processCoordinates([parsedCoordinates]);
          }
        } else {
          console.warn('无法解析坐标数据');
        }
      } catch (error) {
        console.error('处理坐标数据时出错:', error);
      }
      
      // 处理不同格式的坐标数据并创建边界框
      function processCoordinates(coords) {
        if (!coords) return;
        
        if (!Array.isArray(coords)) {
          coords = [coords]; // 转换为数组处理
        }
        
        console.log(`开始处理 ${coords.length} 个坐标项`);
        
        coords.forEach((coord, index) => {
          console.log(`处理坐标项 ${index}:`, coord);
          // 支持不同格式的坐标表示
          let boxData;
          
          if (Array.isArray(coord) && coord.length >= 4) {
            // 格式: [x1, y1, x2, y2]
            boxData = {
              x: coord[0] * mainImage.width + mainImage.x,
              y: coord[1] * mainImage.height + mainImage.y,
              width: (coord[2] - coord[0]) * mainImage.width,
              height: (coord[3] - coord[1]) * mainImage.height,
              label: `对象 ${index + 1}`
            };
            console.log(`格式[x1,y1,x2,y2], 创建边界框:`, boxData);
          } else if (coord.bbox && Array.isArray(coord.bbox)) {
            // 格式: { bbox: [x1, y1, x2, y2], label: "..." }
            boxData = {
              x: coord.bbox[0] * mainImage.width + mainImage.x,
              y: coord.bbox[1] * mainImage.height + mainImage.y,
              width: (coord.bbox[2] - coord.bbox[0]) * mainImage.width,
              height: (coord.bbox[3] - coord.bbox[1]) * mainImage.height,
              label: coord.label || `对象 ${index + 1}`
            };
            console.log(`格式{bbox:[]}, 创建边界框:`, boxData);
          } else if (coord.x !== undefined && coord.y !== undefined && 
                     coord.width !== undefined && coord.height !== undefined) {
            // 格式: { x, y, width, height, label }
            boxData = {
              x: coord.x * mainImage.width + mainImage.x,
              y: coord.y * mainImage.height + mainImage.y,
              width: coord.width * mainImage.width,
              height: coord.height * mainImage.height,
              label: coord.label || `对象 ${index + 1}`
            };
            console.log(`格式{x,y,width,height}, 创建边界框:`, boxData);
          } else if (typeof coord === 'object') {
            // 尝试从对象中提取坐标信息
            console.log('尝试从对象中提取坐标:', coord);
            
            // 寻找可能的坐标字段
            let x1, y1, x2, y2, label;
            
            // 查找常见坐标字段名
            const possibleXKeys = ['x', 'x1', 'left', 'startX'];
            const possibleYKeys = ['y', 'y1', 'top', 'startY'];
            const possibleWidthKeys = ['width', 'w', 'dx'];
            const possibleHeightKeys = ['height', 'h', 'dy'];
            const possibleX2Keys = ['x2', 'right', 'endX'];
            const possibleY2Keys = ['y2', 'bottom', 'endY'];
            const possibleLabelKeys = ['label', 'name', 'class', 'type', 'category'];
            
            // 尝试找到坐标值
            for (const key of possibleXKeys) {
              if (coord[key] !== undefined) {
                x1 = parseFloat(coord[key]);
                console.log(`找到x1值: ${x1}, 使用字段: ${key}`);
                break;
              }
            }
            
            for (const key of possibleYKeys) {
              if (coord[key] !== undefined) {
                y1 = parseFloat(coord[key]);
                console.log(`找到y1值: ${y1}, 使用字段: ${key}`);
                break;
              }
            }
            
            // 尝试找到宽度或x2
            let width;
            for (const key of possibleWidthKeys) {
              if (coord[key] !== undefined) {
                width = parseFloat(coord[key]);
                console.log(`找到宽度: ${width}, 使用字段: ${key}`);
                break;
              }
            }
            
            for (const key of possibleX2Keys) {
              if (coord[key] !== undefined) {
                x2 = parseFloat(coord[key]);
                console.log(`找到x2值: ${x2}, 使用字段: ${key}`);
                break;
              }
            }
            
            // 尝试找到高度或y2
            let height;
            for (const key of possibleHeightKeys) {
              if (coord[key] !== undefined) {
                height = parseFloat(coord[key]);
                console.log(`找到高度: ${height}, 使用字段: ${key}`);
                break;
              }
            }
            
            for (const key of possibleY2Keys) {
              if (coord[key] !== undefined) {
                y2 = parseFloat(coord[key]);
                console.log(`找到y2值: ${y2}, 使用字段: ${key}`);
                break;
              }
            }
            
            // 尝试找到标签
            for (const key of possibleLabelKeys) {
              if (coord[key] !== undefined) {
                label = coord[key];
                console.log(`找到标签: ${label}, 使用字段: ${key}`);
                break;
              }
            }
            
            if (!label) {
              label = `对象 ${index + 1}`;
            }
            
            // 计算宽度和高度（如果有x2/y2）
            if (x1 !== undefined && x2 !== undefined && width === undefined) {
              width = x2 - x1;
              console.log(`通过x1和x2计算宽度: ${width}`);
            }
            
            if (y1 !== undefined && y2 !== undefined && height === undefined) {
              height = y2 - y1;
              console.log(`通过y1和y2计算高度: ${height}`);
            }
            
            // 如果有足够的信息，创建边界框
            if (x1 !== undefined && y1 !== undefined && 
                (width !== undefined || x2 !== undefined) && 
                (height !== undefined || y2 !== undefined)) {
              
              boxData = {
                x: x1 * mainImage.width + mainImage.x,
                y: y1 * mainImage.height + mainImage.y,
                width: width !== undefined ? width * mainImage.width : (x2 - x1) * mainImage.width,
                height: height !== undefined ? height * mainImage.height : (y2 - y1) * mainImage.height,
                label: label
              };
              console.log(`从对象字段提取, 创建边界框:`, boxData);
            } else {
              console.log('提取的坐标信息不完整，无法创建边界框');
            }
          }
          
          if (boxData) {
            console.log('添加边界框到列表:', boxData);
            boxes.push(boxData);
          }
        });
      }
      
      console.log(`总共创建了 ${boxes.length} 个边界框`);
      setBoundingBoxes(boxes);
    } else {
      // 清除边界框
      if (boundingBoxes.length > 0 && (!objectCoordinates || images.length === 0)) {
        console.log('清除边界框');
        setBoundingBoxes([]);
      }
    }
  }, [objectCoordinates, images, boundingBoxes.length]);

  // 处理图片上传
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      // 本地上传的图片不需要跨域设置
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
        
        // 替换所有图像
        setImages([newImage]);
        // 清除边界框
        setBoundingBoxes([]);
        
        // 如果存在画布更新事件，触发一次，以便获取最新标记
        if (window.updateCanvasDisplay) {
          console.log('上传新图片后触发画布更新，获取最新标记');
          setTimeout(() => window.updateCanvasDisplay(), 500); // 延迟一点点，确保图片加载完成
        }
      };
      
      // 处理图像加载错误
      img.onerror = (error) => {
        console.error('本地图像加载失败:', error);
        alert('图像加载失败，请尝试另一张图片');
      };
    };
    
    // 处理读取错误
    reader.onerror = () => {
      console.error('读取文件失败');
      alert('读取图像文件失败，请尝试另一张图片');
    };
    
    reader.readAsDataURL(file);
    // 重置文件输入，以便用户可以再次上传同一个文件
    e.target.value = '';
  };
  
  // 保存画布为图像
  const saveCanvas = () => {
    try {
      // 确保图像正确加载
      if (images.length === 0) {
        console.error('没有图像可供导出');
        return;
      }
      
      // 使用较高的像素比例提高导出图像质量
      const pixelRatio = 2;
      
      // 创建一个离屏canvas用于高质量导出
      const offscreenStage = new Konva.Stage({
        container: document.createElement('div'),
        width: stageRef.current.width(),
        height: stageRef.current.height(),
      });
      
      // 复制图层内容
      const offscreenLayer = new Konva.Layer();
      offscreenStage.add(offscreenLayer);
      
      // 添加所有图像
      images.forEach(image => {
        const img = new Konva.Image({
          image: image.imageObj,
          x: image.x,
          y: image.y,
          width: image.width,
          height: image.height,
          rotation: image.rotation,
        });
        offscreenLayer.add(img);
      });
      
      // 添加所有边界框
      boundingBoxes.forEach((box, index) => {
        // 边界框
        const rect = new Konva.Rect({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          stroke: ['red', 'blue', 'green', 'orange', 'purple'][index % 5],
          strokeWidth: 2,
          dash: [5, 2],
          fill: 'transparent',
        });
        offscreenLayer.add(rect);
        
        // 标签
        if (box.label) {
          const text = new Konva.Text({
            x: box.x,
            y: box.y - 20,
            text: box.label,
            fontSize: 16,
            fill: ['red', 'blue', 'green', 'orange', 'purple'][index % 5],
            padding: 2,
            background: '#ffffff88',
          });
          offscreenLayer.add(text);
        }
      });
      
      // 绘制所有图层
      offscreenLayer.draw();
      
      // 将画布转换为数据URL
      const dataURL = offscreenStage.toDataURL({ 
        pixelRatio: pixelRatio,
        mimeType: 'image/png',
        quality: 1
      });
      
      // 创建下载链接
      const link = document.createElement('a');
      link.download = 'canvas-export.png';
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理
      offscreenStage.destroy();
      console.log('图像导出成功');
    } catch (error) {
      console.error('导出画布时出错:', error);
      alert('导出图像失败，请检查控制台获取更多信息');
    }
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
      <div className="canvas-main-container">
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onMouseDown={checkDeselect}
          onTouchStart={checkDeselect}
          style={{ 
            border: 'none',
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
            
            {/* 渲染边界框 */}
            {boundingBoxes.map((box, index) => (
              <BoundingBox 
                key={index} 
                box={box} 
                color={['red', 'blue', 'green', 'orange', 'purple'][index % 5]}
                label={box.label} 
              />
            ))}
          </Layer>
        </Stage>
      </div>
      
      <div className="download-button-container">
        <button className="download-button" onClick={saveCanvas}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
          </svg>
          下载
        </button>
      </div>
    </div>
  );
};

export default ImageCanvas;
