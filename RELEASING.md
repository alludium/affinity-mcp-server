# Releasing `@alludium/affinity-mcp-server`

Releases are deliberate and manual. Do not publish a new package version for documentation, packaging checks, or routine repository maintenance.

## Prepare the release

1. Start from a clean checkout of `main` and update it without a merge commit:

   ```bash
   git checkout main
   git pull --ff-only
   git status --short
   ```

   `git status --short` must produce no output.

2. For a real release, select the intended semantic version bump and make that version change part of the reviewed release change:

   ```bash
   npm version <patch|minor|major> --no-git-tag-version
   ```

   Review and merge the resulting version change before publishing. Do not reuse a previously published version or bump a version solely to exercise this procedure.

3. On the merged release version in clean `main`, install and validate:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   npm pack --dry-run
   ```

   Inspect the dry-run file list. It must include the built `dist/` output and the expected package metadata; do not publish if it does not.

`prepack` runs `npm run build` before both `npm pack` and `npm publish`. The explicit build above is still useful as a direct build check, while the lifecycle hook protects the tarball from a stale or missing `dist/` directory.

## Publish and verify the registry

1. Confirm the authenticated npm identity and publish interactively. Keep npm's two-factor prompt interactive; do not place an OTP or npm token in scripts, CI configuration, or shell history.

   ```bash
   npm whoami
   npm publish --access public
   ```

2. Verify that the published version and `latest` tag are the intended values:

   ```bash
   npm view @alludium/affinity-mcp-server@<version> version dist.tarball
   npm view @alludium/affinity-mcp-server dist-tags --json
   ```

## Update Platform deliberately

Publishing to npm does not alter an existing Platform image or deployed environment. For a released version:

1. Update the exact `@alludium/affinity-mcp-server@<version>` pin in both `craft-ai-agents/Dockerfile` and `craft-ai-agents/Dockerfile.dev`.
2. Rebuild and deploy the relevant Platform image.
3. Verify the installed package version inside the deployed container. That version is the runtime evidence, not the registry value alone.
4. Run connector acceptance testing against the deployed Platform.

Do not add automated publishing, npm credentials, or Trusted Publisher configuration as part of this manual process.
