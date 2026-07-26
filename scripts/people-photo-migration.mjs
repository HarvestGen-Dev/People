#!/usr/bin/env node
// <!-- AGENT: DEVOPS -->
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';
import {
  PhotoMigrationError,
  defaultMigrationPaths,
  runDryRun,
  runInventory,
  runMigration,
  runRollbackPlan,
  runVerification,
  sanitizeCliError,
  validateCommandOptions,
  validateProjectBinding,
} from './lib/people-photo-migration.mjs';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

const SUPPORTED_COMMANDS = new Set([
  'inventory',
  'dry-run',
  'migrate',
  'verify',
  'rollback-plan',
]);

function usage() {
  return `Usage:
  npm run people-photos:migrate -- inventory --project-ref <ref>
  npm run people-photos:migrate -- dry-run --project-ref <ref> --church-id <uuid>
  npm run people-photos:migrate -- migrate --project-ref <ref> --church-id <uuid> --confirm [--allow-remote]
  npm run people-photos:migrate -- verify --project-ref <ref> --church-id <uuid> --state-file <path>
  npm run people-photos:migrate -- rollback-plan --project-ref <ref> --church-id <uuid> --state-file <path>

Options:
  --limit <number>          Bound records examined in this invocation.
  --resume-from <uuid>      Continue after this person ID.
  --state-file <path>       Protected resume and rollback checkpoint.
  --output <path>           PII-free JSONL audit output.
  --confirm                 Required for every migration write.
  --allow-remote            Additional requirement for remote migration writes.
`;
}

function positiveInteger(value, name) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new PhotoMigrationError('invalid_option', `${name} must be a positive integer.`);
  }
  return parsed;
}

function parseCommandLine(argv) {
  const command = argv[0]?.startsWith('-') || !argv[0] ? 'inventory' : argv[0];
  if (!SUPPORTED_COMMANDS.has(command)) {
    throw new PhotoMigrationError('unsupported_command', 'Unsupported photo migration command.');
  }
  const optionArgs = command === 'inventory' && argv[0]?.startsWith('-') ? argv : argv.slice(1);
  const { values } = parseArgs({
    args: optionArgs,
    strict: true,
    allowPositionals: false,
    options: {
      'project-ref': { type: 'string' },
      'church-id': { type: 'string' },
      confirm: { type: 'boolean', default: false },
      'allow-remote': { type: 'boolean', default: false },
      limit: { type: 'string' },
      'resume-from': { type: 'string' },
      'state-file': { type: 'string' },
      output: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  return {
    command,
    projectRef: values['project-ref'],
    churchId: values['church-id'],
    confirm: values.confirm,
    allowRemote: values['allow-remote'],
    limit: positiveInteger(values.limit, '--limit'),
    resumeFrom: values['resume-from'],
    stateFile: values['state-file'],
    auditFile: values.output,
    help: values.help,
  };
}

async function newestStateFile({ projectRef, churchId }) {
  const directory = path.join(
    os.homedir(),
    '.local',
    'state',
    'people-hg-photo-migration',
    projectRef,
    churchId
  );
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new PhotoMigrationError('state_read_failed', 'State directory could not be read.');
  }
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.state.json'))
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        return { filePath, stat: await fs.stat(filePath) };
      })
  );
  candidates.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
  return candidates[0]?.filePath ?? null;
}

async function main() {
  const options = parseCommandLine(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new PhotoMigrationError(
      'configuration_missing',
      'Supabase URL and service-role credentials must be loaded from protected environment configuration.'
    );
  }

  const binding = validateProjectBinding({
    projectRef: options.projectRef,
    supabaseUrl,
  });
  options.isRemote = binding.isRemote;
  validateCommandOptions(options.command, options);

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
    realtime: { transport: ws },
  });

  let stateFile = options.stateFile;
  let auditFile = options.auditFile;
  if (options.command === 'migrate' && (!stateFile || !auditFile)) {
    const defaults = defaultMigrationPaths({
      projectRef: options.projectRef,
      churchId: options.churchId,
      operationId: crypto.randomUUID(),
    });
    stateFile ??= defaults.stateFile;
    auditFile ??= defaults.auditFile;
  }
  if (
    (options.command === 'verify' || options.command === 'rollback-plan') &&
    !stateFile
  ) {
    stateFile = await newestStateFile(options);
  }
  if (
    (options.command === 'verify' || options.command === 'rollback-plan') &&
    !stateFile
  ) {
    throw new PhotoMigrationError(
      'state_not_found',
      'No protected migration state was found for this project and tenant.'
    );
  }

  let result;
  if (options.command === 'inventory') {
    result = await runInventory({ client, projectRef: options.projectRef });
  } else if (options.command === 'dry-run') {
    result = await runDryRun({
      client,
      projectRef: options.projectRef,
      churchId: options.churchId,
      supabaseUrl,
      limit: options.limit,
      resumeFrom: options.resumeFrom,
      auditFile,
    });
  } else if (options.command === 'migrate') {
    result = await runMigration({
      client,
      projectRef: options.projectRef,
      churchId: options.churchId,
      supabaseUrl,
      confirm: options.confirm,
      isRemote: options.isRemote,
      allowRemote: options.allowRemote,
      stateFile,
      auditFile,
      limit: options.limit,
      resumeFrom: options.resumeFrom,
    });
  } else if (options.command === 'verify') {
    result = await runVerification({
      client,
      projectRef: options.projectRef,
      churchId: options.churchId,
      stateFile,
    });
  } else {
    result = await runRollbackPlan({
      client,
      projectRef: options.projectRef,
      churchId: options.churchId,
      stateFile,
    });
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify(sanitizeCliError(error))}\n`);
  process.exitCode = 1;
});
