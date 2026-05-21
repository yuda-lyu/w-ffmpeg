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

> The ffmpeg.exe file is too large and will be split into small zip files for upload. If ffmpeg is missing during the first execution, it will be automatically decompressed from the zip file.

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
