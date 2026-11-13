// Compiles story/main.ink (and its INCLUDEs) into ink JSON using inkjs's own compiler.
// Used by the Vite plugin and by the tests, so the game and the walker run the same story.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Compiler, CompilerOptions } from 'inkjs/full';

export function compileInkFile(mainPath: string): string {
  const root = dirname(mainPath);
  const fileHandler = {
    ResolveInkFilename: (name: string) => resolve(root, name),
    LoadInkFileContents: (full: string) => readFileSync(full, 'utf8'),
  };
  const errors: string[] = [];
  const options = new CompilerOptions(
    mainPath, [], false,
    (message: string, type: number) => { if (type === 2) errors.push(message); },
    fileHandler as any,
  );
  const compiler = new Compiler(readFileSync(mainPath, 'utf8'), options);
  const story = compiler.Compile();
  if (errors.length || !story) {
    throw new Error('ink compile failed:\n' + errors.join('\n'));
  }
  return story.ToJson() as string;
}
