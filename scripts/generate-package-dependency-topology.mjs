import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "docs", "package-dependency-topology.md");
const projectRoots = ["apps", "packages"];

const projects = readProjects();
const projectsByPackageName = new Map(projects.map((project) => [project.packageName, project]));
const manifestEdges = collectManifestEdges();
const sourceEdges = collectSourceEdges();

fs.writeFileSync(outputPath, renderDocument(), "utf8");
console.log(`Updated ${path.relative(root, outputPath)}`);

function readProjects() {
  const result = [];
  for (const rootName of projectRoots) {
    const rootDir = path.join(root, rootName);
    if (!fs.existsSync(rootDir)) continue;

    for (const entry of sortedDirents(rootDir)) {
      if (!entry.isDirectory()) continue;
      const packageJsonPath = path.join(rootDir, entry.name, "package.json");
      if (!fs.existsSync(packageJsonPath)) continue;

      const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      result.push({
        id: toMermaidId(entry.name),
        directory: `${rootName}/${entry.name}`,
        packageName: manifest.name,
        manifest,
        srcDir: path.join(rootDir, entry.name, "src")
      });
    }
  }

  return result.sort((left, right) => left.directory.localeCompare(right.directory));
}

function collectManifestEdges() {
  const edges = [];
  for (const project of projects) {
    const deps = {
      ...(project.manifest.dependencies ?? {}),
      ...(project.manifest.peerDependencies ?? {})
    };
    for (const dependencyName of Object.keys(deps).sort()) {
      const target = projectsByPackageName.get(dependencyName);
      if (!target) continue;
      edges.push({ from: project, to: target, typeOnly: false });
    }
  }
  return sortEdges(edges);
}

function collectSourceEdges() {
  const edges = new Map();
  for (const project of projects) {
    for (const file of walkSourceFiles(project.srcDir)) {
      const content = fs.readFileSync(file, "utf8");
      for (const item of findImports(content)) {
        const target = projectsByPackageName.get(item.specifier);
        if (!target || target.packageName === project.packageName) continue;

        const key = `${project.packageName}->${target.packageName}`;
        const existing = edges.get(key) ?? {
          from: project,
          to: target,
          typeOnly: true,
          files: []
        };
        existing.typeOnly = existing.typeOnly && item.typeOnly;
        addSourceFile(existing, file, item.typeOnly);
        edges.set(key, existing);
      }
    }
  }
  return sortEdges([...edges.values()]);
}

function addSourceFile(edge, file, typeOnly) {
  const sourceFile = {
    file: normalizePath(path.relative(root, file)),
    typeOnly
  };
  if (edge.files.some((item) => item.file === sourceFile.file && item.typeOnly === sourceFile.typeOnly)) {
    return;
  }
  edge.files.push(sourceFile);
}

function findImports(content) {
  const imports = [];
  const importPattern =
    /import\s+(type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|export\s+(type\s+)?[^'";]*?\s+from\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    imports.push({
      typeOnly: Boolean(match[1] || match[3]),
      specifier: match[2] || match[4] || match[5] || match[6]
    });
  }
  return imports;
}

function walkSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of sortedDirents(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["dist", "node_modules"].includes(entry.name)) continue;
      walkSourceFiles(full, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

function renderDocument() {
  return `# meta-lc-platform 包依赖拓扑图

生成口径：

- 生成脚本：\`pnpm docs:topology\` / \`node scripts/generate-package-dependency-topology.mjs\`。
- 范围：\`pnpm-workspace.yaml\` 中的 \`packages/*\` 与 \`apps/*\`。
- \`examples/*\`、\`infra/*\`、\`scripts/*\` 不参与生产 package 拓扑。
- Manifest 图：统计 \`package.json\` 中的 workspace \`dependencies\` / \`peerDependencies\`。
- Source 图：只统计生产代码 \`src/**/*.ts\` 的 workspace \`import\` / \`export from\` / \`require\` / dynamic \`import()\`。
- 边方向：\`A --> B\` 表示 **A 依赖 B**。
- \`type-only\` 表示当前源码边只来自 \`import type\` / \`export type from\`。
- \`packages/migration\` 已删除；migration lifecycle 下沉到 \`infra/\` scripts，并复用 \`kernel\` 内部能力。
- \`packages/contracts\`、\`packages/shared\`、\`packages/platform\` 已删除；contract 归属具体架构层包。

## Manifest 依赖拓扑

这张图表示 package manifest 声明的 workspace 依赖，也是边界规则允许的包级依赖形态。

${renderMermaid(manifestEdges)}

## Source Import 拓扑

这张图表示当前生产源码真实 import 关系。封板口径要求 \`bff\` 不直接 import \`kernel\`；\`/meta/*\` 如需 kernel-backed 数据，必须通过 BFF 包外注入的 meta registry provider 装配。

${renderMermaid(sourceEdges)}

## Source Import 明细

${renderSourceDetails()}

## 分层视图

按 package manifest 依赖方向从入口到基础包看：

1. \`@zhongmiao/meta-lc-bff-server\`
2. \`@zhongmiao/meta-lc-bff\`
3. \`@zhongmiao/meta-lc-runtime\`
4. \`@zhongmiao/meta-lc-kernel\`, \`@zhongmiao/meta-lc-permission\`, \`@zhongmiao/meta-lc-datasource\`, \`@zhongmiao/meta-lc-audit\`
5. \`@zhongmiao/meta-lc-query\`

当前生产源码包 import 图没有发现环。

## 架构结论

- \`runtime\` 是唯一执行核心，持有 \`ExecutionPlan\`、\`ExecutionNode\`、\`Expression\`、\`RuntimeContext\` 等执行契约。
- \`kernel\` 是结构真源，持有 \`MetaSchema\`、\`ViewDefinition\`、\`NodeDefinition\`、\`DatasourceDefinition\`、\`PermissionPolicy\`。
- \`bff\` 是 IO Gateway，只持有 HTTP/WS DTO、controller、bootstrap wiring、gateway config、gateway cache 与 provider-backed meta registry integration。
- \`bff\` 只能依赖 \`runtime\`；不得直接依赖 \`kernel\`、\`query\`、\`permission\`、\`datasource\`、\`audit\` 或 \`pg\`。
- \`/meta/*\` 保留只读 HTTP envelope，但必须通过注入的 meta registry provider 读取数据；kernel-backed provider 只能在 BFF package 外部装配。
- \`datasource\` 与 \`audit\` 不得反向依赖 \`runtime\`；\`query\` 不得依赖 \`datasource\`。
- \`kernel\`、\`query\`、\`datasource\`、\`audit\` 禁止依赖任何 workspace package；\`kernel\` 可持有 meta DB persistence，但不得依赖 \`runtime\`、\`query\`、\`permission\`、\`datasource\`、\`audit\` 或 \`bff\`。
- \`permission\` 只能 type-only 依赖 \`query\` 的 AST/types；禁止 value import query compiler，禁止编译 SQL 或执行 datasource。
- \`Query --> Datasource\` 只允许表示 runtime 执行链路中的 compiled SQL/request handoff，不表示 \`packages/query\` import \`packages/datasource\`。
- \`infra/\` 承载 bootstrap SQL、docker、query-gate 等运维脚本，不作为 workspace package。
- \`examples/\` 承载业务 demo，不参与生产 package import 拓扑。\`examples/orders-demo\` 可以依赖核心 packages；核心 packages 与 apps 不得依赖 \`examples/*\`，删除 \`examples/\` 后 \`packages/*\` 仍必须能 build/test。
`;
}

function renderMermaid(edges) {
  const nodeLines = projects.map(
    (project) => `  ${project.id}["${project.packageName}<br/>${project.directory}"]`
  );
  const edgeLines = edges.map((edge) => {
    const label = edge.typeOnly ? ' -->|"type-only"| ' : " --> ";
    return `  ${edge.from.id}${label}${edge.to.id}`;
  });
  return ["```mermaid", "flowchart TD", ...nodeLines, "", ...edgeLines, "```"].join("\n");
}

function renderSourceDetails() {
  if (sourceEdges.length === 0) return "- 当前生产源码没有 workspace import。";

  return sourceEdges
    .map((edge) => {
      const edgeLabel = `- \`${edge.from.packageName}\` -> \`${edge.to.packageName}\`${edge.typeOnly ? " (type-only)" : ""}`;
      const files = edge.files
        .map((item) => `  - ${item.typeOnly ? "type-only" : "value"}: \`${item.file}\``)
        .join("\n");
      return `${edgeLabel}\n${files}`;
    })
    .join("\n");
}

function sortEdges(edges) {
  return edges.sort((left, right) =>
    `${left.from.packageName}->${left.to.packageName}`.localeCompare(
      `${right.from.packageName}->${right.to.packageName}`
    )
  );
}

function sortedDirents(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
}

function toMermaidId(value) {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}
