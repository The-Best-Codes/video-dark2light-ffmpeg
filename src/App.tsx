import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useRef, useState } from "react";

function App() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // Track progress
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const messageRef = useRef<HTMLParagraphElement | null>(null);

  const load = async () => {
    setLoading(true);
    const baseURL = "";
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on("log", ({ message }) => {
      if (messageRef.current) messageRef.current.innerHTML = message;
      // Simple progress tracking (may not be accurate for all ffmpeg commands)
      if (message.startsWith("progress=")) {
        const parts = message.split("=");
        const timePart = parts[parts.length - 1].trim(); // Get the last part which contains the time
        const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;
        const timeMatch = timePart.match(timeRegex);

        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          // Assume a 15 second video
          const totalTime = 15;
          const calculatedProgress = (currentTime / totalTime) * 100;
          setProgress(Math.min(100, calculatedProgress));
        }
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
                <p ref={messageRef} className="p-2 text-sm"></p>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
