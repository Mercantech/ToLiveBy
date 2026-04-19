import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist", "renderer");

fs.mkdirSync(outDir, { recursive: true });

for (const file of ["index.html", "styles.css"]) {
  fs.copyFileSync(
    path.join(root, "src", "renderer", file),
    path.join(outDir, file),
  );
}
