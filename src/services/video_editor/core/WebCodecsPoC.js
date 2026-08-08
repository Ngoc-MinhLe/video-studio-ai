import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import * as MP4Box from 'mp4box';

/**
 * Helper to extract avcC description bytes from MP4Box track entries.
 * Necessary for VideoDecoder initialization with H.264 codec.
 */
function getAVCDescription(track) {
  const entry = track.entries[0];
  const avcC = entry.avc1?.avcC || entry.encv?.avc1?.avcC;
  if (!avcC) return null;
  
  // Write the avcC box to a raw binary stream
  const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
  avcC.write(stream);
  return new Uint8Array(stream.buffer, 8); // Skip 8-byte box size/type header
}

/**
 * Runs an offline H.264 rendering and muxing Proof of Concept (PoC) using WebCodecs.
 * This runs independently of the main rendering loop and measures real-world performance.
 * 
 * @returns {Promise<Object>} The benchmark results and output blob URL.
 */
export async function runWebCodecsPoC() {
  const results = {
    browserSupport: {
      videoEncoder: typeof VideoEncoder !== 'undefined',
      videoDecoder: typeof VideoDecoder !== 'undefined',
      audioEncoder: typeof AudioEncoder !== 'undefined',
      h264EncodeSupported: false,
      h264DecodeSupported: false,
      aacEncodeSupported: false
    },
    timings: {
      checkSupport: 0,
      render: 0,
      encode: 0,
      total: 0
    },
    metrics: {
      fps: 30,
      framesRendered: 150,
      realtimeSpeedFactor: 0.0,
      fileSizeMb: 0.0
    },
    error: null,
    videoUrl: null
  };

  const overallStart = performance.now();

  // 1. Check Browser Capability
  const supportStart = performance.now();
  if (results.browserSupport.videoEncoder) {
    try {
      const encodeConfig = {
        codec: 'avc1.4d001f', // H.264 Main Profile
        width: 1280,
        height: 720,
        bitrate: 2000000,
        framerate: 30,
        hardwareAcceleration: 'prefer-hardware'
      };
      const support = await VideoEncoder.isConfigSupported(encodeConfig);
      results.browserSupport.h264EncodeSupported = support.supported;
    } catch (e) {
      console.warn("VideoEncoder support check failed:", e);
    }
  }

  if (results.browserSupport.videoDecoder) {
    try {
      const decodeConfig = {
        codec: 'avc1.4d001f',
        width: 1280,
        height: 720
      };
      const support = await VideoDecoder.isConfigSupported(decodeConfig);
      results.browserSupport.h264DecodeSupported = support.supported;
    } catch (e) {
      console.warn("VideoDecoder support check failed:", e);
    }
  }

  if (results.browserSupport.audioEncoder) {
    try {
      const audioConfig = {
        codec: 'mp4a.40.2', // AAC-LC
        numberOfChannels: 2,
        sampleRate: 44100,
        bitrate: 128000
      };
      const support = await AudioEncoder.isConfigSupported(audioConfig);
      results.browserSupport.aacEncodeSupported = support.supported;
    } catch (e) {
      console.warn("AudioEncoder support check failed:", e);
    }
  }
  results.timings.checkSupport = performance.now() - supportStart;

  if (!results.browserSupport.videoEncoder || !results.browserSupport.h264EncodeSupported) {
    results.error = "WebCodecs or H.264 video encoding is not supported in this browser.";
    results.timings.total = performance.now() - overallStart;
    return results;
  }

  try {
    // 2. Setup Exporter & Muxer
    const width = 1280;
    const height = 720;
    const fps = 30;
    const duration = 5; // 5 seconds
    const totalFrames = fps * duration;

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height
      },
      fastStart: 'in-memory'
    });

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        muxer.addVideoChunk(chunk, metadata);
      },
      error: (err) => {
        console.error("VideoEncoder error in PoC:", err);
      }
    });

    const videoConfig = {
      codec: 'avc1.4d001f',
      width,
      height,
      bitrate: 2500000, // 2.5 Mbps
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware'
    };

    encoder.configure(videoConfig);

    // 3. Render and Encode Loop
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    let renderTime = 0;
    let encodeTime = 0;

    for (let i = 0; i < totalFrames; i++) {
      const projectTime = i / fps;

      // Render Frame
      const renderStart = performance.now();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Rotating Wheel (Offline Render Validation)
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(projectTime * Math.PI * 2);
      const grad = ctx.createLinearGradient(-150, -150, 150, 150);
      grad.addColorStop(0, '#a855f7');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Visualizer Simulation
      ctx.fillStyle = '#22c55e';
      for (let b = 0; b < 24; b++) {
        const barHeight = 80 + Math.sin(projectTime * 8 + b) * 60;
        ctx.fillRect(160 + b * 40, 620 - barHeight, 30, barHeight);
      }

      // Title Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`WebCodecs Offline PoC - Frame ${i + 1}/${totalFrames}`, width / 2, 100);

      // Subtitle Simulation
      ctx.font = '24px monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`Timeline: ${projectTime.toFixed(2)}s | CPU/GPU Offline Render`, width / 2, 160);

      renderTime += performance.now() - renderStart;

      // Encode Frame
      const encodeStart = performance.now();
      const timestampUs = i * (1000000 / fps);
      const frame = new VideoFrame(canvas, { timestamp: timestampUs });
      
      // Request keyframe every 30 frames
      encoder.encode(frame, { keyFrame: i % 30 === 0 });
      frame.close();
      encodeTime += performance.now() - encodeStart;
    }

    // Flush and Finalize
    await encoder.flush();
    muxer.finalize();

    const totalElapsed = performance.now() - overallStart;

    results.timings.render = renderTime;
    results.timings.encode = encodeTime;
    results.timings.total = totalElapsed;

    const buffer = muxer.target.buffer;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    
    results.metrics.fileSizeMb = blob.size / 1024 / 1024;
    results.metrics.realtimeSpeedFactor = duration / (totalElapsed / 1000);
    results.videoUrl = URL.createObjectURL(blob);

  } catch (err) {
    results.error = err.message || String(err);
  }

  return results;
}

