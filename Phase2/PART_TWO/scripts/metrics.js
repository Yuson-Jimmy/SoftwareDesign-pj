#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: projectRoot, encoding: 'utf8' }).trim();
const cliPrefix = 'Phase2/PART_TWO/src';
const vscodePrefix = 'Phase2/PART_ONE/src';
const outputDir = path.join(projectRoot, 'docs', 'metrics');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
const from = argument('--from', 'final');
const to = argument('--to', 'HEAD');

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
function revision(name) {
  return git(['rev-parse', '--verify', `${name}^{commit}`]).trim();
}
function filesAt(rev, prefix) {
  const output = git(['ls-tree', '-r', '--name-only', rev, '--', prefix]);
  return output.split(/\r?\n/).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts')).sort();
}
function contentAt(rev, file) {
  return git(['show', `${rev}:${file}`]);
}
function physicalLines(source) {
  if (source.length === 0) return 0;
  return source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0);
}

/** 文件级 McCabe 近似：1 + AST 中的分支/循环/捕获/条件/短路边界。 */
function complexity(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
  let decisions = 0;
  const binaryOperators = new Set([
    ts.SyntaxKind.AmpersandAmpersandToken,
    ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.QuestionQuestionToken,
  ]);
  function visit(node) {
    if (
      ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForInStatement(node) ||
      ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node) ||
      ts.isCaseClause(node) || ts.isCatchClause(node) || ts.isConditionalExpression(node) ||
      (ts.isBinaryExpression(node) && binaryOperators.has(node.operatorToken.kind))
    ) decisions++;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return 1 + decisions;
}

function cliCategory(file) {
  if (file.includes('/src/app/')) return 'assembly';
  if (file.includes('/src/plugins/')) return 'plugins';
  return 'kernel';
}
function responsibility(file) {
  const base = path.basename(file, '.ts');
  const exact = {
    Application: '组合根与统一安装入口', PluginRegistrar: '暂存、查重、清单校验与提交',
    ConfiguredApplication: '配置解析、错误报告与回退', PluginCatalog: '通用动态模块与清单加载',
    EditorModel: '文档与编辑领域服务', CommandsExecutor: '历史栈与操作执行',
    ShapeProvider: '图形扩展点', AttributeHandler: '属性扩展点与注册表',
    TreeDecorator: '树标签扩展点', Plugin: '插件上下文与清单类型',
    BoxPlugin: 'box 复合图形及扩展', ModifiedStarPlugin: 'dirty 树标签',
    StatsPlugin: 'stats 命令插件', DirPlugin: 'dir 命令插件装配',
    DirCommand: 'dir 参数与输出', NodeDirectoryAdapter: 'Node 文件系统适配器',
    SvgReader: 'SVG 读回与降级', SvgWriter: '普通 SVG 序列化', DisplayView: '树遍历与标签拼接',
  };
  if (exact[base]) return exact[base];
  if (file.includes('/test/')) return '测试代码（不计入 CLI 三类指标）';
  if (file.includes('/commands/')) return '命令语法校验与转发';
  if (file.includes('/model/shapes/')) return '内置几何图形实现';
  if (file.includes('/model/')) return '文档模型与通用领域行为';
  if (file.includes('/cli/')) return 'CLI 解析与交互';
  if (file.includes('/plugins/')) return '插件扩展实现';
  return '源码模块';
}

const revisions = { from: revision(from), to: revision(to) };
const rows = [];
const totals = {};
for (const [side, rev] of Object.entries(revisions)) {
  totals[side] = {
    kernel: { files: 0, lines: 0, complexity: 0 },
    assembly: { files: 0, lines: 0, complexity: 0 },
    plugins: { files: 0, lines: 0, complexity: 0 },
    vscode_extension: { files: 0, lines: 0, complexity: 0 },
    vscode_tests: { files: 0, lines: 0, complexity: 0 },
  };
  const cliFiles = filesAt(rev, side === 'from' ? 'Phase1/src' : cliPrefix);
  for (const file of cliFiles) {
    if (file.includes('/test/')) continue;
    const category = side === 'from' ? 'kernel' : cliCategory(file);
    const source = contentAt(rev, file);
    const record = {
      side, revision: rev, scope: 'cli', category, file,
      lines: physicalLines(source), complexity: complexity(source, file),
      sha256: crypto.createHash('sha256').update(source).digest('hex'),
      responsibility: responsibility(file),
    };
    rows.push(record);
    const total = totals[side][category];
    total.files++;
    total.lines += record.lines;
    total.complexity += record.complexity;
  }
  for (const file of filesAt(rev, vscodePrefix)) {
    const category = file.includes('/test/') ? 'vscode_tests' : 'vscode_extension';
    const source = contentAt(rev, file);
    const record = {
      side, revision: rev, scope: 'vscode', category, file,
      lines: physicalLines(source), complexity: complexity(source, file),
      sha256: crypto.createHash('sha256').update(source).digest('hex'),
      responsibility: responsibility(file),
    };
    rows.push(record);
    const total = totals[side][category];
    total.files++;
    total.lines += record.lines;
    total.complexity += record.complexity;
  }
}

