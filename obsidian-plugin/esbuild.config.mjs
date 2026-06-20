import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    ...builtins,
  ],
  format: "cjs",
  target: "es2020",
  platform: "browser",
  outfile: "main.js",
  sourcemap: prod ? false : "inline",
  minify: prod,
  treeShaking: true,
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": JSON.stringify(prod ? "production" : "development"),
  },
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
