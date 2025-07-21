/**
 * model.js
 * 
 * 定义插件的默认配置数据结构。
 */

export const defaultConfig = {
  selectedAiModel: "DeepSeek",
  aiModels: [
    {
      name: "OpenAI",
      provider: "OpenAI",
      isCustom: false,
      active: true,
      apiKey: "",
      url: "https://api.openai.com",
      selectedModel: "gpt-3.5-turbo",
      supportedModels: ["gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"],
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      name: "Google",
      provider: "Google",
      isCustom: false,
      active: true,
      apiKey: "",
      url: "https://generativelanguage.googleapis.com",
      selectedModel: "gemini-pro",
      supportedModels: ["gemini-pro", "gemini-1.5-pro-latest"],
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      name: "Anthropic",
      provider: "Anthropic",
      isCustom: false,
      active: true,
      apiKey: "",
      url: "https://api.anthropic.com",
      selectedModel: "claude-3-opus-20240229",
      supportedModels: [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-2.1",
        "claude-2.0",
        "claude-instant-1.2"
      ],
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      name: "DeepSeek",
      provider: "DeepSeek",
      isCustom: false,
      active: true,
      apiKey: "",
      url: "https://api.deepseek.com",
      selectedModel: "deepseek-chat",
      supportedModels: ["deepseek-chat", "deepseek-coder"],
      maxTokens: 4096,
      temperature: 0.7
    }
  ],
  summarizePrompt: "请总结以下论文，并以markdown格式呈现，要求包含'论文题目'，'研究背景'，'研究方法'，'研究结论'等部分。",
  paperListPageSize: 10,
  language: "zh"
}; 