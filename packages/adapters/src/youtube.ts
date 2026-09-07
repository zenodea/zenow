import { youtubeVideoId } from "@reader/shared";
import { execa, ExecaError } from "execa";
import { indexImages, isLikelyContentImage, type RawImage } from "./images.js";
import { AdapterError, type Adapter, type FetchContext, type Fetched } from "./types.js";

const YTDLP_TIMEOUT_MS = 60_000;
const MAX_JSON_BYTES = 32 * 1024 * 1024;
const SUBTITLE_LANGS = ["en", "en-orig", "en-US", "en-GB"];

type Caption = { ext?: string; url?: string };

type VideoInfo = {
  title?: string;
  description?: string;
  duration?: number;
  channel?: string;
  uploader?: string;
  channel_id?: string;
  upload_date?: string;
  view_count?: number;
  thumbnail?: string;
  thumbnails?: { url?: string; width?: number; height?: number }[];
  subtitles?: Record<string, Caption[]>;
  automatic_captions?: Record<string, Caption[]>;
};

/**
 * Auto-captions arrive as a rolling window, each cue repeating the tail of the
 * last. Plain line dedupe is not enough; a cue that extends the previous one
 * replaces it.
 */
export function vttToText(vtt: string): string {
  const out: string[] = [];

  for (const raw of vtt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === "WEBVTT" || line.includes("-->")) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^(Kind|Language|NOTE|STYLE|REGION):?/.test(line)) continue;

    const clean = line
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) continue;

    const previous = out.at(-1);
    if (previous) {
      if (previous === clean || previous.endsWith(clean)) continue;
      if (clean.startsWith(previous)) {
        out[out.length - 1] = clean;
        continue;
      }
    }
    out.push(clean);
  }

  return out.join(" ");
}

function pickCaptionUrl(info: VideoInfo): string | null {
  for (const source of [info.subtitles, info.automatic_captions]) {
    for (const lang of SUBTITLE_LANGS) {
      const tracks = source?.[lang];
      const track = tracks?.find((t) => t.ext === "vtt") ?? tracks?.[0];
      if (track?.url) return track.url;
    }
  }
  return null;
}

function collectImages(info: VideoInfo): RawImage[] {
  const candidates = [...(info.thumbnails ?? [])].sort(
    (a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0),
  );
  if (info.thumbnail) candidates.unshift({ url: info.thumbnail });

  return candidates.flatMap((thumbnail) => {
    const url = thumbnail.url;
    if (!url || !isLikelyContentImage(url)) return [];
    return [{ url, ...(thumbnail.width ? { width: thumbnail.width } : {}), ...(thumbnail.height ? { height: thumbnail.height } : {}) }];
  });
}

async function probe(videoId: string): Promise<VideoInfo> {
  try {
    const { stdout } = await execa(
      "yt-dlp",
      [
        "--dump-single-json",
        "--skip-download",
        "--no-warnings",
        "--no-playlist",
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { timeout: YTDLP_TIMEOUT_MS, maxBuffer: MAX_JSON_BYTES },
    );
    return JSON.parse(stdout) as VideoInfo;
  } catch (error) {
    if (error instanceof ExecaError) {
      if (error.code === "ENOENT") {
        throw new AdapterError("unsupported", "yt-dlp is not installed on this worker", { cause: error });
      }
      if (error.timedOut) {
        throw new AdapterError("timeout", "yt-dlp timed out", { cause: error });
      }
      const stderr = String(error.stderr ?? "");
      const blocked = /Sign in to confirm|not a bot|429|rate.?limit/i.test(stderr);
      throw new AdapterError(blocked ? "blocked" : "http_error", `yt-dlp failed: ${stderr.split("\n")[0] || error.message}`, {
        cause: error,
      });
    }
    throw new AdapterError("no_content", "Could not read video metadata", { cause: error });
  }
}

export const youtubeAdapter: Adapter = {
  name: "youtube",
  match: (url) => youtubeVideoId(url) !== null,

  async fetch(url, ctx: FetchContext): Promise<Fetched> {
    const videoId = youtubeVideoId(url);
    if (!videoId) throw new AdapterError("unsupported", `No video id in ${url}`);

    const info = await probe(videoId);
    const description = info.description?.trim() ?? "";
    const captionUrl = pickCaptionUrl(info);

    let transcript = "";
    if (captionUrl) {
      try {
        const response = await ctx.fetch(captionUrl, { signal: AbortSignal.timeout(20_000) });
        if (response.ok) transcript = vttToText(await response.text());
      } catch (error) {
        ctx.log.warn("could not fetch captions", { videoId, error: String(error) });
      }
    }

    // The prompt is told which of these it got, so it never invents a transcript.
    const text = transcript
      ? `Transcript:\n${transcript}${description ? `\n\nDescription:\n${description}` : ""}`
      : `Description:\n${description}`;

    if (!text.trim() || text.trim() === "Description:") {
      throw new AdapterError("no_content", "Video has neither captions nor a description");
    }

    return {
      title: info.title ?? `YouTube ${videoId}`,
      text,
      images: indexImages(collectImages(info), 6),
      meta: {
        channel: info.channel ?? info.uploader,
        channel_id: info.channel_id,
        duration: info.duration,
        view_count: info.view_count,
        published_at: info.upload_date
          ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}`
          : undefined,
        has_transcript: Boolean(transcript),
        transcript_chars: transcript.length,
      },
    };
  },
};
