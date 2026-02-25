'use strict';

const child_process = require('child_process');
const remove = require('remove');
const path = require('path');
const join = path.join;
const fs = require('fs');
const async = require('async');
const semver = require('semver');
const targz = require('tar.gz');

const options = require('./options');

const visualizerHead = options.head;
const visualizerBuild = options.build;
const outDir = options.out;
const gitTimeout = 60000; // 1 minute

const execOptionsHead = {
    cwd: visualizerHead
};

const gitExecOptionsHead = {
    cwd: visualizerHead,
    timeout: gitTimeout
};

const execOptionsBuild = {
    cwd: visualizerBuild
};

const gitExecOptionsBuild = {
    cwd: visualizerBuild,
    timeout: gitTimeout
};


// List of new v* tags to build
let newVersionTags = [];

// Aliases to v* tags to renew symlinks for
// Key: alias name
// Value: version tag
const aliases = new Map();

function pull() {
    // Update to latest commit
    console.log('Pulling latest changes');
    child_process.execFileSync('git', ['reset', '--hard'], gitExecOptionsHead); // make sure there are no residual local changes
    child_process.execFile('git', ['pull', '--no-stat', '--tags', 'origin', 'master'], gitExecOptionsHead, function (err, stdout, stderr) {
        if (err) throw err;
        // Check if new tags were found
        if (stderr.indexOf('[new tag]') >= 0) {
            let lines = stderr.split(/[\r\n]/),
                reg = /\[new tag] *([^ ]*) *->/;
            for (let i = 0; i < lines.length; i++) {
                let result = reg.exec(lines[i]);
                if (result && result[1][0] === 'v') {
                    newVersionTags.push(result[1]);
                    let version = semver(result[1]);
                    if (!version.prerelease.length) {
                        aliases.set(`v${version.major}-latest`,result[1]);
                    }
                }
            }
        }

        if (stdout.indexOf('Already up to date') > -1) {
            console.log('Repository up-to-date');
            if (missing(join(outDir, 'HEAD-min'))) {
                console.log('HEAD-min is missing');
                updateHeadMin();
            } else {
                buildTags();
            }
        } else {
            console.log('New commits found');
            updateHeadMin();
        }
    });
}

function updateHeadMin() {
    let outHeadMinFinal = join(outDir, 'HEAD-min');
    let outHeadMinOld = join(outDir, 'oldHEAD-min');
    console.log('Building the visualizer HEAD-min');
    child_process.execFile('npm', ['ci'], execOptionsHead, function (err) {
        if (err) throw err;
        child_process.execFile('npm', ['run', 'postinstall'], execOptionsHead, function(err) {
            if(err) throw err;
            child_process.execFile('npm', ['run', 'build'], execOptionsHead, function (err) {
                if (err) throw err;
                let exist = false;
                try {
                    fs.renameSync(outHeadMinFinal, outHeadMinOld);
                    exist = true;
                } catch (e) {
                }
                fs.renameSync(join(visualizerHead, 'build'), outHeadMinFinal);
                if (exist) {
                    remove.removeSync(outHeadMinOld);
                }
                console.log('HEAD-min version copied');
                targz(null, {fromBase: true}).compress(outHeadMinFinal, outHeadMinFinal + '.tar.gz', function (err) {
                    if (err) throw err;
                    console.log('HEAD-min.tar.gz created');
                    buildTags();
                });
            });
        });
    });
}

function buildTags() {
    // Get latest tags
    child_process.execFileSync('git', ['reset', '--hard'], gitExecOptionsBuild); // make sure there are no residual local changes
    child_process.execFile('git', ['pull', '--no-stat', '--tags', 'origin', 'master'], gitExecOptionsBuild, function (err) {
        if (err) throw err;
        if (newVersionTags.length) {
            console.log('Building ' + newVersionTags.length + ' new tag(s)');
            async.eachSeries(newVersionTags, buildTag, checkoutMaster);
        } else {
            console.log('No new tag');
            checkRelease();
        }
    });
}

