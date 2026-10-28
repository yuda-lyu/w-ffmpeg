# 規則帳本

本檔為套件設計與開發階段之規則帳本(藍圖),為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.當前已做到哪些記於`sgud/state/state.md`.過長時依類型拆為`rulebook_<類型>.md`,本檔只留索引.

## R-BIN-EXE-01 外部執行檔 ffmpeg.exe 之存放、取得、校驗與離線一律依制式規格(B 類,釘選模式,自有分割壓縮檔)

- 依據: 制式規格 `C:\opensrcOper\dspec\外部執行檔之存放下載校驗與離線.md`(使用者 2026-10-28 裁示;以下「規格」皆指此檔,條號 S/M/D/O/E/T 為其條號);主控帳本 G10 列本套件為 B 類(舊制:自主幹直連 5 個分割壓縮檔 `src/ffmpeg.zip.001`~`.005`,組合後解出 `ffmpeg.exe`,無校驗);主控任務 20261028054319 之 bin-ffmpeg.**規格為上游真理源,本條只記本套件須長成什麼樣**;與規格不一致時以規格為準並回報主控.
- 單一擁有者: 取得一律經 `src/ensureBins.mjs`(轉呼叫 wsemi `fsEnsureBins`,`pkgRoot` 固定為本套件根,不轉傳 `floatingManifestUrl`);組合分割、解壓、校驗、快取、鏡像、離線全由 wsemi 負責(錯誤碼含 `E_EXTRACT`).`src/WFfmpeg.mjs` 直接呼叫 `ensureBins({ names: 'ffmpeg.exe' })`;`src/autoDownloadFiles.mjs` 為舊深層匯入點(w-dwload-dlp 等),`@deprecated` 薄包裝,回 `{ fpExe }`.**套件端不得自寫下載、組合、解壓、快取、鏡像、校驗**(E2).
- 規則:
  1. 清單 `bin/manifest.json`(`mode: "pinned"`、`commit` 為含 `bin/` 實檔之提交)一律由 `toolg/genBinManifest.mjs --commit <40 碼>` 依實檔產生,不手寫 sha256(M1);項目用 `parts`(5 個分割各記 path、sha256、size)＋`assembled`(組合後 zip)＋`extract`(成員 `ffmpeg.exe` 之 sha256、size);工具自行組合並以 Windows `tar.exe` 解出成員計算.更新流程見規格 U1(替換 `bin/` 內檔 → 提交並推 GitHub → 產生清單 → 測試 → 發布新版).
  2. `bin/ffmpeg.zip.001`~`.005` 入 git、不入 npm 包;npm 包 `bin/` 下只有 `bin/manifest.json`(S1):`.npmignore` 為 `/bin/*`、`!/bin/manifest.json`、`/bin-cache/`、`/test/_tmp/`、`sgud`,並保留 `src/ffmpeg.exe`、`src/ffmpeg.zip*` 之排除;`.gitignore` 含 `/bin-cache/`;`.gitattributes` 為 `bin/** binary`(M1 補充 F12).單檔不逾 100 MB(S4,各分割 ≤ 26214400 位元組).
  3. 舊版相容(S2):舊版於執行時自主幹 `src/ffmpeg.zip.001`~`.005` 下載,故該 5 檔**保留於 repo**(與 `bin/` 位元相同,測試比對),不入 npm 包,至舊版淘汰後另案移除;`src/ffmpeg.exe`(未追蹤,舊版組合之產物)非來源,不入 git、不入包.
  4. 首次使用時下載(D1);**不得**有 `postinstall`/`install`/`preinstall`(已刪 `scripts/install.mjs` 與 `src/downloadFiles.mjs`;不得再引入 `fsDownloadFile`、`fsMergeFiles`、`w-zip`).
  5. 離線與內網依規格 O1~O5:`W_BIN_CACHE`、`W_BIN_MIRROR`、`W_BIN_OFFLINE` 由 wsemi 統一讀取;README〈外部執行檔〉為對使用者之說明(O5).鏡像可放最終檔 `<鏡像>/w-ffmpeg/<解出檔 sha256>/ffmpeg.exe` 或各分割 `<鏡像>/w-ffmpeg/<分割 sha256>/ffmpeg.zip.00N`.
  6. `ensureBins` 為 `src/ensureBins.mjs` 之預設匯出,並掛於 `WFfmpeg.ensureBins`(主檔 UMD 為 `module.exports = 函數`,不可改為具名匯出,否則破壞 `require('w-ffmpeg')` 之既有用法).
  7. reject 型態:`WFfmpeg` 既有為字串,維持字串,取不到 `ffmpeg.exe` 時為 `[code] message`;`ensureBins()` 與 `autoDownloadFiles()` reject 帶 `code` 之 Error.
  8. UMD 建置(`toolg/gDistRollup.mjs`)須把 `url`、`crypto`、`stream`、`stream/promises` 列為 external 與 globals;套件根以 `import.meta.url` 推得,rollup 於 UMD 輸出會換為 `__filename` 之 file URL,故 `dist/` 與 `src/` 皆須位於套件根之下一層.
  9. 本套件無執行期資料交換檔(ffmpeg 以命令列參數與 stdout/stderr 溝通),故無「交換檔不寫執行檔所在夾」之站點.
