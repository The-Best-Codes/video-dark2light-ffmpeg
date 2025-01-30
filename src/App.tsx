import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { AlertTriangle, FilePlus, Upload } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
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
    } catch (err: any) {
      console.error("Error loading ffmpeg:", err);
      setError("Failed to load converter. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setVideoFile(file);
    setError(null);
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
    setError(null);
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
        `scale=ceil(iw/2)*2:ceil(ih/2)*2,pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2,negate,hue=h=180,eq=contrast=1.2:saturation=1.1`,
        "output.mp4",
      ]);
      const data = await ffmpeg.readFile("output.mp4");

      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(
          new Blob([data], { type: "video/mp4" }),
        );
      }
    } catch (err: any) {
      console.error("Error transcoding:", err);
      setError("Failed to process video. Please try another video.");
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
    <div className="dark:bg-gray-800 flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[500px] p-4 dark:bg-gray-700 dark:text-white dark:border-gray-500">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Video Dark to Light Converter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loaded ? (
            <Button
              variant="outline"
              className="dark:text-black"
              disabled={loading}
              onClick={load}
            >
              {loading ? "Loading..." : "Initialize Converter"}
            </Button>
          ) : (
            <>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center dark:bg-gray-600 ${
                  isDragActive
                    ? "bg-gray-200 border-blue-500 dark:bg-gray-500"
                    : "border-gray-300"
                }`}
              >
                <input {...getInputProps()} />
                <FilePlus className="h-6 w-6 text-gray-500 dark:text-white mb-2" />
                <p className="text-sm text-gray-500 dark:text-white text-center">
                  {isDragActive
                    ? "Drop video here..."
                    : "Drag and drop a video, or click to select one"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 dark:text-black dark:border-gray-500"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select a Video
                </Button>
              </div>

              {error && (
                <div className="flex items-center text-red-500 bg-red-100 dark:bg-red-800 dark:text-red-200 p-2 rounded-md">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {error}
                </div>
              )}

              <video
                ref={videoRef}
                controls
                className="w-full aspect-video rounded-md mt-4 dark:bg-gray-900"
              />

              <Button
                disabled={loading || !videoFile}
                onClick={transcode}
                className="mt-2 dark:text-white dark:bg-blue-500 hover:dark:bg-blue-600"
              >
                {loading ? "Processing..." : "Convert to Light Mode"}
              </Button>

              {loading && (
                <Progress value={progress} className="mt-2 dark:bg-white" />
              )}

              <Accordion type="single" collapsible className="mt-2">
                <AccordionItem value="log">
                  <AccordionTrigger className="cursor-pointer dark:text-white">
                    Show Details
                  </AccordionTrigger>
                  <AccordionContent>
                    <div
                      ref={logContainerRef}
                      onScroll={handleScroll}
                      className={`mt-2 rounded-md overflow-auto h-60 dark:border-gray-500 dark:bg-gray-900 dark:text-gray-200`}
                    >
                      {logMessages.map((message, index) => (
                        <p key={index} className="p-2 text-sm">
                          {message}
                        </p>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
