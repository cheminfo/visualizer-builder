'use strict';

const fs = require('fs');
const cp = require('child_process');
const join = require('path').join;
const mkdirp = require('mkdirp');

const options = require('./options');

console.log('Checking main directories');

if (missing(options.repo)) {
    mkdirp.sync(options.repo);
    console.log(options.repo + ' created');
}

if (missing(options.out)) {
    mkdirp.sync(options.out);
    console.log(options.out + ' created');
}

console.log('Checking visualizer clones');

if (missing(options.head) || missing(join(options.head, '.git'))) {
    cp.execFileSync('git', ['clone', 'https://github.com/NPellet/visualizer.git', 'head'], {
        cwd: options.repo
    });
    console.log('Cloned visualizer-head');
}

if (missing(options.build) || missing(join(options.build, '.git'))) {
    cp.execFileSync('git', ['clone', 'head', 'build'], {
        cwd: options.repo
    });
    console.log('Cloned visualizer-build');
}

console.log('Checking symbolic links');

const headSrc = join(options.head, 'src');
createSymlinkIfMissing('HEAD', headSrc);
createSymlinkIfMissing('src', headSrc);
createSymlinkIfMissing('head', headSrc);

createSymlinkIfMissing('testcase', join(options.head, 'testcase'));
createSymlinkIfMissing('doc', join(options.head, 'doc'));

createSymlinkIfMissing('min', join(options.out, 'HEAD-min'));
createSymlinkIfMissing('build', join(options.out, 'HEAD-min'));

function missing(dir) {
    try {
        fs.accessSync(dir);
        return false;
    } catch (e) {
        return true;
    }
}

function createSymlinkIfMissing(name, target) {
    let symlink = join(options.out, name);
    let stat;
    try {
        stat = fs.lstatSync(symlink);
    } catch (e) {
        return fs.symlinkSync(target, symlink);
    }
    if (!stat.isSymbolicLink()) {
        throw new Error('There is already a file named ' + symlink);
    }
}