function buildTag(tag, callback) {
    child_process.execFileSync('git', ['reset', '--hard'], gitExecOptionsBuild); // make sure there are no residual local changes
    child_process.execFile('git', ['checkout', 'tags/' + tag], gitExecOptionsBuild, function (err) {
        if (err) throw err;
        console.log('Checked out ' + tag);
        doBuildTag(tag, callback);
    });
}

function doBuildTag(version, callback) {
    // Launch the building script
    console.log('Building the visualizer ' + version);
    child_process.execFile('npm', ['ci'], execOptionsBuild, function (err) {
        if (err) throw err;
        child_process.execFile('npm', ['run', 'postinstall'], execOptionsBuild, function(err) {
            if(err) throw err;
            child_process.execFile('npm', ['run', 'build'], execOptionsBuild, function (err) {
                if (err) throw err;
                let outBuild = join(outDir, version);
                fs.renameSync(join(visualizerBuild, 'build'), outBuild);
                console.log(version + ' version copied');
                targz(null, {fromBase: true}).compress(outBuild, outBuild + '.tar.gz', function (err) {
                    if (err) throw err;
                    console.log(version + '.tar.gz created');
                    callback();
                });
            });
        });
    });
}

function checkoutMaster() {
    child_process.execFileSync('git', ['reset', '--hard'], gitExecOptionsBuild); // make sure there are no residual local changes
    child_process.execFile('git', ['checkout', 'master'], gitExecOptionsBuild, function (err) {
        if (err) throw err;
        linkLatest();
    });
}

function linkLatest() {
    const list = getBuiltReleaseList(true);
    const latest = list[0];
    if(latest) {
        aliases.set('latest', latest);
    }
    for(let [alias, version] of aliases.entries()) {
        let latestPath = join(outDir, alias);
        console.log(`Creating alias ${alias} to ${version}`);
        replaceSymlink(join(outDir, version), latestPath);
        replaceSymlink(join(outDir, version + '.tar.gz'), latestPath + '.tar.gz');
    }
    checkRelease();
}

function checkRelease() {
    let stableList = getBuiltReleaseList(true);
    if (!stableList.length) {
        console.log('No release found, building latest stable tag');
        let tags = child_process.execFileSync('git', ['tag', '-l'], gitExecOptionsBuild).toString();
        let list = tags.split(/[\r\n]+/g).filter(getFilter(true)).sort(semver.rcompare);
        if (list.length === 0) {
            console.log('No tag to build');
            finish();
        } else {
            let tag = list[0];
            buildTag(tag, linkLatest);
        }
    } else {
        finish();
    }
}

function finish() {
    // create versions.json
    let items = getBuiltReleaseList();
    items.unshift('HEAD', 'HEAD-min', 'latest');
    fs.writeFileSync(join(outDir, 'versions.json'), JSON.stringify(items));
    console.log('Visualizer update finished');
}

function createCopier(sourceDir, destDir) {
    return function (file) {
        let content = fs.readFileSync(join(sourceDir, file));
        fs.writeFileSync(join(destDir, file), content);
    }
}

function missing(dir) {
    try {
        fs.accessSync(dir);
        return false;
    } catch (e) {
        return true;
    }
}

const versionReg = /^v\d/;
function getFilter(onlyStable) {
    return function (item) {
        let ok = versionReg.test(item) && semver.valid(item);
        if (ok && onlyStable) {
            return semver(item).prerelease.length === 0;
        }
        return ok;
    };
}

function getBuiltReleaseList(onlyStable) {
    let items = fs.readdirSync(outDir).filter(getFilter(onlyStable));
    items.sort(semver.rcompare);
    return items;
}

function replaceSymlink(dest, target) {
    try {
        fs.unlinkSync(target);
    } catch (e) {
    }
    fs.symlinkSync(dest, target);
}

console.log(new Date().toISOString());
console.log('Starting visualizer update');
pull();
