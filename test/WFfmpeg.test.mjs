import fs from 'fs'
import assert from 'assert'
import WFfmpeg from '../src/WFfmpeg.mjs'


function isWindows() {
    return process.platform === 'win32'
}


describe('WFfmpeg', function() {

    //check
    if (!isWindows()) {
        return
    }

    async function test() {

        //fpIn, 測試用視訊檔
        let fpIn = './test/aigen.mp4'

        //fpOut, 提取出的音訊檔
        let fpOut = './test/aigen.mp3'

        //args, 自aigen.mp4提取音訊輸出為aigen.mp3 (-y覆蓋既有檔, -vn去除視訊軌)
        let args = ['-y', '-i', fpIn, '-vn', fpOut]

        //WFfmpeg, 執行成功時resolve(不拋錯); ffmpeg非0結束碼時execProcess會reject致此處拋出使測試失敗
        await WFfmpeg(args)

        //bExist, 輸出檔是否存在
        let bExist = fs.existsSync(fpOut)

        //len, 輸出檔大小
        let len = bExist ? fs.statSync(fpOut).size : 0

        //head, 讀檔頭前3碼判斷是否為mp3 (libmp3lame預設輸出ID3v2標頭, 起始為'ID3')
        let head = bExist ? fs.readFileSync(fpOut).slice(0, 3).toString('latin1') : ''

        //unlinkSync, 清除測試產出
        if (bExist) {
            fs.unlinkSync(fpOut)
        }

        return { bExist, len, head }
    }

    it('extract audio from mp4 to mp3', async function() {
        let { bExist, len, head } = await test()

        //驗1: 提取出的mp3檔確實存在
        assert.strict.equal(bExist, true)

        //驗2: 提取出的mp3檔非空
        assert.strict.equal(len > 0, true)

        //驗3: 提取出的檔確實是mp3 (ID3標頭), 而非垃圾內容
        assert.strict.equal(head, 'ID3')
    })

})
