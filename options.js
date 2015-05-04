'use strict';

const path = require('path');

let options;

try {
    options = require('./config.json');
} catch (e) {
    console.error('Could not find config.json. Please copy config.default.json and use it as an example');
    process.exit(1);
}

const visualizerRepo = path.resolve(options.repo);

module.exports = {
    repo: visualizerRepo,
    head: path.join(visualizerRepo, 'head'),
    build: path.join(visualizerRepo, 'build'),
    out: path.resolve(options.out)
};
