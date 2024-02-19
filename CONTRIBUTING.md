# Contributing

## Build the project

### Setup

1. Clone the repo outside your Obsidian plugins dir
2. Run `npm install`

### Build

`npm run build` - production build
`npm run dev` - dev build with watch

### Test

Changes can be tested within your Obsidian repo. Copy the `main.js`, `styles.css`, and `manifest.json` to the `.obsidian/plugins/obsidian-trello` folder within your Obsidian vault. Reload the app if it's already running.

## Releasing new versions

1. Update `CHANGELOG.md` with changes in this release
2. This project follows semantic versioning. Decide if this is a major, minor, or patch version.
3. Create a pull request that updates the following files with the new version number:
    1. `manifest.json`
    2. `package.json`
    3. `package-lock.json`
    4. `versions.json`
        - The matching Obsidian version should be bumped if needed.
    5. `src/constants.ts`, in the default settings value
4. Once merged, create and push a new tag using the following format:
    - `git checkout main` 
    - `git tag -a x.y.z -m "x.y.z"`
    - `git push --tags`
5. A release will automatically be drafted. Update the description with the changelog for this release.
6. Publish the release.
