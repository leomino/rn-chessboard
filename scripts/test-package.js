const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { transformFileSync } = require('@babel/core');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const Metro = require('metro');

const root = path.resolve(__dirname, '..');
const manifest = require('../package.json');
const temporary = fs.mkdtempSync(
  path.join(os.tmpdir(), 'rn-chessboard-package-')
);
const consumer = path.join(temporary, 'consumer');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd = root, capture = false) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    env: { ...process.env, CI: 'true' },
  });
}

async function main() {
  run(npm, ['pack', '--loglevel=error', '--pack-destination', temporary]);
  const tarball = fs
    .readdirSync(temporary)
    .find((file) => file.endsWith('.tgz'));
  assert(tarball, 'npm pack must produce a tarball');

  fs.mkdirSync(consumer);
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({
      name: 'chessboard-package-consumer',
      private: true,
      dependencies: {
        'rn-chessboard': `file:${path.join(temporary, tarball)}`,
        ...Object.fromEntries(
          Object.keys(manifest.peerDependencies).map((name) => [
            name,
            manifest.devDependencies[name],
          ])
        ),
        '@types/react': manifest.devDependencies['@types/react'],
      },
    })
  );
  run(
    npm,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
    ],
    consumer
  );

  const consumerRequire = createRequire(path.join(consumer, 'package.json'));
  const installed = path.dirname(
    consumerRequire.resolve('rn-chessboard/package.json')
  );
  const files = fs.readdirSync(installed, { recursive: true });
  for (const field of ['main', 'module', 'types', 'react-native']) {
    assert(files.includes(manifest[field].replace(/^\.\//, '')), field);
  }
  assert(files.includes('LICENSE'));
  assert(files.includes('README.md'));
  assert(!files.some((file) => /__tests__|^example\/|^scripts\//.test(file)));
  assert(
    !files.some((file) =>
      /\/(icon|adaptive-icon|splash-icon|favicon)\.png$/.test(file)
    )
  );
  assert(
    !fs.lstatSync(installed).isSymbolicLink(),
    'Must test the npm tarball'
  );
  assert(!fs.existsSync(path.join(consumer, 'node_modules/expo')));
  assert.equal(
    consumerRequire.resolve('rn-chessboard'),
    path.join(installed, manifest.main)
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(installed, 'lib/module/package.json')))
      .type,
    'module'
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(installed, 'lib/commonjs/package.json'))
    ).type,
    'commonjs'
  );
  const nativeEntry = run(
    process.execPath,
    ['--conditions=react-native', '-p', 'require.resolve("rn-chessboard")'],
    consumer,
    true
  ).trim();
  assert.equal(nativeEntry, path.join(installed, manifest['react-native']));

  fs.writeFileSync(
    path.join(consumer, 'App.tsx'),
    `import { createRef, type ComponentRef } from 'react';
import ChessBoard, { type ChessBoardProps, type ChessBoardRef } from 'rn-chessboard';
const ref = createRef<ChessBoardRef>();
const inferredRef = createRef<ComponentRef<typeof ChessBoard>>();
const props: ChessBoardProps = {
  initialOrientation: 'w',
  onMove: move => { console.log(move.san); },
};
ref.current?.setOrientation('b');
inferredRef.current?.setOrientation('w');
// @ts-expect-error Only chess.js colors are valid orientations.
ref.current?.setOrientation('invalid');
// @ts-expect-error Invalid ref handles must be rejected.
const invalid = <ChessBoard ref={createRef<{ wrong: string }>()} />;
export default function App() { return <ChessBoard {...props} ref={ref} />; }
`
  );
  for (const resolution of ['node16', 'bundler']) {
    run(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--esModuleInterop',
        '--jsx',
        'react-jsx',
        '--module',
        resolution === 'node16' ? 'node16' : 'esnext',
        '--moduleResolution',
        resolution,
        'App.tsx',
      ],
      consumer
    );
  }

  const preset = require.resolve('@react-native/babel-preset');
  const plugin = consumerRequire.resolve('react-native-worklets/plugin');
  fs.writeFileSync(
    path.join(consumer, 'babel.config.js'),
    `module.exports = ${JSON.stringify({ presets: [preset], plugins: [plugin] })};`
  );
  const transformed = transformFileSync(nativeEntry, {
    babelrc: false,
    configFile: false,
    presets: [preset],
    plugins: [plugin],
  });
  assert(
    transformed.code.includes('__workletHash'),
    'Tap handler must be a worklet'
  );

  const config = mergeConfig(getDefaultConfig(consumer), {
    maxWorkers: 2,
    watchFolders: [
      consumer,
      path.dirname(require.resolve('metro-runtime/package.json')),
    ],
    resolver: { useWatchman: false },
    serializer: {
      getModulesRunBeforeMainModule: () => [
        consumerRequire.resolve('react-native/Libraries/Core/InitializeCore'),
      ],
      getPolyfills: () => consumerRequire('@react-native/js-polyfills')(),
    },
    transformer: {
      asyncRequireModulePath: consumerRequire.resolve(
        'metro-runtime/src/modules/asyncRequire'
      ),
    },
  });
  // React Native 0.88 requires package exports for its public subpaths.
  for (const platform of ['ios', 'android']) {
    await Metro.runBuild(config, {
      entry: 'App.tsx',
      platform,
      dev: false,
      minify: false,
      out: path.join(temporary, `${platform}.js`),
    });
  }
  console.log(
    'Packed-package checks passed: install, types, worklets, iOS and Android bundles.'
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(temporary, { recursive: true, force: true }));
