#!/usr/bin/env node
require('nocamel');
const Logger = require('logplease');
const express = require('express');
const expressWs = require('express-ws');
const globals = require('./globals');
const config = require('./config');
const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const body_parser = require('body-parser');
const runtime = require('./runtime');

const logger = Logger.create('index');
const app = express();
expressWs(app);

const API_KEY = process.env.PISTON_API_KEY || '';

(async () => {
    logger.info('Setting loglevel to', config.log_level);
    Logger.setLogLevel(config.log_level);

    if (!API_KEY) {
        logger.warn('PISTON_API_KEY is not set — all mutating requests will be rejected');
    }

    logger.debug('Ensuring data directories exist');

    Object.values(globals.data_directories).for_each(dir => {
        let data_path = path.join(config.data_directory, dir);

        logger.debug(`Ensuring ${data_path} exists`);

        if (!fss.exists_sync(data_path)) {
            logger.info(`${data_path} does not exist.. Creating..`);

            try {
                fss.mkdir_sync(data_path);
            } catch (e) {
                logger.error(`Failed to create ${data_path}: `, e.message);
            }
        }
    });

    logger.info('Loading packages');
    const pkgdir = path.join(
        config.data_directory,
        globals.data_directories.packages
    );

    const pkglist = await fs.readdir(pkgdir);

    const languages = await Promise.all(
        pkglist.map(lang => {
            return fs.readdir(path.join(pkgdir, lang)).then(x => {
                return x.map(y => path.join(pkgdir, lang, y));
            });
        })
    );

    const installed_languages = languages
        .flat()
        .filter(pkg =>
            fss.exists_sync(path.join(pkg, globals.pkg_installed_file))
        );

    installed_languages.for_each(pkg => runtime.load_package(pkg));

    logger.info('Starting API Server');
    logger.debug('Constructing Express App');
    logger.debug('Registering middleware');

    // Security headers
    app.use((req, res, next) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        res.set('Cache-Control', 'no-store');
        res.set('X-Powered-By', ''); // strip express default
        res.removeHeader('X-Powered-By');
        next();
    });

    app.use(body_parser.urlencoded({ extended: true, limit: '1mb' }));
    app.use(body_parser.json({ limit: '1mb' }));

    // API key authentication for mutating requests
    app.use((req, res, next) => {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }
        const provided = req.headers['x-piston-api-key'];
        if (!API_KEY || provided !== API_KEY) {
            logger.warn(`Rejected unauthenticated ${req.method} ${req.path} from ${req.ip}`);
            return res.status(401).send({ message: 'Unauthorized' });
        }
        next();
    });

    // Error handler — never leak stack traces
    app.use((err, req, res, next) => {
        logger.error(`Request error: ${err.message}`);
        return res.status(400).send({
            message: 'Bad Request',
        });
    });

    logger.debug('Registering Routes');

    const api_v2 = require('./api/v2');
    app.use('/api/v2', api_v2);

    const { version } = require('../package.json');

    app.get('/', (req, res, next) => {
        return res.status(200).send({ message: `Piston v${version}` });
    });

    app.use((req, res, next) => {
        return res.status(404).send({ message: 'Not Found' });
    });

    logger.debug('Calling app.listen');
    const [address, port] = config.bind_address.split(':');

    const server = app.listen(port, address, () => {
        logger.info('API server started on', config.bind_address);
    });

    process.on('SIGTERM', () => {
        server.close();
        process.exit(0)
    });
})();