fs.mkdirSync(outputDir, { recursive: true });
const payload = {
  generatedBy: 'scripts/metrics.js',
  method: 'physical lines; file complexity = 1 + TypeScript AST decision points',
  from: { name: from, revision: revisions.from },
  to: { name: to, revision: revisions.to },
  excluded: ['test code from CLI totals', 'dependencies', 'build output', 'VSCode code from CLI deltas'],
  totals,
  files: rows,
};
fs.writeFileSync(path.join(outputDir, 'metrics.json'), `${JSON.stringify(payload, null, 2)}\n`);
const tsvHeader = 'side\trevision\tscope\tcategory\tfile\tlines\tcomplexity\tsha256\tresponsibility';
fs.writeFileSync(path.join(outputDir, 'files.tsv'), `${[tsvHeader, ...rows.map((row) => [
  row.side, row.revision, row.scope, row.category, row.file, row.lines, row.complexity, row.sha256, row.responsibility,
].join('\t'))].join('\n')}\n`);

function cell(side, category, field) { return totals[side][category][field]; }
function delta(category, field) { return cell('to', category, field) - cell('from', category, field); }
function signed(value) { return value > 0 ? `+${value}` : String(value); }
const lines = [
  '# CLI 与 VSCode 历史指标',
  '',
  '> 本文件由 `scripts/metrics.js` 从 Git 历史生成，请勿手填数字。',
  '',
  `- 基线：\`${from}\` → \`${revisions.from}\``,
  `- 目标：\`${to}\` → \`${revisions.to}\``,
  `- 生成命令：\`node scripts/metrics.js --from ${from} --to ${to}\``,
  '',
  '## CLI 三类范围',
  '',
  '| 类别 | final 文件 | p2/目标文件 | final 行数 | p2/目标行数 | 行数增量 | final 复杂度 | p2/目标复杂度 | 复杂度增量 |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...['kernel', 'assembly', 'plugins'].map((category) => `| ${category} | ${cell('from', category, 'files')} | ${cell('to', category, 'files')} | ${cell('from', category, 'lines')} | ${cell('to', category, 'lines')} | ${signed(delta(category, 'lines'))} | ${cell('from', category, 'complexity')} | ${cell('to', category, 'complexity')} | ${signed(delta(category, 'complexity'))} |`),
  '',
  '分类规则：final 的 `Phase1/src` 全部归入 kernel；目标的 `src/app` 为 assembly，`src/plugins` 为 plugins，其余运行源码为 kernel。CLI 测试不计入三类增量。',
  '',
  '## VSCode 独立指标（不混入上述增量）',
  '',
  '| 范围 | 文件 | 行数 | 复杂度 |',
  '| --- | ---: | ---: | ---: |',
  `| 扩展运行源码 | ${cell('to', 'vscode_extension', 'files')} | ${cell('to', 'vscode_extension', 'lines')} | ${cell('to', 'vscode_extension', 'complexity')} |`,
  `| 扩展测试源码 | ${cell('to', 'vscode_tests', 'files')} | ${cell('to', 'vscode_tests', 'lines')} | ${cell('to', 'vscode_tests', 'complexity')} |`,
  '',
  '## 口径与文件清单',
  '',
  '- 行数：Git blob 的物理行数，保留空行与注释，保证可重复。',
  '- 圈复杂度：文件级 `1 + TypeScript AST 决策点`；决策点包括 if、for、while、do、case、catch、条件表达式及 `&&`/`||`/`??`。这是统一口径的静态近似，不声称等同于某一商业工具。',
  '- 排除依赖、构建产物和 CLI 测试；VSCode 扩展及测试单列。',
  '- 逐文件行数、复杂度、SHA-256 与职责见 `files.tsv`；机器可读完整数据见 `metrics.json`。',
  '',
];
fs.writeFileSync(path.join(outputDir, 'summary.md'), lines.join('\n'));
console.log(`metrics generated: ${from} (${revisions.from}) -> ${to} (${revisions.to})`);
console.log(`output: ${path.relative(repoRoot, outputDir)}`);
