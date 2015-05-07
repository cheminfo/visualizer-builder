# visualizer-builder

Automatic build of visualizer releases

## Installation

### Edit config file

* `cp config.default.json config.json`
* `vim config.json`
 * `repo` - location of both visualizer clones
 * `out` - directory where the builds will be copied

### Prepare environment

`npm run init`

This command will :
* install dependencies
* create `repo` and `out` directories
* clone the visualizer (two copies are needed for the build process and HEAD access)
* create symbolic links:
 * HEAD / head / src
 * min / build
 * testcase
 * doc

## Usage

`npm run build`

## Merging versions

To free some place on the hard drive, it can be useful to merge very close versions into one:  
`npm run merge -- v0.0.0 v0.0.1`

This command will remove `v0.0.0` and replace it with a symlink that points to `v0.0.1`

## License

  [MIT](./LICENSE)
