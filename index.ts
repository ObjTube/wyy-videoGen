import ffmpeg from "fluent-ffmpeg";
import axios, { AxiosResponse } from "axios";
import genAudio from "./genAudio";
import fs from "fs-extra";
import { resolve } from "path";
import { stringify } from "subtitle/dist/subtitle.bundle";

interface HotComment {
  content: string;
  user: { nickname: string; avatarUrl: string; userId: number };
}
interface Comments {
  hotComments: HotComment[];
}

// 获取网易云歌曲评论内容
async function getComments(musicid: string) {
  const res = await axios.post<{}, AxiosResponse<Comments>>(
    `http://musicapi.leanapp.cn/comment/music?id=${musicid}`
  );
  if (res.status === 200) {
    const data = res.data;
    return data.hotComments.map((hc) => hc.content);
  }
}

// 生成字幕文件srt
function comment2SRT(musicid: string, comments) {
  const srtMap = [];
  let lastStart = 0;
  const WORD_INTERNAL_TIME = 220;
  comments.forEach((c) => {
    c = c.replace(/\s+/g, "");
    const piece = Math.ceil(c.length / 10);
    for (let index = 0; index < piece; index++) {
      const addNum = index === piece ? c.length - (index + 1) * 10 : 10;
      const str = c.slice(
        index * 10,
        index === piece ? c.length : (index + 1) * 10
      );
      const end = lastStart + addNum * WORD_INTERNAL_TIME;
      srtMap.push({
        start: lastStart + WORD_INTERNAL_TIME, // time in ms
        end,
        text: str,
      });
      lastStart = end;
    }
  });
  fs.writeFileSync(
    resolve(__dirname, `../srt/${musicid}.srt`),
    stringify(srtMap)
  );
}

async function run(musicid: string) {
  const comments = await getComments(musicid);
  await genAudio(musicid, comments.join("。"));
  comment2SRT(musicid, comments);
  ffmpeg(resolve(__dirname, "../demo.mp4"))
    .mergeAdd(resolve(__dirname, `../audio/${musicid}.mp3`))
    .mergeAdd(resolve(__dirname, "../youshangdebgm.mp4"))
    .complexFilter([
      {
        filter: "amix",
        options: { inputs: 2, duration: "shortest" },
      },
    ])
    .outputOptions(
      `-vf subtitles=${resolve(__dirname, `../srt/${musicid}.srt`)}`
    )
    .output(resolve(__dirname, `../wyyVideo/${musicid}.mp4`))
    .on("end", () => {
      console.log("Finished processing");
    })
    .run();
}

run("65681");
