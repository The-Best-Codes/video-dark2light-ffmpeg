import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { useEffect, useRef, useState } from "react";

function App() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(15);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const logMessagesRef = useRef<string[]>([]);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const load = async () => {
    setLoading(true);
    const baseURL = "";
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on("log", ({ message }) => {
      logMessagesRef.current = [...logMessagesRef.current, message];
      setLogMessages([...logMessagesRef.current]);

      // Parse time from log message, e.g., time=00:00:01.23
      const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseFloat(timeMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        const calculatedProgress = (currentTime / videoDuration) * 100;
        setProgress(Math.min(100, calculatedProgress));
      }
    });
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm",
        ),
        workerURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.worker.js`,
          "text/javascript",
        ),
      });
      setLoaded(true);
      setLoading(false);
    } catch (error) {
      console.error("Error loading ffmpeg:", error);
      setLoading(false);
    }
  };

  const transcode = async () => {
    setLoading(true);
    setProgress(0);
    const videoURL =
      "https://raw.githubusercontent.com/ffmpegwasm/testdata/master/video-15s.avi";
    const ffmpeg = ffmpegRef.current;
    try {
      await ffmpeg.writeFile("input.avi", await fetchFile(videoURL));
      await ffmpeg.exec(["-i", "input.avi", "output.mp4"]);
      const fileData = await ffmpeg.readFile("output.mp4");
      const data = new Uint8Array(fileData as ArrayBuffer);
      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(
          new Blob([data.buffer], { type: "video/mp4" }),
        );
      }
      setLoading(false);
      setProgress(100);
    } catch (error) {
      console.error("Error transcoding:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewportRef.current) {
      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } =
          viewportRef.current as HTMLDivElement;
        const bottom = scrollHeight - clientHeight;
        setIsNearBottom(Math.abs(bottom - scrollTop) <= 10);
      };

      viewportRef.current.addEventListener("scroll", handleScroll);
      handleScroll();
      return () => {
        if (viewportRef.current) {
          viewportRef.current.removeEventListener("scroll", handleScroll);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (viewportRef.current && isNearBottom) {
      (viewportRef.current as HTMLDivElement).scrollTop = (
        viewportRef.current as HTMLDivElement
      ).scrollHeight;
    }
  }, [logMessages, isNearBottom]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[500px] p-4">
        <CardHeader>
          <CardTitle>FFmpeg Video Transcoder</CardTitle>
        </CardHeader>
        <CardContent>
          {!loaded ? (
            <Button variant="outline" disabled={loading} onClick={load}>
              {loading ? "Loading ffmpeg-core..." : "Load ffmpeg-core"}
            </Button>
          ) : (
            <>
              <div className="flex items-center space-x-2 mb-2">
                <label htmlFor="duration" className="text-sm">
                  Video Duration (seconds):
                </label>
                <Input
                  id="duration"
                  type="number"
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(Number(e.target.value))}
                  className="w-20 text-sm"
                />
              </div>
              <video
                ref={videoRef}
                controls
                className="w-full aspect-video rounded-md"
              />
              <br />
              <Button disabled={loading} onClick={transcode} className="mt-2">
                {loading ? "Transcoding..." : "Transcode avi to mp4"}
              </Button>
              {loading ? <Progress value={progress} className="mt-2" /> : null}
              <ScrollArea className="h-20 mt-2 rounded-md border border-input">
                <ScrollAreaPrimitive.Viewport
                  ref={viewportRef}
                  className="h-full w-full rounded-[inherit]"
                >
                  {logMessages.map((message, index) => (
                    <p key={index} className="p-2 text-sm">
                      {message}
                    </p>
                  ))}
                </ScrollAreaPrimitive.Viewport>
                <ScrollBar />
                <ScrollAreaPrimitive.Corner />
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
