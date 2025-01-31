# Video Dark to Light Mode Converter

This is a simple video converter that converts a video from dark mode to light mode using an ffmpeg command in your browser.
You can find the live demo at the URL below:

[https://video-dark2light.vercel.app/](https://video-dark2light.vercel.app/)

## How it Works (For Developers)

This project utilizes the following technologies:

- **React:** For building the user interface.
- **shadcn/ui:** For UI components like buttons, cards, and accordions.
- **ffmpeg.wasm:** For running the FFmpeg command in the browser.
- **react-dropzone:** For handling drag-and-drop file uploads.
- **lucide-react:** For icons.

Here's a breakdown of how the conversion process works:

1.  **Initialization:**

    - The `FFmpeg` instance is initialized using the `@ffmpeg/ffmpeg` library and the `ffmpeg-core.js` , `ffmpeg-core.wasm`, and `ffmpeg-core.worker.js` files are loaded from the public folder. These files are needed to run ffmpeg in the browser.
    - The application uses `toBlobURL` function from `@ffmpeg/util` to create a URL to the local `ffmpeg-core` files.
    - The loading status is tracked using `loading` and `loaded` state variables.
    - Error states are tracked with the `error` variable.
    - Log messages from FFmpeg are tracked using `logMessages`.

2.  **File Upload:**

    - The `react-dropzone` library is used to create a drag-and-drop area for file uploads.
    - When a video file is selected or dropped, the `handleFileSelect` function is triggered.
    - The selected file is stored in the `videoFile` state, and a preview URL is created for the video player.
    - Any previous conversion results, logs and errors are cleared, and the video player is updated with the new source.

3.  **Transcoding:**

    - When the "Convert to Light Mode" button is clicked, the `transcode` function is called.
    - The selected video file is written to the in-memory file system used by `ffmpeg.wasm`.
    - The following FFmpeg command is executed to apply the dark-to-light conversion effect:
      ```bash
        ffmpeg -i input.mp4 -vf scale=ceil(iw/2)*2:ceil(ih/2)*2,pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2,negate,hue=h=180,eq=contrast=1.2:saturation=1.1 output.mp4
      ```
      - `scale=ceil(iw/2)*2:ceil(ih/2)*2`: Ensures that the video dimensions are even, to prevent errors with some codecs.
      - `pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2`: Adds padding to the video, to prevent errors with some codecs.
      - `negate`: This filter negates the colors, which will be close to inverting it, but still retaining color.
      - `hue=h=180`: This filter rotates the hue of the video, further inverting the video.
      - `eq=contrast=1.2:saturation=1.1`: These filters adjust the contrast and saturation of the video.
    - The resulting video data is read from the `output.mp4` in-memory file.
    - A Blob URL is created from the output data, and the video player is updated with this new URL.
    - The URL is stored to be used for download.
    - A progress bar shows the percentage of completion of the video conversion.

4.  **Download:**

    - When the "Download" button is clicked, the `handleDownload` function is called.
    - The converted video blob url is used to create a temporary `<a>` tag, which is then clicked to download the file.

5.  **Logs:**

    - FFmpeg logs are displayed in an accordion.
    - The log area automatically scrolls down as new messages are added, except if the user scrolled up to see previous logs. This is done by checking if the user is scrolled near the bottom and by setting `shouldAutoScrollRef`.

6.  **Error handling:**

    - If any error is caught during the initialization or processing, the error is set in the `error` state, which will trigger the error message in the UI.

7.  **UI:**
    - The UI is built using `shadcn/ui` components, providing a consistent look and feel.
    - The UI includes buttons for loading the converter, uploading videos, converting, downloading and accordion to see the logs.
    - A progress bar shows the processing status when converting.
    - A video player shows the original and converted videos.

This setup allows users to convert video from dark to light mode with ease.
