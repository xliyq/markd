/** css ?inline 导入类型（vite 注入字符串） */
declare module "*.css?inline" {
  const css: string
  export default css
}
