import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  AlertTriangle,
  Download,
  FilePlus,
  Loader,
  Play,
  RotateCw,
  Upload,
} from "lucide-react";
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
  const [convertedVideoUrl, setConvertedVideoUrl] = useState<string | null>(
    null,
  );
  const [fastMode, setFastMode] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const baseURL = ""; // empty, since we downloaded the files locally into the public folder
    const ffmpeg = ffmpegRef.current;

    // Listen to progress event instead of log.
    // progress event is experimental, be careful when using it
    // @ts-ignore
    ffmpeg.on("progress", ({ progress, time }) => {
      setProgress(Math.min(100, progress * 100)); // Using direct percentage for progress
    });

    ffmpeg.on("log", ({ message }) => {
      setLogMessages((prev) => [...prev, message]);
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript",
        ),
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
    setLogMessages([]);
    setConvertedVideoUrl(null);
    setProgress(0);
    setLoading(false);
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
    disabled: loading, // Disable dropzone while loading
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

      // add padding to make sure the video dimensions are divisible by 2
      let filters =
        "scale=ceil(iw/2)*2:ceil(ih/2)*2,pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2,negate,hue=h=180,eq=contrast=1.2:saturation=1.1";

      if (fastMode) {
        const maxResolution = 1920 * 1080;
        const currentResolution =
          (videoRef.current?.videoWidth as number) *
            (videoRef.current?.videoHeight as number) || 0;
        let targetWidth = videoRef.current?.videoWidth;
        let targetHeight = videoRef.current?.videoHeight;
        if (currentResolution > maxResolution) {
          const aspectRatio =
            (videoRef.current?.videoWidth as number) /
              (videoRef.current?.videoHeight as number) || 1;

          targetWidth = Math.min(1920, videoRef.current?.videoWidth || 1);
          targetHeight = targetWidth / aspectRatio;
          if (targetHeight > 1080) {
            targetHeight = 1080;
            targetWidth = targetHeight * aspectRatio;
          }
        }
        filters = `scale=ceil(${targetWidth}/2)*2:ceil(${targetHeight}/2)*2,pad=ceil(${targetWidth}/2)*2:ceil(${targetHeight}/2)*2:(ow-iw)/2:(oh-ih)/2,negate,hue=h=180,eq=contrast=1.2:saturation=1.1`;
      }

      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vf",
        filters,
        ...(fastMode ? ["-preset", "ultrafast"] : []),
        "output.mp4",
      ]);

      const data = await ffmpeg.readFile("output.mp4");

      const blob = new Blob([data], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      if (videoRef.current) {
        videoRef.current.src = url;
      }
      setConvertedVideoUrl(url);
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

  const handleDownload = () => {
    if (!convertedVideoUrl) return;
    const link = document.createElement("a");
    link.href = convertedVideoUrl;
    link.download = "converted_video.mp4";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              {loading ? (
                <>
                  <Loader className="animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Initialize Converter
                </>
              )}
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
                  disabled={loading} // Disable the button while loading
                >
                  <Upload className="h-4 w-4" />
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
              <div className="flex items-center mt-2 space-x-2">
                <label
                  htmlFor="fast-mode-switch"
                  className="text-sm font-medium dark:text-white"
                >
                  Fast Mode
                </label>
                <Switch
                  id="fast-mode-switch"
                  checked={fastMode}
                  onCheckedChange={(checked) => setFastMode(checked)}
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2">
                <Button
                  disabled={loading || !videoFile}
                  onClick={transcode}
                  className="flex-1 dark:text-white"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RotateCw className="h-4 w-4" />
                      Convert to Light Mode
                    </>
                  )}
                </Button>
                {convertedVideoUrl && (
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    className="dark:text-black"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                )}
              </div>
              {loading && (
                <Progress value={progress} className="mt-2 dark:bg-white" />
              )}

              <Accordion type="single" collapsible className="mt-2">
                <AccordionItem value="log">
                  <AccordionTrigger className="cursor-pointer dark:text-white">
                    Show FFMPEG Logs
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
