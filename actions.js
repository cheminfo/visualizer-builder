'use strict';

const program = require('commander');
const fs = require('fs');
const semver = require('semver');
const remove = require('remove').removeSync;
const join = require('path').join;

const options = require('./options');
const out = options.out;

program
    .command('merge <from> <to>')
    .description('Merge a release into another one')
    .action(function (from, to) {
        var sFrom = checkVersion(from, true);
        var sTo = checkVersion(to);
        if (!sFrom || !sTo) {
            return;
        }
        if (!semver.lt(sFrom, sTo)) {
            return console.error('"from" must be lower that "to"');
        }
        remove(join(out, from));
        fs.unlinkSync(join(out, from + '.tar.gz'));
        fs.symlinkSync(join(out, to), join(out, from));
        fs.symlinkSync(join(out, to + '.tar.gz'), join(out, from + '.tar.gz'));
    });

program.parse(process.argv);

function checkVersion(version, sym) {
    if (!semver.valid(version)) {
        return console.error('Invalid version number: ' + version);
    }
    try {
        var stat = fs.lstatSync(join(out, version));
        if (sym && stat.isSymbolicLink()) {
            return console.error('Version ' + version + ' was already merged');
        }
        return semver(version);
    } catch(e) {
        return console.error('Version ' + version + ' does not exist');
    }
}