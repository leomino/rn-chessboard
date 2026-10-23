# Contributing

Contributions are always welcome, no matter how large or small!

We want this community to be friendly and respectful to each other. Please follow it in all your interactions with the project. Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md).

## Development workflow

This project is a monorepo managed using [Yarn workspaces](https://yarnpkg.com/features/workspaces). It contains the following packages:

- The library package in the root directory.
- An example app in the `example/` directory.

Use Node 24 LTS (24.15.0 or newer) from `.nvmrc` and the pinned Yarn 4.18.1 release. To install the
required dependencies for each package:

```sh
nvm use
corepack enable
yarn install --immutable
```

Use Yarn for repository development and commit `yarn.lock` with dependency changes.
Run `yarn install` when intentionally updating dependencies. Avoid generating an npm
lockfile here. Consumers can install the published package with either npm or Yarn.
If Corepack is unavailable, use `node .yarn/releases/yarn-4.18.1.cjs` in place of `yarn`.

The [example app](./example/) demonstrates usage of the library. Run it to test changes you make.

It is configured to use the local version of the library, so any changes you make to the library's source code will be reflected in the example app. Changes to the library's JavaScript code will be reflected in the example app without a rebuild, but native code changes will require a rebuild of the example app.

You can use various commands from the root directory to work with the project.

To start the packager:

```sh
yarn example start
```

To run the example app on Android:

```sh
yarn example android
```

To run the example app on iOS:

```sh
yarn example ios
```

To run the example app on Web:

```sh
yarn example web
```

Make sure your code passes TypeScript and ESLint. Run the following to verify:

```sh
yarn typecheck
yarn lint
```

To fix formatting errors, run the following:

```sh
yarn lint --fix
```

Remember to add tests for your change if possible. Run the unit tests by:

```sh
yarn test
```

### Commit message convention

We follow the [conventional commits specification](https://www.conventionalcommits.org/en) for our commit messages:

- `fix`: bug fixes, e.g. fix crash due to deprecated method.
- `feat`: new features, e.g. add new method to the module.
- `refactor`: code refactor, e.g. migrate from class components to hooks.
- `docs`: changes into documentation, e.g. add usage example for the module..
- `test`: adding or updating tests, e.g. add integration tests using detox.
- `chore`: tooling changes, e.g. change CI config.

Our commit-msg hook verifies that your commit message matches this format.

### Linting and tests

[ESLint](https://eslint.org/), [Prettier](https://prettier.io/), [TypeScript](https://www.typescriptlang.org/)

We use [TypeScript](https://www.typescriptlang.org/) for type checking, [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and formatting the code, and [Jest](https://jestjs.io/) for testing.

Our pre-commit hooks run the linter and type checker. Run `yarn validate` before
submitting a pull request; it also runs the unit tests and packed-package checks.

### Testing the published package

```sh
yarn test:package
```

This builds the library, creates an npm tarball, installs it with the supported
peer dependencies in a temporary consumer app, checks public TypeScript types
with both Node16 and bundler resolution, verifies worklet conversion, and creates
iOS and Android Metro bundles using package exports.
The consumer has no Expo dependency or source alias. This check needs registry
access and cleans up the temporary app when finished. It does not replace native
device testing of gestures and animations.

### Publishing to npm

We use [release-it](https://github.com/release-it/release-it) to make it easier to publish new versions. It handles common tasks like bumping version based on semver, creating tags and releases etc.

To publish new versions, run the following:

```sh
yarn release
```

Before releasing, ensure CI passes and manually check tap/drag moves, promotion,
and board rotation in the example development build on iOS and Android. The release
command runs `yarn validate` before creating release commits or tags. Direct
`npm publish` also runs validation via `prepublishOnly`; npm and Yarn packing build
the package via `prepack`.

Publishing requires npm publish access to `rn-chessboard` and a `GITHUB_TOKEN` with
permission to create repository releases. Authenticate with npm and follow its
2FA prompt where required. Releases are initiated locally; CI validates pull requests.

### Scripts

The `package.json` file contains various scripts for common tasks:

- `yarn`: setup project by installing dependencies.
- `yarn typecheck`: type-check files with TypeScript.
- `yarn lint`: lint files with ESLint.
- `yarn test`: run unit tests with Jest.
- `yarn test:package`: build and verify the installable npm tarball.
- `yarn validate`: run all pre-release checks.
- `yarn example start`: start the Metro server for the example app.
- `yarn example android`: run the example app on Android.
- `yarn example ios`: run the example app on iOS.

### Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that linters and tests are passing.
- Review the documentation to make sure it looks good.
- Include a summary and the checks you ran when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.
