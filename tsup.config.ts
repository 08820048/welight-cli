import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [`src/index.ts`],
  format: [`esm`],
  target: `node22`,
  platform: `node`,
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  // 依赖（含 mermaid、linkedom、原生剪贴板）保持 external，由 npm 安装解析
  skipNodeModulesBundle: true,
})
