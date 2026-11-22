/** 输出格式约定：错误统一 error: 前缀；警告 warning: 前缀；一行一条 */
export const Messages = {
  banner: "svg-editor 0.1 — type 'help' for commands",
  prompt: 'svg> ',

  error(message: string): string {
    return `error: ${message}`;
  },

  /** 命令返回的输出原样打印（read 的 warning 行已由 io 层带好前缀） */
  result(output: string): string {
    return output;
  },
};
