import React from 'react';
import ReactMarkdown from 'react-markdown';
import './Markdown.css';

// 清理文本中的特殊标记
const cleanSpecialTags = (text) => {
  if (!text) return '';
  
  // 移除智谱AI模型输出中的特殊标记
  const tagsToRemove = [
    '<|begin_of_box|>', '<|end_of_box|>',
    '<|begin_of_text|>', '<|end_of_text|>',
    '<|begin_of_list|>', '<|end_of_list|>',
    '<|begin_of_attribute|>', '<|end_of_attribute|>'
  ];
  
  let cleanedText = text;
  for (const tag of tagsToRemove) {
    cleanedText = cleanedText.replace(new RegExp(tag, 'g'), '');
  }
  // 移除成对的竖线标记
  cleanedText = cleanedText.replace(/^\s*\|\|\s*/g, ''); // 开头的 ||
  cleanedText = cleanedText.replace(/\s*\|\|\s*$/g, ''); // 结尾的 ||


  return cleanedText;
};

const Markdown = ({ content }) => {
  // 确保内容不为空并清理特殊标记
  const cleanedContent = content ? cleanSpecialTags(content) : '';
  
  return (
    <div className="markdown-content">
      <ReactMarkdown>{cleanedContent}</ReactMarkdown>
    </div>
  );
};

export default Markdown;
