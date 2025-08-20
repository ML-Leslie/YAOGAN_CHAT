/**
 * 图像加载Hook
 * 提供统一的图像加载和处理功能
 */

import { useState, useRef, useEffect } from 'react';

export const useImageLoader = (initialImageUrl, width, height, objectCoordinates) => {
  const [images, setImages] = useState([]);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const imageLoadCount = useRef(0);

  // 处理坐标数据的统一函数
  const processCoordinatesData = (coordinates, mainImage) => {
    if (!coordinates || !mainImage) return;

    console.log('开始处理坐标数据');
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
              x: parsedCoordinates[0] * mainImage.width + mainImage.x,
              y: parsedCoordinates[1] * mainImage.height + mainImage.y,
              width: (parsedCoordinates[2] - parsedCoordinates[0]) * mainImage.width,
              height: (parsedCoordinates[3] - parsedCoordinates[1]) * mainImage.height,
              label: '对象 1'
            };
            boxes.push(boxData);
          } else {
            // 对象数组
            parsedCoordinates.forEach((coord, index) => {
              if (!coord) return;
              
              if (coord.bbox && Array.isArray(coord.bbox)) {
                const boxData = {
                  x: coord.bbox[0] * mainImage.width + mainImage.x,
                  y: coord.bbox[1] * mainImage.height + mainImage.y,
                  width: (coord.bbox[2] - coord.bbox[0]) * mainImage.width,
                  height: (coord.bbox[3] - coord.bbox[1]) * mainImage.height,
                  label: coord.label || `对象 ${index + 1}`
                };
                boxes.push(boxData);
              } else if (coord.x !== undefined && coord.y !== undefined && 
                         coord.width !== undefined && coord.height !== undefined) {
                const boxData = {
                  x: coord.x * mainImage.width + mainImage.x,
                  y: coord.y * mainImage.height + mainImage.y,
                  width: coord.width * mainImage.width,
                  height: coord.height * mainImage.height,
                  label: coord.label || `对象 ${index + 1}`
                };
                boxes.push(boxData);
              }
            });
          }
        } else if (typeof parsedCoordinates === 'object') {
          // 单个对象
          if (parsedCoordinates.label && parsedCoordinates.bbox) {
            const boxData = {
              x: parsedCoordinates.bbox[0] * mainImage.width + mainImage.x,
              y: parsedCoordinates.bbox[1] * mainImage.height + mainImage.y,
              width: (parsedCoordinates.bbox[2] - parsedCoordinates.bbox[0]) * mainImage.width,
              height: (parsedCoordinates.bbox[3] - parsedCoordinates.bbox[1]) * mainImage.height,
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

  // 加载图像的统一函数
  const loadImage = (imageUrl, isMainImage = true) => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      
      // 设置加载事件
      img.onload = () => {
        try {
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
          
          const newImage = {
            id: isMainImage ? 'main-image' : Date.now().toString() + imageLoadCount.current++,
            imageObj: img,
            x: (width - imgWidth) / 2,
            y: (height - imgHeight) / 2,
            width: imgWidth,
            height: imgHeight,
            rotation: 0,
          };
          
          resolve(newImage);
        } catch (error) {
          reject(error);
        }
      };
      
      // 处理图像加载错误
      img.onerror = (error) => {
        console.error('图像加载失败:', error);
        reject(new Error('图像加载失败'));
      };
      
      // 设置跨域属性（如果需要）
      if (imageUrl.startsWith('http')) {
        img.crossOrigin = 'anonymous';
      }
      
      // 开始加载图像
      img.src = imageUrl;
      
      // 对于已经缓存的图像，onload可能不会触发
      if (img.complete) {
        img.onload();
      }
    });
  };

  // 加载初始图像
  useEffect(() => {
    if (initialImageUrl) {
      console.log('加载初始图像:', initialImageUrl);
      
      loadImage(initialImageUrl, true)
        .then(newImage => {
          setImages([newImage]);
          
          // 图像加载完成后，检查是否有坐标数据
          console.log('图像加载完成，检查坐标数据:', !!objectCoordinates);
          
          if (objectCoordinates) {
            console.log('图像加载完成后处理坐标');
            processCoordinatesData(objectCoordinates, newImage);
          }
        })
        .catch(error => {
          console.error('主图像加载失败:', error);
          
          // 尝试备用加载方式
          const fallbackImg = new window.Image();
          fallbackImg.src = initialImageUrl;
          
          fallbackImg.onload = () => {
            loadImage(initialImageUrl, true)
              .then(newImage => {
                setImages([newImage]);
                if (objectCoordinates) {
                  processCoordinatesData(objectCoordinates, newImage);
                }
              })
              .catch(fallbackError => {
                console.error('备用图像加载方式也失败:', fallbackError);
              });
          };
          
          fallbackImg.onerror = () => {
            console.error('所有图像加载方式都失败');
          };
        });
    }
  }, [initialImageUrl, width, height]);

  // 处理坐标数据变化
  useEffect(() => {
    if (objectCoordinates && images.length > 0) {
      const mainImage = images.find(img => img.id === 'main-image');
      if (mainImage) {
        processCoordinatesData(objectCoordinates, mainImage);
      }
    }
  }, [objectCoordinates, images]);

  // 处理图片上传
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      loadImage(event.target.result, false)
        .then(newImage => {
          // 替换所有图像
          setImages([newImage]);
          // 清除边界框
          setBoundingBoxes([]);
          
          // 如果存在画布更新事件，触发一次
          if (window.updateCanvasDisplay) {
            console.log('上传新图片后触发画布更新');
            setTimeout(() => window.updateCanvasDisplay(), 500);
          }
        })
        .catch(error => {
          console.error('本地图像加载失败:', error);
          alert('图像加载失败，请尝试另一张图片');
        });
    };
    
    reader.onerror = () => {
      console.error('读取文件失败');
      alert('读取图像文件失败，请尝试另一张图片');
    };
    
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return {
    images,
    setImages,
    boundingBoxes,
    setBoundingBoxes,
    handleImageUpload,
    processCoordinatesData
  };
};

export default useImageLoader;