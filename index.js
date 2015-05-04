'use strict';

const child_process = require('child_process');
const remove = require('remove');
const path = require('path');
const join = path.join;
const fs = require('fs');
const async = require('async');
const semver = require('semver');

let options;
try {
    options = require('./config.json');
} catch (e) {
    console.error('Could not find config.json. Please copy config.default.json and use it as an example');
    process.exit(1);
}

const visualizerRepo = path.resolve(options.repo);
const visualizerHead = join(visualizerRepo, 'head');
const visualizerBuild = join(visualizerRepo, 'build');
const cdnDir = path.resolve(options.out);

const execOptionsHead = {
    cwd: visualizerHead
};

const execOptionsBuild = {
    cwd: visualizerBuild
};

console.log(new Date().toISOString());
console.log('Starting visualizer update');
pull();

let tags = [];
let latest = false;
function pull() {
    // Update to latest commit
    console.log('Pulling latest changes');
    child_process.execFile('git', ['pull', '--no-stat', '--tags', 'origin', 'gh-pages'], execOptionsHead, function (err, stdout, stderr) {
        if (err) throw err;
        // Check if new tags were found
        if (stderr.indexOf('[new tag]') >= 0) {
            let lines = stderr.split(/[\r\n]/),
                reg = /\[new tag] *([^ ]*) *->/;
            for (let i = 0; i < lines.length; i++) {
                let result = reg.exec(lines[i]);
                if (result && result[1][0] === 'v') {
                    tags.push(result[1]);
                    let version = semver(result[1]);
                    if (!version.prerelease.length) {
                        latest = result[1];
                    }
                }
            }
        }

        if (stdout.indexOf('Already up-to-date') > -1) {
            console.log('Repository up-to-date');
            pullTags();
        } else {
            console.log('New commits found');
            updateHeadMin();
        }
    });
}

function updateHeadMin() {
    let cdnHeadMinFinal = join(cdnDir, 'HEAD-min');
    let cdnHeadMinOld = join(cdnDir, 'oldHEAD-min');
    console.log('Building the visualizer HEAD-min');
    child_process.execFile('npm', ['install'], execOptionsHead, function (err) {
        if (err) throw err;
        child_process.execFile('npm', ['run', 'build'], execOptionsHead, function (err) {
            if (err) throw err;
            let exist = false;
            try {
                fs.renameSync(cdnHeadMinFinal, cdnHeadMinOld);
                exist = true;
            } catch (e) {
            }
            fs.renameSync(join(visualizerHead, 'build'), cdnHeadMinFinal);
            if (exist) {
                remove.removeSync(cdnHeadMinOld);
            }
            console.log('HEAD-min version copied');
            pullTags();
        });
    });
}

function pullTags() {
    // Get latest tags
    child_process.execFile('git', ['pull', '--no-stat', '--tags', 'origin', 'gh-pages'], execOptionsBuild, function (err) {
        if (err) throw err;
        if (tags.length) {
            console.log('Building ' + tags.length + ' new tag(s)');
            async.eachSeries(tags, buildTag, checkoutMaster);
        } else {
            console.log('No new tag');
            finish();
        }
    });
}

function buildTag(tag, callback) {
    child_process.execFile('git', ['checkout', 'tags/' + tag], execOptionsBuild, function (err) {
        if (err) throw err;
        console.log('Checked out ' + tag);
        doBuild(tag, callback);
    });
}

function doBuild(version, callback) {
    // Launch the building script
    console.log('Building the visualizer ' + version);
    child_process.execFile('npm', ['install'], execOptionsBuild, function (err) {
        if (err) throw err;
        child_process.execFile('npm', ['run', 'build'], execOptionsBuild, function (err) {
            if (err) throw err;
            let cdnBuild = join(cdnDir, version);
            fs.renameSync(join(visualizerBuild, 'build'), cdnBuild);
            console.log(version + ' version copied');
            callback();
        });
    });
}

function checkoutMaster() {
    child_process.execFile('git', ['checkout', 'gh-pages'], execOptionsBuild, function (err) {
        if (err) throw err;
        linkLatest();
    });
}

function linkLatest() {
    if (latest) {
        let latestPath = join(cdnDir, 'latest');
        console.log('Creating link to new latest release : ' + latest);
        try {
            fs.unlinkSync(latestPath);
        } catch (e) {
        }
        fs.symlinkSync(join(cdnDir, latest), latestPath);
    }
    finish();
}

const versionReg = /^v\d/;
function finish() {
    if (tags.length) {
        // create versions.json
        let items = fs.readdirSync(cdnDir).filter(function (item) {
            return versionReg.test(item);
        });
        items.sort(semver.rcompare);
        items.unshift('HEAD', 'HEAD-min', 'latest');
        fs.writeFileSync(join(cdnDir, 'versions.json'), JSON.stringify(items));
    }
    console.log('Visualizer update finished');
}

function createCopier(sourceDir, destDir) {
    return function (file) {
        let content = fs.readFileSync(join(sourceDir, file));
        fs.writeFileSync(join(destDir, file), content);
    }
}
