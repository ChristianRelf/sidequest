import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { mkdir, writeFile } from "node:fs/promises";
import { CharacterArt } from "../src/components/character-art";
async function main() {
  await mkdir("public/characters", { recursive: true });
  for (const character of ["pip", "zip", "moss"] as const) {
    await writeFile(
      `public/characters/${character}.svg`,
      renderToStaticMarkup(createElement(CharacterArt, { character })),
    );
  }
  console.log("Exported 3 editable, articulated SVG characters.");
}
main();
