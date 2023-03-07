import * as prettier from "prettier";
import asPlugin from "../src/plugin.js";

test("variant decorator", async () => {
  const originCode = `

@lazy let offset: usize = startOffset;

`;

  const formatedCode = await prettier.format(originCode, {
    parser: "typescript",
    plugins: [asPlugin],
  });

  expect(formatedCode).toMatchSnapshot();
});

test("function decorator", async () => {
  const originCode = `
  
    @global @unsafe
    export function __new(size: usize, id: i32): usize {}
    
  
  `;

  const formatedCode = await prettier.format(originCode, {
    parser: "typescript",
    plugins: [asPlugin],
  });

  expect(formatedCode).toMatchSnapshot();
});

test("class decorator", async () => {
  const originCode = `

      @global @unsafe
      export class AA

      {}

    `;

  const formatedCode = await prettier.format(originCode, {
    parser: "typescript",
    plugins: [asPlugin],
  });

  expect(formatedCode).toMatchSnapshot();
});
