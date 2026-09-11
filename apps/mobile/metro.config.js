const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm keeps dependencies in the store and symlinks them, so Metro is told
// where the workspace is and to look only in the two places that exist,
// rather than walking parent directories hoping to find a flat tree.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Hierarchical lookup stays on: pnpm keeps each package's own dependencies
// beside it, so a package resolving its own imports has to be able to walk up.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
