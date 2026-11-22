/**
 * 一条编辑指令的执行结果（model 产出，commands_executor 消费）：
 * 指令本身负责把「怎么做、怎么撤销、怎么重做」完整封装好，
 * 执行器只负责把它作为一个 undo 单元登记进历史栈。
 */
export interface EditOutcome {
  /** 执行成功的回显（如 "circle#c1 moved to (130,100)"） */
  readonly message: string;
  /** 撤销并返回回显（如 "circle#c1 moved back to (100,100)"） */
  undo(): string;
  /** 重做并返回回显 */
  redo(): string;
}
