/*
 * 在线语音合成 WebAPI 接口调用示例 接口文档（必看）：https://www.xfyun.cn/doc/tts/online_tts/API.html
 * 错误码链接：
 * https://www.xfyun.cn/document/error-code （code返回错误码时必看）
 *
 */
import CryptoJS from "crypto-js";
import WebSocket from "ws";
import log from "log4node";
import fs from "fs-extra";
import COFNIG from "./config.js";
// 系统配置
const config = {
  // 请求地址
  hostUrl: "wss://tts-api.xfyun.cn/v2/tts",
  host: "tts-api.xfyun.cn",
  uri: "/v2/tts",
  ...COFNIG,
};

let date = new Date().toUTCString();

let wssUrl =
  config.hostUrl +
  "?authorization=" +
  getAuthStr(date) +
  "&date=" +
  date +
  "&host=" +
  config.host;

function getAuthStr(date) {
  let signatureOrigin = `host: ${config.host}\ndate: ${date}\nGET ${config.uri} HTTP/1.1`;
  let signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret);
  let signature = CryptoJS.enc.Base64.stringify(signatureSha);
  let authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  let authStr = CryptoJS.enc.Base64.stringify(
    CryptoJS.enc.Utf8.parse(authorizationOrigin)
  );
  return authStr;
}

function genAudio(musicid: string, text: string) {
  return new Promise((resolve, reject) => {
    let ws = new WebSocket(wssUrl);
    const filename = `./audio/${musicid}.mp3`;
    // 连接建立完毕，读取数据进行识别
    ws.on("open", async () => {
      log.info("websocket connect!");
      send(text);
      // 如果之前保存过音频文件，删除之
      if (fs.existsSync(filename)) {
        try {
          await fs.unlink(filename);
          log.info("remove file success");
        } catch (error) {
          if (error) {
            log.error("remove error: " + error);
          }
        }
      }
    });

    // 得到结果后进行处理，仅供参考，具体业务具体对待
    ws.on("message", async (data, err) => {
      if (err) {
        log.error("message error: " + err);
        reject(err);
        return;
      }

      let res = JSON.parse(data);

      if (res.code != 0) {
        log.error(`${res.code}: ${res.message}`);
        ws.close();
        reject(res);
        return;
      }

      let audio = res.data.audio;
      let audioBuf = Buffer.from(audio, "base64");

      try {
        await fs.writeFile(filename, audioBuf, { flag: "a" });
      } catch (error) {
        if (error) {
          log.error("save error: " + error);
          return;
        }
      }
      // 结束
      if (res.code == 0 && res.data.status == 2) {
        log.info("文件保存成功");
        resolve(filename);
        ws.close();
      }
    });

    // 资源释放
    ws.on("close", () => {
      log.info("connect close!");
    });

    // 连接错误
    ws.on("error", (err) => {
      reject(err);
      log.error("websocket connect err: " + err);
    });
    // 传输数据
    function send(text: string) {
      let frame = {
        // 填充common
        common: {
          app_id: config.appid,
        },
        // 填充business
        business: {
          aue: "lame",
          auf: "audio/L16;rate=16000",
          vcn: "xiaoyan",
          tte: "UTF8",
          sfl: 1,
        },
        // 填充data
        data: {
          text: Buffer.from(text).toString("base64"),
          status: 2,
        },
      };
      ws.send(JSON.stringify(frame));
    }
  });
}

export default genAudio;
