# 回饋

本檔記錄任務中發現之他套件、全域技能、全域設定之調整建議(只是紀錄與提案,實際修改走全域設定 §5.2、§13,不在本套件自行改).一條一列:日期、類別、對象、內容、依據.

| 日期 | 類別 | 對象 | 內容 | 依據 |
| --- | --- | --- | --- | --- |
| 2026-11-18 | 自有套件 | wsemi(`fsEnsureBins`) | `E_OFFLINE_MISSING` 之訊息固定句指向「this error 之 `missing` 欄位」(`the ... are in the missing field of this error`、`put each file at the cachePath or mirrorPath of the missing field of this error`);以字串 reject 之使用端(本套件之 `WFfmpeg`、以及另一套 `WKriging`)轉述該訊息時,字串並無 `missing` 欄位,指引落空,故各自寫了一份 `rejectOfBins`(離線缺檔改為檔名＋固定說明「呼叫 `ensureBins()` 並讀 `err.missing[]`」).建議 wsemi 提供共用輔助(如 `fsEnsureBinsStr(err)` 回傳字串型態之 `[code] 說明`),使各套件不再各寫一份、說明用語一致 | `src/WFfmpeg.mjs` `rejectOfBins`;`test/api-ensureBins.test.mjs` 之 WFfmpeg 字串案 |
| 2026-11-18 | 全域技能 | role-coder-for-test(§5 執行) | 自編 mocha 指令時,`--cwd <目錄>` 等 mocha 不認得之旗標會被當成測試檔路徑:曾把 `--cwd` 放在 `quiet-run` 之 `--` 之後,mocha 把整個套件根當 spec 目錄,載入並執行根目錄之 `g*.mjs` 腳本(寫出 `ztest.png`、經 `ensureBins` 連網取檔、啟動錄製腳本),雖已清理仍屬副作用.建議於 §5 補一句:跑他處套件之測試以 `quiet-run` 之 `--cwd`(置於 `--` 之前)或 `npm --prefix`,不自行在 mocha 指令後附旗標 | 本輪 eb1 之誤跑紀錄(誤跑之 log 為 `tmp/quiet-run/…-eb1.log`,已清除;事後已刪其產物) |