/**
 * Runs an offline H.264 sequential decoding, rendering, and encoding PoC using a real uploaded MP4 file.
 * Decodes exactly the first 10 seconds of the video, overlays visualizer/subtitles, and muxes it back to MP4.
 * 
 * @param {File} file The real uploaded video file.
 * @returns {Promise<Object>} The benchmark results and output blob URL.
 */
export async function runWebCodecsVideoFilePoC(file) {
  const results = {
    browserSupport: {
      videoEncoder: typeof VideoEncoder !== 'undefined',
      videoDecoder: typeof VideoDecoder !== 'undefined',
      audioEncoder: typeof AudioEncoder !== 'undefined',
      h264EncodeSupported: false,
      h264DecodeSupported: false,
      aacEncodeSupported: false
    },
    timings: {
      demux: 0,
      decode: 0,
      render: 0,
      encode: 0,
      flush: 0,
      mux: 0,
      total: 0
    },
    metrics: {
      framesProcessed: 0,
      realtimeSpeedFactor: 0.0,
      fileSizeMb: 0.0
    },
    error: null,
    videoUrl: null
  };

  const overallStart = performance.now();

  try {
    // 1. Demuxing with mp4box.js
    const demuxStart = performance.now();
    const mp4boxFile = MP4Box.createFile();
    
    let videoTrack = null;
    let descriptionBytes = null;
    const samples = [];
    
    const demuxPromise = new Promise((resolve, reject) => {
      mp4boxFile.onReady = (info) => {
        videoTrack = info.videoTracks[0];
        if (!videoTrack) {
          reject(new Error("No video track found in the uploaded file. Please use an MP4 file with H.264 video."));
          return;
        }
        
        descriptionBytes = getAVCDescription(videoTrack);
        mp4boxFile.setExtraction(videoTrack.id);
        mp4boxFile.start();
      };
      
      mp4boxFile.onSamples = (track_id, ref, extractedSamples) => {
        samples.push(...extractedSamples);
        
        const timescale = videoTrack.timescale;
        const maxDurationUs = 10 * 1000000; // 10 seconds in microseconds
        
        // Calculate accumulated duration of samples collected so far
        let totalDurationUs = 0;
        for (const s of samples) {
          totalDurationUs += (s.duration / timescale) * 1000000;
        }
        
        if (totalDurationUs >= maxDurationUs || samples.length >= videoTrack.nb_samples) {
          mp4boxFile.stop();
          resolve();
        }
      };
      
      mp4boxFile.onError = (err) => {
        reject(new Error("MP4Box parsing error: " + err));
      };
      
      // Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        arrayBuffer.fileStart = 0;
        try {
          mp4boxFile.appendBuffer(arrayBuffer);
          mp4boxFile.flush();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

    await demuxPromise;
    results.timings.demux = performance.now() - demuxStart;

    if (samples.length === 0) {
      throw new Error("No samples extracted from the video file.");
    }

    // Filter samples to exactly 10 seconds
    const timescale = videoTrack.timescale;
    const targetFps = videoTrack.video.fps || 30;
    const width = 1280;
    const height = 720;
    
    let processedSamples = [];
    let accumulatedTimeUs = 0;
    for (const s of samples) {
      const sampleDurationUs = (s.duration / timescale) * 1000000;
      processedSamples.push(s);
      accumulatedTimeUs += sampleDurationUs;
      if (accumulatedTimeUs >= 10 * 1000000) {
        break;
      }
    }

    const totalFrames = processedSamples.length;
    results.metrics.framesProcessed = totalFrames;

    // Populate capabilities metadata
    results.browserSupport.videoEncoder = typeof VideoEncoder !== 'undefined';
    results.browserSupport.videoDecoder = typeof VideoDecoder !== 'undefined';
    results.browserSupport.audioEncoder = typeof AudioEncoder !== 'undefined';
    
    if (results.browserSupport.videoEncoder) {
      const support = await VideoEncoder.isConfigSupported({
        codec: 'avc1.4d001f',
        width,
        height,
        bitrate: 3000000,
        framerate: targetFps,
        hardwareAcceleration: 'prefer-hardware'
      });
      results.browserSupport.h264EncodeSupported = support.supported;
    }
    if (results.browserSupport.videoDecoder) {
      const support = await VideoDecoder.isConfigSupported({
        codec: videoTrack.codec,
        width: videoTrack.video.width,
        height: videoTrack.video.height
      });
      results.browserSupport.h264DecodeSupported = support.supported;
    }
    if (results.browserSupport.audioEncoder) {
      const support = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate: 44100,
        bitrate: 128000
      });
      results.browserSupport.aacEncodeSupported = support.supported;
    }

    // 2. Setup Muxer & VideoEncoder
    const muxStart = performance.now();
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height
      },
      fastStart: 'in-memory'
    });
    
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        muxer.addVideoChunk(chunk, metadata);
      },
      error: (err) => console.error("Encoder error in PoC Step 2:", err)
    });

    const videoConfig = {
      codec: 'avc1.4d001f',
      width,
      height,
      bitrate: 3000000, // 3 Mbps
      framerate: targetFps,
      hardwareAcceleration: 'prefer-hardware'
    };
    encoder.configure(videoConfig);
    results.timings.mux += performance.now() - muxStart;

    // 3. Setup VideoDecoder
    let frameResolver = null;
    const decoder = new VideoDecoder({
      output: (frame) => {
        if (frameResolver) {
          frameResolver(frame);
        }
      },
      error: (err) => console.error("Decoder error in PoC Step 2:", err)
    });

    const decoderConfig = {
      codec: videoTrack.codec,
      codedWidth: videoTrack.video.width,
      codedHeight: videoTrack.video.height
    };
    if (descriptionBytes) {
      decoderConfig.description = descriptionBytes;
    }
    decoder.configure(decoderConfig);

    // Canvas setup
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    let decodeTime = 0;
    let renderTime = 0;
    let encodeTime = 0;

    // 4. Sequential Decode -> Render -> Encode Loop (Backpressure 1-frame deep)
    for (let i = 0; i < totalFrames; i++) {
      const sample = processedSamples[i];
      const sampleTimeUs = (sample.cts / timescale) * 1000000;
      const sampleDurationUs = (sample.duration / timescale) * 1000000;

      // Construct EncodedVideoChunk
      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: sampleTimeUs,
        duration: sampleDurationUs,
        data: sample.data
      });

      // Decode and await output
      const decodePromise = new Promise((resolve) => {
        frameResolver = resolve;
      });

      const frameDecodeStart = performance.now();
      decoder.decode(chunk);
      const decodedFrame = await decodePromise;
      decodeTime += performance.now() - frameDecodeStart;

      // Render Frame (Draw video source, visualizer bar, text subtitle)
      const frameRenderStart = performance.now();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Draw decoded video frame
      ctx.drawImage(decodedFrame, 0, 0, width, height);
      decodedFrame.close(); // Release GPU memory immediately!

      // Draw visualizer bars on top (sine wave offset)
      ctx.fillStyle = '#ec4899';
      const animTime = sampleTimeUs / 1000000;
      for (let b = 0; b < 16; b++) {
        const barHeight = 40 + Math.sin(animTime * 10 + b) * 30;
        ctx.fillRect(240 + b * 50, 640 - barHeight, 40, barHeight);
      }

      // Title & Subtitle overlay texts
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`WebCodecs Offline Video PoC - Frame ${i + 1}/${totalFrames}`, width / 2, 60);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#a855f7';
      ctx.fillText(`Timeline: ${(sampleTimeUs / 1000000).toFixed(2)}s | Source Codec: ${videoTrack.codec}`, width / 2, 100);

      renderTime += performance.now() - frameRenderStart;

      // Encode Frame
      const frameEncodeStart = performance.now();
      const outputFrame = new VideoFrame(canvas, { timestamp: sampleTimeUs });
      encoder.encode(outputFrame, { keyFrame: i % 30 === 0 });
      outputFrame.close();
      encodeTime += performance.now() - frameEncodeStart;
    }

    // 5. Flush and Finalize
    const flushStart = performance.now();
    await decoder.flush();
    await encoder.flush();
    results.timings.flush = performance.now() - flushStart;

    const muxFinalizeStart = performance.now();
    muxer.finalize();
    results.timings.mux += performance.now() - muxFinalizeStart;

    const totalElapsed = performance.now() - overallStart;

    results.timings.decode = decodeTime;
    results.timings.render = renderTime;
    results.timings.encode = encodeTime;
    results.timings.total = totalElapsed;

    const buffer = muxer.target.buffer;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    
    results.metrics.fileSizeMb = blob.size / 1024 / 1024;
    const actualDurationSec = accumulatedTimeUs / 1000000;
    results.metrics.realtimeSpeedFactor = actualDurationSec / (totalElapsed / 1000);
    results.videoUrl = URL.createObjectURL(blob);

  } catch (err) {
    results.error = err.message || String(err);
  }

  return results;
}
