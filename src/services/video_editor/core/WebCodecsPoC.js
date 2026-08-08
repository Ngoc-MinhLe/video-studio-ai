import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import * as MP4Box from 'mp4box';

/**
 * Helper to extract codec description bytes (extradata) and its parsed box from the raw MP4 stsd box entries.
 * Necessary for VideoDecoder initialization with H.264, HEVC, or VP9 codec.
 */
function getCodecDescription(mp4boxFile, trackId) {
  try {
    if (!mp4boxFile || !mp4boxFile.moov) return null;
    const trak = mp4boxFile.moov.traks.find(t => t.tkhd && t.tkhd.track_id === trackId);
    if (!trak) return null;
    
    const stsd = trak.mdia?.minf?.stbl?.stsd;
    if (!stsd || !stsd.entries || stsd.entries.length === 0) return null;
    
    const entry = stsd.entries[0];
    const box = entry.avc1 || entry.encv?.avc1 || entry.hvc1 || entry.hev1 || entry.vp09 || entry.vp9;
    if (!box) return null;

    // Handle H.264 (AVC) manually to serialise the AVCDecoderConfigurationRecord reliably
    if (box.avcC) {
      const avcC = box.avcC;
      const spsList = avcC.SPS || [];
      const ppsList = avcC.PPS || [];
      
      let totalSize = 6;
      for (const sps of spsList) totalSize += 2 + sps.length;
      for (const pps of ppsList) totalSize += 2 + pps.length;
      
      const data = new Uint8Array(totalSize);
      data[0] = avcC.configurationVersion || 1;
      data[1] = avcC.AVCProfileIndication;
      data[2] = avcC.profile_compatibility;
      data[3] = avcC.AVCLevelIndication;
      data[4] = 0xFC | (avcC.lengthSizeMinusOne ?? 3);
      data[5] = 0xE0 | spsList.length;
      
      let offset = 6;
      for (const sps of spsList) {
        const len = sps.length;
        data[offset++] = (len >> 8) & 0xFF;
        data[offset++] = len & 0xFF;
        data.set(sps.nalu, offset);
        offset += len;
      }
      
      data[offset++] = ppsList.length;
      for (const pps of ppsList) {
        const len = pps.length;
        data[offset++] = (len >> 8) & 0xFF;
        data[offset++] = len & 0xFF;
        data.set(pps.nalu, offset);
        offset += len;
      }
      return { description: data, box };
    }

    // Fallback for HEVC/VP9: try writing the raw parsed config box
    const configBox = box.hvcC || box.vpcC;
    if (configBox && typeof configBox.write === 'function') {
      const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
      configBox.write(stream);
      return { description: new Uint8Array(stream.buffer, 8), box };
    }
  } catch (e) {
    console.warn("Failed to extract codec description from stsd box:", e);
  }
  return null;
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
    meta: {
      sourceCodec: 'unknown',
      targetCodec: 'unknown',
      width: 0,
      height: 0,
      hasAvcc: false,
      spsCount: 0,
      ppsCount: 0
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
  let pipelineError = null;
  const decodedFrames = [];
  let frameWaiter = null;
  let decoderInstance = null;
  let encoderInstance = null;

  try {
    // 1. Demuxing with mp4box.js
    const demuxStart = performance.now();
    const mp4boxFile = MP4Box.createFile();
    
    let videoTrack = null;
    let descriptionBytes = null;
    let targetCodecString = 'unknown';
    const samples = [];
    
    const demuxPromise = new Promise((resolve, reject) => {
      mp4boxFile.onReady = (info) => {
        videoTrack = info.videoTracks[0];
        if (!videoTrack) {
          reject(new Error("No video track found in the uploaded file. Please use an MP4 file with H.264 video."));
          return;
        }
        
        // Extract description and refine codec string to avoid ambiguous name errors
        const descResult = getCodecDescription(mp4boxFile, videoTrack.id);
        targetCodecString = videoTrack.codec;
        
        if (descResult) {
          descriptionBytes = descResult.description;
          const box = descResult.box;
          
          results.meta.hasAvcc = !!box.avcC;
          if (box.avcC) {
            results.meta.spsCount = box.avcC.SPS?.length || 0;
            results.meta.ppsCount = box.avcC.PPS?.length || 0;
            
            // Build RFC 6381 codec string avc1.PPCCLL (profile, compatibility, level in hex)
            if (videoTrack.codec.startsWith('avc1')) {
              const profile = box.avcC.AVCProfileIndication.toString(16).padStart(2, '0');
              const comp = box.avcC.profile_compatibility.toString(16).padStart(2, '0');
              const level = box.avcC.AVCLevelIndication.toString(16).padStart(2, '0');
              targetCodecString = `avc1.${profile}${comp}${level}`;
            }
          }
        }
        
        results.meta.sourceCodec = videoTrack.codec;
        results.meta.targetCodec = targetCodecString;
        results.meta.width = videoTrack.video.width;
        results.meta.height = videoTrack.video.height;

        console.log("PoC Metadatas: ", { ...results.meta, descriptionSize: descriptionBytes?.length });

        // Ensure file is H.264/AVC
        if (!videoTrack.codec.startsWith('avc1') && !videoTrack.codec.startsWith('encv')) {
          reject(new Error(`PoC only supports H.264 (avc1) files. Found codec: ${videoTrack.codec}`));
          return;
        }

        mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1000 });
        mp4boxFile.start();
      };
      
      mp4boxFile.onSamples = (track_id, ref, extractedSamples) => {
        samples.push(...extractedSamples);
        
        const timescale = videoTrack.timescale;
        const maxDurationUs = 10 * 1000000; // 10 seconds in microseconds
        
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

    // Align to the first keyframe (sync frame)
    const firstKeyframeIndex = samples.findIndex(s => s.is_sync);
    if (firstKeyframeIndex === -1) {
      throw new Error("No sync frame (keyframe) found in the video track. Cannot decode.");
    }
    
    // Slice samples from the first keyframe onwards
    const startingSamples = samples.slice(firstKeyframeIndex);
    const timescale = videoTrack.timescale;
    const targetFps = videoTrack.video.fps || 30;
    const width = 1280;
    const height = 720;
    
    let processedSamples = [];
    let accumulatedTimeUs = 0;
    for (const s of startingSamples) {
      const sampleDurationUs = (s.duration / timescale) * 1000000;
      processedSamples.push(s);
      accumulatedTimeUs += sampleDurationUs;
      if (accumulatedTimeUs >= 10 * 1000000) {
        break;
      }
    }

    const totalFrames = processedSamples.length;
    results.metrics.framesProcessed = totalFrames;

    // Check capabilities metadata
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
    
    encoderInstance = new VideoEncoder({
      output: (chunk, metadata) => {
        muxer.addVideoChunk(chunk, metadata);
      },
      error: (err) => {
        console.error("Encoder error in PoC Step 2:", err);
        pipelineError = `Encoder error: ${err.message || err}`;
        if (frameWaiter) frameWaiter();
      }
    });

    const videoConfig = {
      codec: 'avc1.4d001f',
      width,
      height,
      bitrate: 3000000, // 3 Mbps
      framerate: targetFps,
      hardwareAcceleration: 'prefer-hardware'
    };
    try {
      encoderInstance.configure(videoConfig);
    } catch (err) {
      throw new Error(`VideoEncoder configuration failed (H.264 Profile): ${err.message}`);
    }
    results.timings.mux += performance.now() - muxStart;

    // 3. Setup VideoDecoder with B-frame queue coordination
    decoderInstance = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
        if (frameWaiter) {
          const resolve = frameWaiter;
          frameWaiter = null;
          resolve();
        }
      },
      error: (err) => {
        console.error("Decoder error in PoC Step 2:", err);
        pipelineError = `Decoder error: ${err.message || err}`;
        if (frameWaiter) frameWaiter();
      }
    });

    const decoderConfig = {
      codec: targetCodecString,
      codedWidth: videoTrack.video.width,
      codedHeight: videoTrack.video.height
    };
    if (descriptionBytes) {
      decoderConfig.description = descriptionBytes;
    }

    // Verify decoder config before configure() using fallback options if needed
    console.log("Checking VideoDecoder configuration support for codec:", targetCodecString);
    let decSupport = await VideoDecoder.isConfigSupported(decoderConfig);
    
    results.meta.supportCheck = {
      originalCodec: targetCodecString,
      originalSupported: decSupport.supported,
      fallbackTried: false,
      fallbackCodec: '',
      fallbackSupported: false,
      finalCodecUsed: targetCodecString,
      configObj: {
        codec: decoderConfig.codec,
        codedWidth: decoderConfig.codedWidth,
        codedHeight: decoderConfig.codedHeight,
        descriptionLength: descriptionBytes ? descriptionBytes.byteLength : 0
      }
    };

    if (!decSupport.supported && targetCodecString.startsWith('avc1')) {
      // Try resolving constraint flags profile compatibility issues: replace CC with '00'
      const parts = targetCodecString.split('.');
      if (parts.length === 2 && parts[1].length === 6) {
        const profile = parts[1].slice(0, 2);
        const level = parts[1].slice(4, 6);
        const fallbackCodec = `avc1.${profile}00${level}`;
        
        results.meta.supportCheck.fallbackTried = true;
        results.meta.supportCheck.fallbackCodec = fallbackCodec;
        
        console.log("Original codec rejected by browser. Retrying fallback config with:", fallbackCodec);
        const fallbackConfig = { ...decoderConfig, codec: fallbackCodec };
        const fallbackSupport = await VideoDecoder.isConfigSupported(fallbackConfig);
        
        results.meta.supportCheck.fallbackSupported = fallbackSupport.supported;
        
        if (fallbackSupport.supported) {
          console.log("Fallback codec configuration is supported. Using:", fallbackCodec);
          decoderConfig.codec = fallbackCodec;
          targetCodecString = fallbackCodec;
          results.meta.supportCheck.finalCodecUsed = fallbackCodec;
          decSupport = fallbackSupport;
        }
      }
    }

    if (!decSupport.supported) {
      throw new Error(`VideoDecoder does not support this codec configuration: "${targetCodecString}" (${videoTrack.video.width}x${videoTrack.video.height}). isConfigSupported returned unsupported.`);
    }
    
    results.browserSupport.h264DecodeSupported = true;

    try {
      decoderInstance.configure(decoderConfig);
    } catch (err) {
      throw new Error(`VideoDecoder configure() threw error for "${targetCodecString}": ${err.message}`);
    }
    
    // Canvas setup
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    let decodeTime = 0;
    let renderTime = 0;
    let encodeTime = 0;

    let framesProcessed = 0;
    let chunksFed = 0;

    // Helper to pull decoded frames from the queue (rejects if pipelineError happens)
    const getNextFrame = () => {
      if (pipelineError) {
        return Promise.reject(new Error(pipelineError));
      }
      if (decodedFrames.length > 0) {
        return Promise.resolve(decodedFrames.shift());
      }
      return new Promise((resolve, reject) => {
        frameWaiter = () => {
          if (pipelineError) {
            reject(new Error(pipelineError));
          } else {
            resolve(decodedFrames.shift());
          }
        };
      });
    };

    // Helper to feed chunks ahead to maintain a 15-frame pipeline depth (prevents B-frame deadlock)
    const feedDecoder = () => {
      while (chunksFed < totalFrames && (chunksFed - framesProcessed) < 15) {
        if (pipelineError) break;
        const sample = processedSamples[chunksFed];
        const sampleTimeUs = (sample.cts / timescale) * 1000000;
        const sampleDurationUs = (sample.duration / timescale) * 1000000;

        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: sampleTimeUs,
          duration: sampleDurationUs,
          data: sample.data
        });
        decoderInstance.decode(chunk);
        chunksFed++;
      }
    };

    // 4. Sequential Decode -> Render -> Encode Loop
    for (let i = 0; i < totalFrames; i++) {
      // Timeout Safety check (Abort if processing exceeds 10 seconds total)
      if (performance.now() - overallStart > 10000) {
        throw new Error("Timeout: WebCodecs processing took longer than 10 seconds. Aborted to prevent browser freeze.");
      }

      if (pipelineError) {
        throw new Error(pipelineError);
      }

      // Feed samples to decoder ahead
      feedDecoder();

      // Retrieve the next decoded frame
      const frameDecodeStart = performance.now();
      const decodedFrame = await getNextFrame();
      decodeTime += performance.now() - frameDecodeStart;

      const sampleTimeUs = decodedFrame.timestamp;

      // Render Frame
      const frameRenderStart = performance.now();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Draw decoded video frame
      ctx.drawImage(decodedFrame, 0, 0, width, height);
      decodedFrame.close(); // Release GPU memory immediately!

      // Draw visualizer bars on top
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
      encoderInstance.encode(outputFrame, { keyFrame: i % 30 === 0 });
      outputFrame.close();
      encodeTime += performance.now() - frameEncodeStart;

      framesProcessed++;
    }

    // 5. Flush and Finalize
    const flushStart = performance.now();
    await decoderInstance.flush();
    await encoderInstance.flush();
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
  } finally {
    // 6. Mandatory cleanup: Release decoders/encoders and pending frames on any exit/error
    if (decoderInstance) {
      try {
        decoderInstance.close();
      } catch (e) {}
    }
    if (encoderInstance) {
      try {
        encoderInstance.close();
      } catch (e) {}
    }
    // Clean queue
    for (const f of decodedFrames) {
      try {
        f.close();
      } catch (e) {}
    }
    decodedFrames.length = 0;
  }

  return results;
}
