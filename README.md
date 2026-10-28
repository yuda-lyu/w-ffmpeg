# w-ffmpeg
A wrapper for ffmpeg.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-ffmpeg.svg?style=flat)](https://npmjs.org/package/w-ffmpeg) 
[![license](https://img.shields.io/npm/l/w-ffmpeg.svg?style=flat)](https://npmjs.org/package/w-ffmpeg) 
[![npm download](https://img.shields.io/npm/dt/w-ffmpeg.svg)](https://npmjs.org/package/w-ffmpeg) 
[![npm download](https://img.shields.io/npm/dm/w-ffmpeg.svg)](https://npmjs.org/package/w-ffmpeg) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-ffmpeg.svg)](https://www.jsdelivr.com/package/npm/w-ffmpeg)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-ffmpeg/global.html).

## Core
> `w-ffmpeg` should run in `Windows`.

> The ffmpeg.exe file is too large and is stored in this repository as split zip files (`bin/ffmpeg.zip.001`~`.005`), which are not part of the npm package. On first use they are downloaded, verified against `bin/manifest.json` (SHA-256 and size), assembled and extracted into a cache folder; see [External executable](#外部執行檔).

## Installation

### Using npm(ES6 module):
```alias
npm i w-ffmpeg
```

#### Example:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-ffmpeg/blob/master/g.mjs)]
```alias
import fs from 'fs'
import WFfmpeg from 'w-ffmpeg/src/WFfmpeg.mjs'

async function test() {

    //fpIn, 輸入視訊檔
    let fpIn = './test/aigen.mp4'

    //fpOut, 輸出音訊檔
    let fpOut = './test/aigen.mp3'

    //args, 自aigen.mp4提取音訊輸出為aigen.mp3 (-y覆蓋既有檔, -vn去除視訊軌)
    let args = ['-y', '-i', fpIn, '-vn', fpOut]

    //cbStdout
    let cbStdout = (msg) => {
        console.log(msg)
    }

    //cbStderr, ffmpeg的轉檔進度與資訊預設輸出至stderr
    let cbStderr = (msg) => {
        console.log(msg)
    }

    //WFfmpeg
    await WFfmpeg(args, { cbStdout, cbStderr })

    //len
    let len = fs.statSync(fpOut).size
    console.log('len', len)

    //unlinkSync
    fs.unlinkSync(fpOut)

    console.log('done')
}
test()
    .catch((err) => {
        console.log('catch', err)
    })
// len 65102
// done
```

## 外部執行檔

本套件執行時需要下列外部執行檔,不含於 npm 包:

| 檔名 | 用途 | 來源 |
|---|---|---|
| ffmpeg.exe | 影音轉換 | 本套件 GitHub repo 之 `bin/ffmpeg.zip.001`~`.005`(切割 zip,釘選提交;組合後解出 `ffmpeg.exe`) |

- 首次使用到 `WFfmpeg` 時自動下載(或預先呼叫本套件匯出之 `WFfmpeg.ensureBins()`),以 `bin/manifest.json` 所載之 SHA-256 與大小逐一校驗各分割、組合後再校驗、解壓後再校驗,存於 `<套件根>/bin-cache/<sha256>/ffmpeg.exe`;之後自快取取得(亦校驗).安裝時不下載.
- 環境變數:
  - `W_BIN_CACHE=<資料夾>`:快取改放 `<資料夾>/w-ffmpeg/`(套件所在之 `node_modules` 唯讀時使用,多套件可共用同一資料夾).
  - `W_BIN_MIRROR=<資料夾或 http(s) 網址>`:內網鏡像,先找鏡像再連 GitHub;結構為 `<鏡像>/w-ffmpeg/<sha256>/<檔名>`(最終檔 `ffmpeg.exe` 或各分割檔 `ffmpeg.zip.001`~`.005` 皆可).鏡像之檔同樣以清單校驗,不符即不用.
  - `W_BIN_OFFLINE=1`:不連網,只用快取與鏡像;缺檔時錯誤(`E_OFFLINE_MISSING`)會列出缺哪些檔、sha256、大小與應放之完整路徑.
- 離線部署:
  1. 在可連網之電腦設 `W_BIN_CACHE=<空資料夾>`,呼叫 `WFfmpeg.ensureBins()` 一次(或使用到 `WFfmpeg` 一次).
  2. 把該資料夾整個帶到內網電腦,設 `W_BIN_MIRROR=<該資料夾>`(全離線時另設 `W_BIN_OFFLINE=1`).
- 取不到 `ffmpeg.exe` 時,`WFfmpeg` 以字串 reject(維持既有型態),內容為 `[錯誤碼] 說明`(如 `[E_OFFLINE_MISSING]`、`[E_HASH_MISMATCH]`);`WFfmpeg.ensureBins()` 則 reject 帶 `code` 之 Error.
- 舊的 `w-ffmpeg/src/autoDownloadFiles.mjs` 保留為相容用之薄包裝(`@deprecated`,改用 `ensureBins`);`ffmpeg.exe` 不再位於 `src/`,依舊路徑查找者請改用 `WFfmpeg.ensureBins()` 取得路徑.
