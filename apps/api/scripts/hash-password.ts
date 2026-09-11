import { createInterface } from 'node:readline/promises';
import { hash } from '@node-rs/argon2';

/**
 * Produces an argon2id hash for OWNER_PASSWORD_HASH.
 * Usage: pnpm --filter @seen/api hash-password            (prompts on stdin)
 *        echo -n 'secret' | pnpm --filter @seen/api hash-password --stdin
 */
async function readPassword(): Promise<string> {
  if (process.argv.includes('--stdin')) {
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    return data.replace(/\r?\n$/, '');
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const password = await rl.question('Owner password: ');
  rl.close();
  return password;
}

const password = await readPassword();
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}
// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane).
const digest = await hash(password, {
  // Algorithm.Argon2id is a const enum in the typings; the literal avoids an import that isolatedModules forbids.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});
process.stdout.write(`${digest}\n`);
