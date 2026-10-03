#!/usr/bin/env node
/**
 * Offline / Build-time runtime package installer for Piston.
 * Installs core language runtimes directly into /piston/packages
 * during Docker image build without requiring a running Piston API daemon.
 */

require('nocamel');
const path = require('path');
const fss = require('fs');
const Package = require('/piston_api/src/package');

// Core runtimes matching Piston's official package repository slugs:
// Index source: https://github.com/engineer-man/piston/releases/download/pkgs/index
const RUNTIMES = [
    'python', // Installs latest python (e.g. 3.12.0)
    'node',   // Note: package slug in Piston repo is 'node', not 'nodejs'
    'gcc',    // C / C++ compiler
    'java',   // Java runtime / JDK
    'go',     // Go compiler
    'rust',   // Rust compiler
];

(async () => {
    console.log('[piston-prebaked] Pre-installing core language runtimes...');

    for (const name of RUNTIMES) {
        console.log(`[piston-prebaked] Resolving latest package for: ${name}...`);
        const pkg = await Package.get_package(name, '*');

        if (!pkg) {
            console.error(`[piston-prebaked] ❌ Package not found in repository index: ${name}`);
            process.exit(1);
        }

        console.log(`[piston-prebaked] Downloading and unpacking ${pkg.language} (${pkg.version.raw})...`);
        await pkg.install();

        // Clean up downloaded archive immediately to save disk space
        const pkgTar = path.join(pkg.install_path, 'pkg.tar.gz');
        if (fss.existsSync(pkgTar)) {
            fss.unlinkSync(pkgTar);
            console.log(`[piston-prebaked] Removed archive ${pkgTar}`);
        }

        console.log(`[piston-prebaked] ✓ Installed ${pkg.language} (${pkg.version.raw})`);
    }

    console.log('[piston-prebaked] All core runtimes installed successfully.');
})().catch(err => {
    console.error('[piston-prebaked] ❌ Fatal error installing runtimes:', err);
    process.exit(1);
});
