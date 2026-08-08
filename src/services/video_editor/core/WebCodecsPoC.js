import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import * as MP4Box from 'mp4box';

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
 * Performs deep debug metrics and writes them back to the results metadata.
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
      avccData: null,
      descriptionByteLength: 0,
      descriptionHex: '',
      supportCheck: null,
      debugBox: null,
      spsDebug: null,
      ppsDebug: null
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
        
        // Setup initial debugBox metadata struct
        results.meta.debugBox = {
          trakFound: false,
          stsdFound: false,
          entriesCount: 0,
          firstEntryType: 'none',
          firstEntryKeys: [],
          boxesFoundTypes: [],
          avccBoxKeys: [],
          avccBoxConstructor: '',
          avccSerializationError: '',
          avccSerializeMethodUsed: 'none'
        };
        
        if (mp4boxFile.moov) {
          const trak = mp4boxFile.moov.traks.find(t => t.tkhd && t.tkhd.track_id === videoTrack.id);
          if (trak) {
            results.meta.debugBox.trakFound = true;
            const stsd = trak.mdia?.minf?.stbl?.stsd;
            if (stsd) {
              results.meta.debugBox.stsdFound = true;
              if (stsd.entries) {
                results.meta.debugBox.entriesCount = stsd.entries.length;
                if (stsd.entries.length > 0) {
                  const entry = stsd.entries[0];
                  results.meta.debugBox.firstEntryType = entry.type || 'unknown';
                  results.meta.debugBox.firstEntryKeys = Object.keys(entry);
                  if (entry.boxes) {
                    results.meta.debugBox.boxesFoundTypes = entry.boxes.map(b => b.type);
                  }

                  // Find avcC box
                  let avcC = entry.avcC;
                  if (!avcC && entry.boxes) {
                    avcC = entry.boxes.find(b => b.type === 'avcC');
                  }

                  if (avcC) {
                    results.meta.debugBox.avccBoxKeys = Object.keys(avcC);
                    results.meta.debugBox.avccBoxConstructor = avcC.constructor?.name || typeof avcC;
                    results.meta.hasAvcc = true;

                    // 1. DUMP avcC.SPS[0] diagnostics
                    if (avcC.SPS && avcC.SPS.length > 0) {
                      const sps = avcC.SPS[0];
                      results.meta.spsDebug = {
                        exists: true,
                        constructorName: sps.constructor?.name || '',
                        typeOf: typeof sps,
                        isArray: Array.isArray(sps),
                        isUint8Array: sps instanceof Uint8Array,
                        isArrayBuffer: sps instanceof ArrayBuffer,
                        byteLength: sps.byteLength,
                        length: sps.length,
                        keys: Object.keys(sps),
                        properties: {}
                      };
                      // Safe properties extraction
                      for (const k of results.meta.spsDebug.keys) {
                        try {
                          const val = sps[k];
                          if (val instanceof Uint8Array) {
                            results.meta.spsDebug.properties[k] = `Uint8Array(${val.length}) HEX: ${Array.from(val.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}`;
                          } else {
                            results.meta.spsDebug.properties[k] = `${typeof val} = ${JSON.stringify(val)}`;
                          }
                        } catch (e) {
                          results.meta.spsDebug.properties[k] = `Error: ${e.message}`;
                        }
                      }
                      // HEX dump of first 32 bytes
                      try {
                        const targetBytes = sps.nalu || sps;
                        if (targetBytes) {
                          results.meta.spsDebug.hex32 = Array.from(targetBytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
                        }
                      } catch (e) {
                        results.meta.spsDebug.hex32 = `HexErr: ${e.message}`;
                      }
                    } else {
                      results.meta.spsDebug = { exists: false };
                    }

                    // 2. DUMP avcC.PPS[0] diagnostics
                    if (avcC.PPS && avcC.PPS.length > 0) {
                      const pps = avcC.PPS[0];
                      results.meta.ppsDebug = {
                        exists: true,
                        constructorName: pps.constructor?.name || '',
                        typeOf: typeof pps,
                        isArray: Array.isArray(pps),
                        isUint8Array: pps instanceof Uint8Array,
                        isArrayBuffer: pps instanceof ArrayBuffer,
                        byteLength: pps.byteLength,
                        length: pps.length,
                        keys: Object.keys(pps),
                        properties: {}
                      };
                      // Safe properties extraction
                      for (const k of results.meta.ppsDebug.keys) {
                        try {
                          const val = pps[k];
                          if (val instanceof Uint8Array) {
                            results.meta.ppsDebug.properties[k] = `Uint8Array(${val.length}) HEX: ${Array.from(val.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}`;
                          } else {
                            results.meta.ppsDebug.properties[k] = `${typeof val} = ${JSON.stringify(val)}`;
                          }
                        } catch (e) {
                          results.meta.ppsDebug.properties[k] = `Error: ${e.message}`;
                        }
                      }
                      // HEX dump of first 32 bytes
                      try {
                        const targetBytes = pps.nalu || pps;
                        if (targetBytes) {
                          results.meta.ppsDebug.hex32 = Array.from(targetBytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
                        }
                      } catch (e) {
                        results.meta.ppsDebug.hex32 = `HexErr: ${e.message}`;
                      }
                    } else {
                      results.meta.ppsDebug = { exists: false };
                    }

                    // 3. Serialize AVCDecoderConfigurationRecord using mp4box official write()
                    try {
                      const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
                      avcC.write(stream);
                      const rawBox = new Uint8Array(stream.buffer);
                      if (rawBox.length > 8) {
                        descriptionBytes = rawBox.slice(8); // Strip 8-byte box size/type header
                        results.meta.debugBox.avccSerializeMethodUsed = 'mp4box_avcC_write';
                      }
                    } catch (serErr) {
                      results.meta.debugBox.avccSerializationError = serErr.message || String(serErr);
                      console.error("Failed to serialize avcC box via write():", serErr);
                    }

                    // Capture raw metadata fields
                    results.meta.avccData = {
                      configurationVersion: avcC.configurationVersion || 1,
                      AVCProfileIndication: avcC.AVCProfileIndication || 0,
                      profile_compatibility: avcC.profile_compatibility || 0,
                      AVCLevelIndication: avcC.AVCLevelIndication || 0,
                      lengthSizeMinusOne: avcC.lengthSizeMinusOne ?? 3,
                      spsCount: avcC.SPS?.length || 0,
                      ppsCount: avcC.PPS?.length || 0,
                      nb_SPS_nalus: avcC.nb_SPS_nalus || 0,
                      nb_PPS_nalus: avcC.nb_PPS_nalus || 0,
                      avccFullHex: descriptionBytes ? Array.from(descriptionBytes).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase() : ''
                    };
                  }
                }
              }
            }
          }
        }
        
        targetCodecString = videoTrack.codec;
        results.meta.sourceCodec = videoTrack.codec;
        results.meta.targetCodec = targetCodecString;
        results.meta.width = videoTrack.track_width || (videoTrack.video && videoTrack.video.width) || 1920;
        results.meta.height = videoTrack.track_height || (videoTrack.video && videoTrack.video.height) || 1080;
        results.meta.descriptionByteLength = descriptionBytes ? descriptionBytes.byteLength : 0;
        
        if (descriptionBytes) {
          const firstBytesHex = Array.from(descriptionBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
          const lastBytesHex = Array.from(descriptionBytes.slice(-8)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
          results.meta.descriptionHex = `Start: [${firstBytesHex}] ... End: [${lastBytesHex}]`;
        }

        console.log("Strict PoC Box debug metadata:", { ...results.meta });

        if (!videoTrack.codec.startsWith('avc1') && !videoTrack.codec.startsWith('encv')) {
          reject(new Error(`PoC only supports H.264 (avc1) files. Found codec: ${videoTrack.codec}`));
          return;
        }

        mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1000 });
        mp4boxFile.start();
      };
      
      mp4boxFile.onSamples = (track_id, ref, extractedSamples) => {
        samples.push(...extractedSamples);
        if (samples.length >= videoTrack.nb_samples) {
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

    // Align to the first keyframe
    const firstKeyframeIndex = samples.findIndex(s => s.is_sync);
    if (firstKeyframeIndex === -1) {
      throw new Error("No sync frame (keyframe) found in the video track. Cannot decode.");
    }
    
    // Process all samples from the first keyframe to the end
    const processedSamples = samples.slice(firstKeyframeIndex);
    const timescale = videoTrack.timescale;
    const targetFps = videoTrack.video.fps || 30;
    
    const width = 1280;
    const height = 720;

    const totalFrames = processedSamples.length;
    results.metrics.framesProcessed = totalFrames;

    // Check capabilities
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

    // STRICT VALIDATION: Halt pipeline if description is missing or invalid
    if (!descriptionBytes || descriptionBytes.byteLength === 0) {
      throw new Error("AVCDecoderConfigurationRecord (avcC) is missing or empty. Halting pipeline execution before configure.");
    }

    const trackWidth = results.meta.width;
    const trackHeight = results.meta.height;

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
      bitrate: 3000000,
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
      codedWidth: trackWidth,
      codedHeight: trackHeight,
      displayWidth: trackWidth,
      displayHeight: trackHeight,
      hardwareAcceleration: 'prefer-hardware',
      description: descriptionBytes
    };

    // STRICT browser configuration support checking
    console.log("Checking support for STRICT configuration:", decoderConfig);
    let decSupport = null;
    try {
      decSupport = await VideoDecoder.isConfigSupported(decoderConfig);
      results.meta.supportCheck = {
        supported: decSupport.supported,
        codec: decSupport.config?.codec || decoderConfig.codec,
        configReturned: decSupport.config ? {
          codec: decSupport.config.codec,
          codedWidth: decSupport.config.codedWidth,
          codedHeight: decSupport.config.codedHeight,
          displayWidth: decSupport.config.displayWidth,
          displayHeight: decSupport.config.displayHeight,
          hardwareAcceleration: decSupport.config.hardwareAcceleration
        } : null
      };
    } catch (err) {
      results.meta.supportCheck = {
        supported: false,
        error: err.message || String(err)
      };
    }

    if (!decSupport || !decSupport.supported) {
      throw new Error(`VideoDecoder STRICT configuration check failed for "${targetCodecString}" (${trackWidth}x${trackHeight}). browser isConfigSupported returned false.`);
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
      // Timeout safety guard (60 seconds)
      if (performance.now() - overallStart > 60000) {
        throw new Error("Timeout: WebCodecs processing exceeded 60 seconds total limit.");
      }

      if (pipelineError) {
        throw new Error(pipelineError);
      }

      feedDecoder();

      const frameDecodeStart = performance.now();
      const decodedFrame = await getNextFrame();
      decodeTime += performance.now() - frameDecodeStart;

      const sampleTimeUs = decodedFrame.timestamp;

      const frameRenderStart = performance.now();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(decodedFrame, 0, 0, width, height);
      decodedFrame.close();

      ctx.fillStyle = '#ec4899';
      const animTime = sampleTimeUs / 1000000;
      for (let b = 0; b < 16; b++) {
        const barHeight = 40 + Math.sin(animTime * 10 + b) * 30;
        ctx.fillRect(240 + b * 50, 640 - barHeight, 40, barHeight);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`WebCodecs Offline Video PoC - Frame ${i + 1}/${totalFrames}`, width / 2, 60);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#a855f7';
      ctx.fillText(`Timeline: ${(sampleTimeUs / 1000000).toFixed(2)}s | Source Codec: ${videoTrack.codec}`, width / 2, 100);

      renderTime += performance.now() - frameRenderStart;

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
    const actualDurationSec = (processedSamples[totalFrames - 1].cts + processedSamples[totalFrames - 1].duration - processedSamples[0].cts) / timescale;
    results.metrics.realtimeSpeedFactor = actualDurationSec / (totalElapsed / 1000);
    results.videoUrl = URL.createObjectURL(blob);

  } catch (err) {
    results.error = err.message || String(err);
  } finally {
    if (decoderInstance) {
      try { decoderInstance.close(); } catch (e) {}
    }
    if (encoderInstance) {
      try { encoderInstance.close(); } catch (e) {}
    }
    for (const f of decodedFrames) {
      try { f.close(); } catch (e) {}
    }
    decodedFrames.length = 0;
  }

  return results;
}
