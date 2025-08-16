import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import './Markdown.css';

// 清理文本中的特殊标记并预处理LaTeX语法
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

  // 将 \(...\) 转换为 $...$（行内公式）
  cleanedText = cleanedText.replace(/\\\((.*?)\\\)/gs, (match, content) => `$${content}$`);
  
  // 将 \[...\] 转换为 $$...$$（块级公式）
  cleanedText = cleanedText.replace(/\\\[(.*?)\\\]/gs, (match, content) => `$$${content}$$`);

  return cleanedText;
};

const Markdown = ({ content }) => {
  // 确保内容不为空并清理特殊标记
  const cleanedContent = content ? cleanSpecialTags(content) : '';
  
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={tomorrow}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown;
