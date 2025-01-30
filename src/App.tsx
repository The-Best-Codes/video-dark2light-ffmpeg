import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { FilePlus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

function App() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const load = async () => {
    setLoading(true);
    const baseURL = "";
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on("log", ({ message }) => {
      setLogMessages((prev) => [...prev, message]);

      // Parse progress from FFmpeg output
      const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch && videoRef.current?.duration) {
        const [, hours, minutes, seconds] = timeMatch;
        const currentTime =
          parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
        const progress = (currentTime / videoRef.current.duration) * 100;
        setProgress(Math.min(100, progress));
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
    } catch (error) {
      console.error("Error loading ffmpeg:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setVideoFile(file);
    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && handleFileSelect(files[0]),
    accept: {
      "video/*": [".mp4", ".mov", ".avi"],
    },
    multiple: false,
  });

  const transcode = async () => {
    if (!videoFile) return;

    setLoading(true);
    setProgress(0);
    const ffmpeg = ffmpegRef.current;

    try {
      await ffmpeg.writeFile(
        "input.mp4",
        await fetchFile(URL.createObjectURL(videoFile)),
      );

      // add scale and pad video filters
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vf",
        `scale=ceil(iw/2)*2:ceil(ih/2)*2,pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2,negate,hue=h=180,eq=contrast=1.2:saturation=1.1`, // this is so ffmpeg won't crash on videos with non-even dimensions
        "output.mp4",
      ]);
      const data = await ffmpeg.readFile("output.mp4");

      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(
          new Blob([data], { type: "video/mp4" }),
        );
      }
    } catch (error) {
      console.error("Error transcoding:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle auto-scrolling logs
  useEffect(() => {
    const logContainer = logContainerRef.current;
    if (!logContainer || !shouldAutoScrollRef.current) return;

    logContainer.scrollTop = logContainer.scrollHeight;
  }, [logMessages]);

  // Check if user is scrolling up
  const handleScroll = () => {
    const logContainer = logContainerRef.current;
    if (!logContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = logContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScrollRef.current = isNearBottom;
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
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center ${
                  isDragActive
                    ? "bg-gray-200 border-blue-500"
                    : "border-gray-300"
                }`}
              >
                <input {...getInputProps()} />
                <FilePlus className="h-6 w-6 text-gray-500 mb-2" />
                <p className="text-sm text-gray-500">
                  {isDragActive
                    ? "Drop video here..."
                    : "Drag 'n' drop a video here, or click to select a file"}
                </p>
                <Button variant="outline" size="sm" className="mt-2">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload a Video
                </Button>
              </div>

              <video
                ref={videoRef}
                controls
                className="w-full aspect-video rounded-md mt-4"
              />

              <Button
                disabled={loading || !videoFile}
                onClick={transcode}
                className="mt-2"
              >
                {loading ? "Transcoding..." : "Transcode video with filters"}
              </Button>

              {loading && <Progress value={progress} className="mt-2" />}

              <div
                ref={logContainerRef}
                onScroll={handleScroll}
                className="h-60 mt-2 rounded-md border border-input overflow-auto"
              >
                {logMessages.map((message, index) => (
                  <p key={index} className="p-2 text-sm">
                    {message}
                  </p>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
