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
  const [videoDuration, setVideoDuration] = useState(0);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const logMessagesRef = useRef<string[]>([]);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles[0]) {
      setVideoFile(acceptedFiles[0]);
      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(acceptedFiles[0]);
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            setVideoDuration(videoRef.current.duration);
          }
        };
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".avi"],
    },
    multiple: false,
  });

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(e.target.files[0]);
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            setVideoDuration(videoRef.current.duration);
          }
        };
      }
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const transcode = async () => {
    if (!videoFile) {
      alert("Please upload a video first.");
      return;
    }

    setLoading(true);
    setProgress(0);
    const ffmpeg = ffmpegRef.current;
    try {
      await ffmpeg.writeFile(
        "input.mp4",
        await fetchFile(URL.createObjectURL(videoFile)),
      );
      await ffmpeg.exec(["-i", "input.mp4", "output.mp4"]);
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
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logMessages]);

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
                className={`border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center ${isDragActive ? "bg-gray-200 border-blue-500" : "border-gray-300"}`}
              >
                <input
                  {...getInputProps()}
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                <FilePlus className="h-6 w-6 text-gray-500 mb-2" />
                <p className="text-sm text-gray-500">
                  {isDragActive
                    ? "Drop video here..."
                    : "Drag 'n' drop a video here, or click to select a file"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleButtonClick}
                  className="mt-2"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload a Video
                </Button>
              </div>

              <video
                ref={videoRef}
                controls
                className="w-full aspect-video rounded-md mt-4"
              />
              <br />
              <Button
                disabled={loading || !videoFile}
                onClick={transcode}
                className="mt-2"
              >
                {loading ? "Transcoding..." : "Transcode video to mp4"}
              </Button>
              {loading ? <Progress value={progress} className="mt-2" /> : null}
              <div
                ref={logContainerRef}
                className="h-20 mt-2 rounded-md border border-input overflow-auto"
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
