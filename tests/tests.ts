/*
TO RUN TESTS:
tsc && tsc --ignoreConfig --rootDir tests --outDir tests tests/tests.ts && node tests/tests.js
*/

import * as audioTests from "./test-audio.js";

await audioTests.testPriorityOneAudioAlwaysPlays();
