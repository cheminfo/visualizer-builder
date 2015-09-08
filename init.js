'use strict';

const fs = require('fs');
const cp = require('child_process');
const join = require('path').join;
const mkdirp = require('mkdirp');
const async = require('async');
const semver = require('semver');
const targz = require('tar.gz');

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
    cp.execFileSync('git', ['clone', '-b', 'master','https://github.com/NPellet/visualizer.git', 'head'], {
        cwd: options.repo
    });
    console.log('Cloned visualizer-head');
}

if (missing(options.build) || missing(join(options.build, '.git'))) {
    cp.execFileSync('git', ['clone', '-b', 'master', 'head', 'build'], {
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

console.log('Copy static files');

var staticFiles = fs.readdirSync('./static');
for (var i = 0; i < staticFiles.length; i++) {
    fs.writeFileSync(join(options.out, staticFiles[i]), fs.readFileSync(join('./static', staticFiles[i])));
}

console.log('Create missing tarballs');

var outContents = fs.readdirSync(options.out);
async.eachSeries(outContents, function (data, done) {
    var folder = join(options.out, data);
    var tgz = join(options.out, data + '.tar.gz');
    if(data.startsWith('v') && semver.valid(data) && missing(tgz)) {
        var stat = fs.lstatSync(folder);
        if (stat.isSymbolicLink()) {
            var dest = fs.readlinkSync(folder) + '.tar.gz';
            fs.symlinkSync(dest, tgz);
            done();
        } else {
            targz().compress(folder, tgz, function (err) {
                if (err) return done(err);
                done();
            });
        }
    }
    done();
}, function (e) {
    if (e) throw e;
});

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
