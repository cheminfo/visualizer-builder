# visualizer-builder

Automatic build of visualizer releases

## Installation

### Clone the visualizer

* `npm install`
* `mkdir repo && cd repo`
* `git clone https://github.com/NPellet/visualizer.git head`
* `git clone head build`

To be able to serve visualizer HEAD while building releases, two copies of the project are needed

### Edit config file

* `cp config.default.json config.json`
* `vim config.json`
 * `repo` - location of both visualizer clones
 * `out` - directory where the builds will be copied

## Usage

`npm run build`

## License

  [MIT](./LICENSE)
