/* Command – WWI officer career simulation. Global namespace; every module attaches itself to it.
   Source files are plain scripts (no bundler needed): build.js concatenates them in order into one index.html,
   and the headless tests load the very same files, so there is a single implementation. */
var Command = { version: '0.1.0', modules: {} };
