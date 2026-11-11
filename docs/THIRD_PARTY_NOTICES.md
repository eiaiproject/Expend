# Third-Party Notices

Expend is distributed under the MIT License. The production bundle includes the
following third-party software and data.

## Runtime libraries

| Component | License | Notes |
| --- | --- | --- |
| React, React DOM | MIT | Copyright Meta Platforms, Inc. and affiliates |
| React Router | MIT | Copyright Remix Software, Inc. |
| Dexie, dexie-react-hooks | Apache-2.0 | Copyright David Fahlander |
| Tesseract.js | Apache-2.0 | Copyright its contributors |
| tesseract.js-core | Apache-2.0 | WebAssembly build of Tesseract |
| wasm-feature-detect | Apache-2.0 | Copyright its contributors |
| reicon-react | MIT | Icon set used in the interface |
| read-excel-file | MIT | XLSX reader, loaded only when importing a spreadsheet |
| fflate | MIT | ZIP decompression used by read-excel-file |
| saxen | MIT | XML parser used by read-excel-file |

Full license texts are available in the corresponding packages under
`node_modules` and in the upstream repositories.

## OCR language data

`ind.traineddata.gz` and `eng.traineddata.gz` are sourced from the
`@tesseract.js-data` packages, which redistribute the Tesseract tessdata
models. Tesseract and the tessdata models are distributed under the Apache
License 2.0. The models are downloaded during the build, verified with SHA-256,
and served from the application origin. They are not modified.

If you redistribute a built copy of Expend, keep this notice and the upstream
Apache-2.0 license texts with the distribution.

## Fonts and images

Expend does not ship a third-party webfont. The interface uses the operating
system UI font stack. The wordmark, app icons, and social card were created for
this project. The OCR and E2E fixtures are synthetic.
