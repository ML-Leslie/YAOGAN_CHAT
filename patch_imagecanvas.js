const fs = require('fs');
const path = require('path');

// 读取文件内容
const filePath = path.join(__dirname, 'src/components/ImageCanvas.js');
let content = fs.readFileSync(filePath, 'utf8');

// 要替换的文本
const oldCode = `          try {
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
                parsedCoordinates = JSON.parse(match[1]);
                console.log('从字符串中提取并解析JSON');
              }
            } catch (extractError) {
              console.error('提取JSON部分失败:', extractError);
            }`;

// 新代码
const newCode = `          try {
            // 尝试解析JSON字符串
            parsedCoordinates = JSON.parse(objectCoordinates);
            console.log('成功解析JSON字符串');
          } catch (e) {
            console.error('解析JSON坐标字符串失败:', e);
            
            // 如果解析失败，尝试提取JSON部分
            try {
              // 更强大的JSON提取正则表达式，匹配所有可能的JSON格式
              const jsonRegex = /(\{.*?\}|\[.*?\])/gs;
              const matches = objectCoordinates.match(jsonRegex);
              
              if (matches) {
                // 尝试解析每个匹配项，找到第一个有效的
                for (const match of matches) {
                  try {
                    const parsed = JSON.parse(match);
                    if (Array.isArray(parsed) || 
                        (parsed && typeof parsed === 'object' && 
                         (parsed.bbox || (parsed.x !== undefined && parsed.y !== undefined)))) {
                      parsedCoordinates = parsed;
                      console.log('从字符串中找到有效的JSON坐标:', match);
                      break;
                    }
                  } catch (err) {
                    // 继续尝试下一个匹配
                  }
                }
              }
            } catch (extractError) {
              console.error('提取JSON部分失败:', extractError);
            }`;

// 替换内容
const updatedContent = content.replace(oldCode, newCode);

// 写回文件
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('文件已更新');
