# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.過長時抽出舊者為`experience_<年月日>.md`,並於本檔註明何時抽出.

## 外部執行檔改造(bin-ffmpeg,2026-10-28)

- **分割壓縮檔的三層雜湊**:清單項為 `parts`(各分割)＋`assembled`(組合後 zip)＋`extract`(解出之 `ffmpeg.exe`).本套件之 zip 為「存放」不壓縮(組合後 122,687,642 位元組,解出 122,687,488 位元組),所以 wsemi 取得一次(下載 5 分割→雜湊→組合→雜湊→`tar.exe` 解壓→雜湊→原子移入)在本機鏡像上約 1.2 秒,不必擔心測試耗時;第二次命中快取只重新雜湊 122 MB 約 0.2 秒.
- **`toolg/genBinManifest.mjs` 自行組合與解壓**:範本要求手備 `fpMember`(本機解出之成員),本套件改成工具自己依序組合各分割、以 `<SystemRoot>\System32\tar.exe`(bsdtar)解出成員至 `./tmp/genBinManifest/`、算完即刪,更新 `bin/` 後只要重跑 `node toolg/genBinManifest.mjs --commit <提交>`.**Git Bash 內之 `tar` 是 GNU tar,不支援 zip,必須用 System32 之 tar.exe**(wsemi 執行期亦如此).`git diff <commit> -- bin` 守門仍在,提交與工作樹不符即拒絕寫清單.
- **釘選提交與位元組**:主控先提交 `bin/` 之 5 個分割與 `.gitattributes`(`bin/** binary`),提交 `5b4a261bac98f2beaf1f18ae63b6e17ee96c8673`;本機 `src/ffmpeg.exe`(未追蹤,舊版組合之產物)之 sha256 `019209cd…` 與由 `bin/` 分割解出者相同,可用來交叉驗證.
- **UMD 主檔不可改為具名匯出**:`main` 為 `dist/w-ffmpeg.umd.js`(rollup UMD,`module.exports = 函數`).為了匯出 `ensureBins()` 若加具名 `export { ensureBins }`,`require('w-ffmpeg')` 之既有用法即壞.作法:`src/ensureBins.mjs` 預設匯出,並於函數上掛 `WFfmpeg.ensureBins`(測試以 `import * as ns` 斷言只有 `default`).
- **UMD 內之 `import.meta.url`**:rollup 於 UMD 輸出換為 `pathToFileURL(__filename)`,`dist/` 與 `src/` 同為套件根之下一層故套件根判定正確.驗證法(不動 repo 之 `dist/`):以 `toolg/gDistRollup.mjs` 之內容、僅把 `fdTar` 換成 `./tmp/.../dist`,另組只含 `dist/*.umd.js` 與 `bin/manifest.json` 之假套件,離線無快取時看缺檔錯誤之應放路徑是否為 `<假套件>/bin-cache/…`,再以本地鏡像實跑 `ffmpeg -version`.須把 `url`、`crypto`、`stream`、`stream/promises` 列入 external 與 globals(測試以文字比對守住).
- **WFfmpeg 之 reject 型態**:既有為字串(輸入檢核、`can not find ffmpeg.exe`),故取不到執行檔時以 `` `[${code}] ${message}` `` 字串 reject;`ensureBins()`、`autoDownloadFiles()` 為帶 `code` 之 Error.下游 w-dwload-dlp 以 `${err}` 串入訊息,字串與 Error 皆可.
- **測試之外網與落點**:`WFfmpeg.test.mjs` 原直接用 `src/ffmpeg.exe`(舊版組合之產物,未追蹤,他機沒有),改為 `before` 設 `W_BIN_CACHE`、`W_BIN_MIRROR`(本地資料夾,結構 `<鏡像>/w-ffmpeg/<分割sha256>/ffmpeg.zip.00N`)、`W_BIN_OFFLINE=1`,並攔截全域 `fetch`,`after` 還原.
- **無法注入 `fetch` 之入口**:`WFfmpeg()`、`autoDownloadFiles()` 以攔截全域 `fetch` 並斷言未被呼叫;另放一個對照案(不離線、不注入 fetch,攔截必須記錄到對 `raw.githubusercontent.com/.../bin/ffmpeg.zip.001` 之呼叫),證明攔截本身有效,否則「未被呼叫」可能只是攔截失靈.
- **`npm pack --dry-run` 與平行測試**:mocha `--parallel` 時他檔於 `test/_tmp/` 放之 122 MB 副本會被打包而使 T1 偶發失敗,故 `.npmignore` 有 `/test/_tmp/`;T1 先放誘餌 `test/_tmp/binManifest/probe.exe` 與 `bin-cache/__decoy__/probe.exe`,缺 `/test/_tmp/` 或 `/bin-cache/` 規則時確定性變紅(變異驗證 U03、U04 證實).
- **變異驗證用副本樹**:`./tmp/<名>/mut/work/` 以硬連結帶入大檔(變異大檔時先解除連結再寫新檔,不動原檔),`GIT_DIR` 指向 repo 之 `.git` 使副本樹內 `git show <commit>:<path>` 可讀,`NODE_OPTIONS=--import netGuard.mjs` 阻擋非 127.0.0.1 之 `fetch`(殷鑑:變異後之碼可能直連真網路).`mocha --bail` 縮短被抓之變異耗時.
- **npm 12 `npm i` 副作用**:`npm i wsemi@1.9.27` 補 `package.json` 檔尾換行、把鎖檔 root 之 version 同步為 package.json(1.0.28);移除 `postinstall` 後鎖檔 root 之 `hasInstallScript` 須手動移除.
- **等測試鎖**:`quiet-run --lock` 於他套件持鎖時要等很久(本輪持鎖者為 wsemi 之 load trial 迴圈);等鎖期間做不影響該次測試之文件、驗證腳本與 UMD 探測,不改動 `src/`、`test/`.多個 `--lock` 指令排隊會依序執行;把需要同一次持鎖的多階段(修前紅、變異)寫成單一協調腳本(`runStages.mjs`)可減少重複排隊.
