import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

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
