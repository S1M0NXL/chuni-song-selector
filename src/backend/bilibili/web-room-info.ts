import { createHash } from "node:crypto";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const ROOM_INIT_URL = "https://api.live.bilibili.com/room/v1/Room/get_info";
const DANMAKU_SERVER_CONF_URL =
  "https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo";
const WBI_INIT_URL = "https://api.bilibili.com/x/web-interface/nav";

const WBI_KEY_INDEX_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5,
  49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13
] as const;

export interface BilibiliDanmakuHost {
  host: string;
  port: number;
  wss_port: number;
  ws_port: number;
}

export interface BilibiliWebRoomInfo {
  requestedRoomId: number;
  roomId: number;
  ownerUid: number;
  hostList: BilibiliDanmakuHost[];
  token: string | null;
  buvid: string;
}

export const DEFAULT_DANMAKU_HOST_LIST: BilibiliDanmakuHost[] = [
  {
    host: "broadcastlv.chat.bilibili.com",
    port: 2243,
    wss_port: 443,
    ws_port: 2244
  }
];

export async function fetchBilibiliWebRoomInfo(
  requestedRoomId: number
): Promise<BilibiliWebRoomInfo> {
  const buvid = await fetchBuvid().catch(() => "");
  const roomInit = await fetchRoomInit(requestedRoomId);
  const serverInfo = await fetchDanmakuServerInfo(roomInit.roomId);

  return {
    requestedRoomId,
    roomId: roomInit.roomId,
    ownerUid: roomInit.ownerUid,
    hostList:
      serverInfo.hostList.length > 0
        ? serverInfo.hostList
        : DEFAULT_DANMAKU_HOST_LIST,
    token: serverInfo.token,
    buvid
  };
}

async function fetchBuvid(): Promise<string> {
  const response = await fetch("https://www.bilibili.com/", {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://live.bilibili.com/"
    }
  });

  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const cookies = getSetCookie ? getSetCookie() : [response.headers.get("set-cookie")];
  for (const cookie of cookies) {
    const buvid = parseCookieValue(cookie ?? "", "buvid3");
    if (buvid) {
      return buvid;
    }
  }

  return "";
}

async function fetchRoomInit(
  requestedRoomId: number
): Promise<{ roomId: number; ownerUid: number }> {
  const response = await fetchJson<BilibiliApiResponse<BilibiliRoomInitData>>(
    ROOM_INIT_URL,
    { room_id: String(requestedRoomId) }
  );

  if (response.code !== 0) {
    throw new Error(`获取直播间信息失败: ${response.message}`);
  }

  return {
    roomId: response.data.room_id,
    ownerUid: response.data.uid
  };
}

async function fetchDanmakuServerInfo(
  roomId: number
): Promise<{ hostList: BilibiliDanmakuHost[]; token: string | null }> {
  const wbiKey = await fetchWbiKey();
  const params = addWbiSign(
    {
      id: String(roomId),
      type: "0"
    },
    wbiKey
  );

  const response = await fetchJson<
    BilibiliApiResponse<BilibiliDanmakuServerData>
  >(DANMAKU_SERVER_CONF_URL, params);

  if (response.code !== 0) {
    throw new Error(`获取弹幕服务器信息失败: ${response.message}`);
  }

  return {
    hostList: response.data.host_list,
    token: response.data.token || null
  };
}

async function fetchWbiKey(): Promise<string> {
  const response = await fetchJson<BilibiliApiResponse<BilibiliNavData>>(
    WBI_INIT_URL
  );

  if (!response.data?.wbi_img) {
    return "";
  }

  const imgKey = extractWbiFileKey(response.data.wbi_img.img_url);
  const subKey = extractWbiFileKey(response.data.wbi_img.sub_url);
  const shuffledKey = `${imgKey}${subKey}`;

  return WBI_KEY_INDEX_TABLE.map((index) => shuffledKey[index] ?? "").join("");
}

function addWbiSign(
  params: Record<string, string>,
  wbiKey: string
): Record<string, string> {
  if (wbiKey.length === 0) {
    return params;
  }

  const paramsToSign: Record<string, string> = {
    ...params,
    wts: String(Math.floor(Date.now() / 1000))
  };
  const sortedParams = Object.fromEntries(
    Object.entries(paramsToSign)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, value.replace(/[!'()*]/gu, "")])
  );
  const query = new URLSearchParams(sortedParams).toString();
  const wRid = createHash("md5")
    .update(`${query}${wbiKey}`, "utf8")
    .digest("hex");

  return {
    ...sortedParams,
    w_rid: wRid
  };
}

async function fetchJson<T>(
  url: string,
  params: Record<string, string> = {}
): Promise<T> {
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    requestUrl.searchParams.set(key, value);
  }

  const response = await fetch(requestUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://live.bilibili.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function extractWbiFileKey(url: string): string {
  const fileName = url.split("/").at(-1) ?? "";
  return fileName.split(".")[0] ?? "";
}

function parseCookieValue(cookie: string, name: string): string | null {
  const prefix = `${name}=`;
  const part = cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}

interface BilibiliApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface BilibiliRoomInitData {
  room_id: number;
  uid: number;
}

interface BilibiliDanmakuServerData {
  host_list: BilibiliDanmakuHost[];
  token: string;
}

interface BilibiliNavData {
  wbi_img: {
    img_url: string;
    sub_url: string;
  };
}