- 盤點指令: Grep `src/` 搜 `fsDownloadFile|fsMergeFiles|w-zip|fetch\(|raw/refs/heads|github\.com`(應無命中);`node C:/opensrcOper/tools/scan-bins.mjs --only w-ffmpeg`(應為 OK);`npm pack --dry-run`(`bin/` 下只見 `bin/manifest.json`).
- 站點全集與判準(2026-10-28): `src/` 之下載站點原有 1 處(`src/downloadFiles.mjs` 之 `fsDownloadFile` 直連主幹 5 個分割,已刪)、`scripts/install.mjs`(postinstall,已刪)、`src/autoDownloadFiles.mjs` 之偵測與 `pmDownload`(改為薄包裝);現僅 `src/ensureBins.mjs` 一處取得入口(其餘 `src/WFfmpeg.mjs`、`src/autoDownloadFiles.mjs` 經它).
- 已知限制: ①快取夾(`<套件根>/bin-cache/<sha256>/ffmpeg.exe`)須可寫(首次取得時);`node_modules` 唯讀之部署設 `W_BIN_CACHE`;②信任假設同規格 D6(能寫入快取夾者可信);③舊版(發布前之版本)不經清單、不校驗,至淘汰後移除 `src/ffmpeg.zip.00N`;④`autoDownloadFiles()` 失敗時 reject 由字串改為帶 `code` 之 Error(`WFfmpeg` 維持字串);⑤依舊路徑(`src/ffmpeg.exe`、`node_modules/w-ffmpeg/src/ffmpeg.exe`)查找執行檔之下游須改用 `WFfmpeg.ensureBins()`;⑥`assembled` 不符與 `E_EXTRACT` 無法在不改清單下造出(各分割已逐一校驗),由 wsemi 之測試涵蓋.
- 測試: `test/unit-binManifest.test.mjs`(M1/M2/M4、T1 先放誘餌檔、T2 含組合後雜湊、清單提交內位元組＝工作樹、S2 舊路徑檔位元相同、D1/E2 無自寫下載與 postinstall)、`test/api-ensureBins.test.mjs`(T3~T7,本機 HTTP 127.0.0.1:8971 扮 GitHub、本地資料夾扮鏡像,不連外網,真實組合與解壓;含環境變數、O4、預設快取位置與 cwd 無關〔子行程 `test/tools/ensureBinsChild.mjs`〕、不轉傳 `floatingManifestUrl`、`autoDownloadFiles` 與 `WFfmpeg` 攔截全域 `fetch`)、`test/WFfmpeg.test.mjs`(既有功能,以本機鏡像離線供檔).T8(主幹模式)不適用.夾具 `test/_tmp/<案名>/`,after 刪除.指令: `npm test`;單檔 `npx mocha --no-parallel test/unit-binManifest.test.mjs test/api-ensureBins.test.mjs test/WFfmpeg.test.mjs --timeout 180000`.
- 變更紀錄: 2026-10-28 依規格改造(bin-ffmpeg):新增 `bin/manifest.json`、`src/ensureBins.mjs`、`toolg/genBinManifest.mjs`、`test/unit-binManifest.test.mjs`、`test/api-ensureBins.test.mjs`、`test/tools/ensureBinsChild.mjs`,改 `src/WFfmpeg.mjs`、`src/autoDownloadFiles.mjs`,刪 `src/downloadFiles.mjs`、`scripts/install.mjs`、`postinstall`.
