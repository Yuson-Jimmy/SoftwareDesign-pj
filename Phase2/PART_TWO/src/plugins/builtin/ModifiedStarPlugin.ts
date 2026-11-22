import type { Plugin } from '../Plugin';
import type { Shape } from '../../model/Shape';

/** modified-star：只装饰本次会话中编辑过且仍在文档内的节点。 */
export const modifiedStarPlugin: Plugin = {
  name: 'modified-star',
  treeDecorators: [{
    name: 'modified-star',
    decorations(shape: Shape): string[] {
      return shape.modified ? ['*'] : [];
    },
  }],
};
