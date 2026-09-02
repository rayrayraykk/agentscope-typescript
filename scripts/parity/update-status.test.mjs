import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const scriptPath = fileURLToPath(new URL('./update-status.mjs', import.meta.url));

test('updates contract-data entries through the CLI', async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'agentscope-parity-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const manifestPath = path.join(directory, 'manifest.json');
    const digest = '0'.repeat(64);
    const manifest = {
        schemaVersion: 1,
        pythonCommit: '0'.repeat(40),
        sourceFiles: [],
        contractDataFiles: [
            {
                path: 'src/agentscope/embedding/model.yaml',
                sha256: digest,
                module: 'embedding',
                typescriptTarget: 'packages/agentscope/src/embedding',
                status: 'mapped',
            },
        ],
        testFiles: [],
        summary: {
            sourceFiles: { count: 0, sha256: digest },
            contractDataFiles: { count: 1, sha256: digest },
            testFiles: { count: 0, sha256: digest },
        },
    };
    await writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

    const { stdout } = await execute(process.execPath, [
        scriptPath,
        '--manifest',
        manifestPath,
        '--status',
        'verified',
        '--contract-data',
        'src/agentscope/embedding/model.yaml',
    ]);

    assert.equal(stdout, 'Updated 0 source and 1 contract-data entries to verified.\n');
    assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), {
        ...manifest,
        contractDataFiles: [
            {
                ...manifest.contractDataFiles[0],
                status: 'verified',
            },
        ],
    });
});
