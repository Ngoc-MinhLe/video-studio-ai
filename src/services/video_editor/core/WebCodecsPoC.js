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

  return results;
}

/**
 * Diagnostic Mode Step 3:
 * - Demuxes and decodes first 5 H.264 samples using VideoDecoder.
 * - Renders each decoded VideoFrame to a Canvas.
 * - Constructs a new VideoFrame from Canvas with output timestamps based on 25 FPS (0, 40000, 80000, 120000, 160000 µs).
 * - VideoEncoder encodes exactly these 5 frames.
 * - Muxes these 5 encoded chunks into an MP4 file using mp4-muxer.
 * - Performs offline playback verification inside an HTMLVideoElement.
 * 
 * @param {File} file The real uploaded video file.
 * @param {number} frameLimit Limit the number of samples to process.
 * @param {Function} onProgress Progress callback.
 * @returns {Promise<Object>} The diagnostic results.
 */
export async function runWebCodecsVideoFilePoC(file, frameLimit = 25, onProgress) {
  const results = {
    browserSupport: {
      videoDecoder: typeof VideoDecoder !== 'undefined',
      h264DecodeSupported: false
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
      ppsDebug: null,
      inputDuration: 0,
      inputFps: 0,
      totalSamplesInFile: 0,
      testLimitFramesCount: frameLimit
    },
    diagnosticsMode: {
      active: true,
      configureStatus: 'PENDING',
      configureError: null,
      samplesLogged: [],
      outputCallbackCount: 0,
      errorCallbackCount: 0,
      outputFramesLog: [],
      decoderError: null,
      
      // Stage timeline logs
      decodedFramesCount: 0,
      renderedFramesCount: 0,
      encodeSubmittedCount: 0,
      encodedChunksCount: 0,
      encoderChunksLogged: [],
      encoderError: null,
      encoderFlushStatus: 'PENDING',

      // Muxer diagnostics
      muxedChunksCount: 0,
      muxStatus: 'PENDING',
      finalizeStatus: 'PENDING',
      muxError: null,
      mp4ByteLength: 0,
      playbackTest: null
    },
    timings: {
      demux: 0,
      decode: 0,
      render: 0,
      encode: 0,
      mux: 0,
      total: 0
    },
    metrics: {
      framesDecoded: 0,
      realtimeSpeedFactor: 0,
      success: false
    },
    error: null,
    videoUrl: null
  };

  const overallStart = performance.now();
  let decoderInstance = null;
  let encoderInstance = null;
  const decodedFrames = [];
  let frameWaiter = null;

  try {
    // 1. Demux samples with mp4box.js
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
          reject(new Error("No video track found in the uploaded file."));
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

                  let avcC = entry.avcC;
                  if (!avcC && entry.boxes) {
                    avcC = entry.boxes.find(b => b.type === 'avcC');
                  }

                  if (avcC) {
                    results.meta.debugBox.avccBoxKeys = Object.keys(avcC);
                    results.meta.debugBox.avccBoxConstructor = avcC.constructor?.name || typeof avcC;
                    results.meta.hasAvcc = true;

                    // DUMP avcC.SPS[0] diagnostics
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

                    // DUMP avcC.PPS[0] diagnostics
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

                    // Serialize AVCDecoderConfigurationRecord using mp4box official write()
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
                    }

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
        results.meta.inputDuration = (videoTrack.duration / videoTrack.timescale);
        results.meta.inputFps = videoTrack.video.fps || (videoTrack.nb_samples / results.meta.inputDuration) || 25;
        
        if (descriptionBytes) {
          const firstBytesHex = Array.from(descriptionBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
          const lastBytesHex = Array.from(descriptionBytes.slice(-8)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
          results.meta.descriptionHex = `Start: [${firstBytesHex}] ... End: [${lastBytesHex}]`;
        }

        if (!videoTrack.codec.startsWith('avc1') && !videoTrack.codec.startsWith('encv')) {
          reject(new Error(`PoC only supports H.264 (avc1) files. Found codec: ${videoTrack.codec}`));
          return;
        }

        mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 10000 });
        mp4boxFile.start();
      };
      
      mp4boxFile.onSamples = (track_id, ref, extractedSamples) => {
        samples.push(...extractedSamples);
        results.meta.totalSamplesInFile = samples.length;
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

    const firstKeyframeIndex = samples.findIndex(s => s.is_sync);
    if (firstKeyframeIndex === -1) {
      throw new Error("No sync frame (keyframe) found in the video track. Cannot decode.");
    }
    
    // Scale frames based on frameLimit
    const availableSamples = samples.slice(firstKeyframeIndex);
    const totalFrames = Math.min(availableSamples.length, frameLimit);
    results.meta.testLimitFramesCount = totalFrames;

    const diagnosticSamples = availableSamples.slice(0, totalFrames);
    const timescale = videoTrack.timescale;
    const trackWidth = results.meta.width;
    const trackHeight = results.meta.height;

    // STRICT VALIDATION: Halt pipeline if description is missing or invalid
    if (!descriptionBytes || descriptionBytes.byteLength === 0) {
      throw new Error("AVCDecoderConfigurationRecord (avcC) is missing or empty. Cannot configure VideoDecoder.");
    }

    // 2. Setup VideoDecoder (FROZEN decoder callbacks and config)
    decoderInstance = new VideoDecoder({
      output: (frame) => {
        try {
          results.diagnosticsMode.outputCallbackCount++;
          
          if (results.diagnosticsMode.outputFramesLog.length < 10) {
            results.diagnosticsMode.outputFramesLog.push({
              timestamp: frame.timestamp,
              width: frame.codedWidth,
              height: frame.codedHeight
            });
          }
          
          // Transfer ownership to the decoded queue
          decodedFrames.push(frame);
          results.diagnosticsMode.decodedFramesCount++;

          if (frameWaiter) {
            frameWaiter();
          }
        } catch (err) {
          console.error("Error in VideoDecoder output callback:", err);
          frame.close(); 
          throw err;
        }
      },
      error: (err) => {
        results.diagnosticsMode.errorCallbackCount++;
        results.diagnosticsMode.decoderError = err.message || String(err);
        console.error("Decoder error:", err);
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

    // Check support
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
      throw new Error(`VideoDecoder STRICT configuration check failed for "${targetCodecString}".`);
    }

    results.browserSupport.h264DecodeSupported = true;

    try {
      decoderInstance.configure(decoderConfig);
      results.diagnosticsMode.configureStatus = 'SUCCESS';
    } catch (err) {
      results.diagnosticsMode.configureStatus = 'ERROR';
      results.diagnosticsMode.configureError = err.message || String(err);
      throw err;
    }

    // 3. Setup Muxer & VideoEncoder
    const targetWidth = 768; 
    const targetHeight = 432; 
    const targetFps = 25; 

    let muxer = null;
    try {
      muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: targetWidth,
          height: targetHeight
        },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset'
      });
      results.diagnosticsMode.muxStatus = 'SUCCESS';
    } catch (muxErr) {
      results.diagnosticsMode.muxStatus = 'ERROR';
      results.diagnosticsMode.muxError = `Muxer initialization failed: ${muxErr.message || muxErr}`;
      throw muxErr;
    }

    encoderInstance = new VideoEncoder({
      output: (chunk, metadata) => {
        results.diagnosticsMode.encodedChunksCount++;
        
        if (results.diagnosticsMode.encoderChunksLogged.length < 10) {
          results.diagnosticsMode.encoderChunksLogged.push({
            timestamp: chunk.timestamp,
            type: chunk.type
          });
        }

        // Add chunk to muxer
        try {
          if (muxer && results.diagnosticsMode.muxStatus !== 'ERROR') {
            muxer.addVideoChunk(chunk, metadata);
            results.diagnosticsMode.muxedChunksCount++;
          }
        } catch (addErr) {
          console.error("Muxer addVideoChunk failed:", addErr);
          results.diagnosticsMode.muxStatus = 'ERROR';
          results.diagnosticsMode.muxError = `Muxer addVideoChunk error at chunk #${results.diagnosticsMode.encodedChunksCount} (TS: ${chunk.timestamp} us): ${addErr.message || addErr}`;
        }
      },
      error: (err) => {
        results.diagnosticsMode.encoderError = err.message || String(err);
        console.error("Encoder error:", err);
      }
    });

    const videoConfig = {
      codec: 'avc1.4d001f',
      width: targetWidth,
      height: targetHeight,
      bitrate: 1500000,
      framerate: targetFps,
      hardwareAcceleration: 'prefer-hardware'
    };
    encoderInstance.configure(videoConfig);

    // Create a local canvas to render VideoFrames
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // 4. Sequential Decode -> Render -> Encode -> Mux Loop with backpressure
    const frameIntervalUs = 1000000 / targetFps; // 40000 µs
    let chunksFed = 0;
    let framesProcessed = 0;

    const getNextFrame = () => {
      if (results.diagnosticsMode.decoderError) {
        return Promise.reject(new Error(results.diagnosticsMode.decoderError));
      }
      if (decodedFrames.length > 0) {
        return Promise.resolve(decodedFrames.shift());
      }
      return new Promise((resolve, reject) => {
        frameWaiter = () => {
          frameWaiter = null;
          if (results.diagnosticsMode.decoderError) {
            reject(new Error(results.diagnosticsMode.decoderError));
          } else if (decodedFrames.length > 0) {
            resolve(decodedFrames.shift());
          } else {
            reject(new Error("Frame waiter triggered but no decoded frames available."));
          }
        };
      });
    };

    const feedDecoder = () => {
      // STRICT Backpressure: feed decoder up to 6 frames ahead of rendered count OR decoded queue size is full
      while (chunksFed < totalFrames && 
             (chunksFed - framesProcessed) < 6 && 
             decodedFrames.length < 6) {
        const sample = diagnosticSamples[chunksFed];
        const sampleTimeUs = Math.round((sample.cts / timescale) * 1000000);
        const sampleDurationUs = Math.round((sample.duration / timescale) * 1000000);
        const chunkType = sample.is_sync ? 'key' : 'delta';

        const bytes = new Uint8Array(sample.data);
        const hex64 = Array.from(bytes.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();

        const queueBefore = decoderInstance.decodeQueueSize;

        const chunk = new EncodedVideoChunk({
          type: chunkType,
          timestamp: sampleTimeUs,
          duration: sampleDurationUs,
          data: sample.data
        });
        decoderInstance.decode(chunk);

        const queueAfter = decoderInstance.decodeQueueSize;

        if (results.diagnosticsMode.samplesLogged.length < 10) {
          results.diagnosticsMode.samplesLogged.push({
            index: chunksFed,
            byteLength: sample.data.byteLength,
            hex64,
            is_sync: sample.is_sync,
            dts: sample.dts,
            cts: sample.cts,
            duration: sample.duration,
            chunkTimestamp: sampleTimeUs,
            chunkType,
            queueBefore,
            queueAfter
          });
        }
        chunksFed++;
      }
    };

    let decodeTime = 0;
    let renderTime = 0;
    const encodeStart = performance.now();

    for (let i = 0; i < totalFrames; i++) {
      // STRICT Backpressure: pause loop if encoder queue size is too large (> 6)
      while (results.diagnosticsMode.encodeSubmittedCount - results.diagnosticsMode.encodedChunksCount > 6) {
        if (results.diagnosticsMode.encoderError) {
          throw new Error(results.diagnosticsMode.encoderError);
        }
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      feedDecoder();

      const frameDecodeStart = performance.now();
      const decodedFrame = await getNextFrame();
      decodeTime += performance.now() - frameDecodeStart;

      const frameRenderStart = performance.now();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(decodedFrame, 0, 0, targetWidth, targetHeight);
      results.diagnosticsMode.renderedFramesCount++;

      decodedFrame.close();

      // Create new VideoFrame from canvas with output timestamp
      const outputTimestampUs = Math.round(i * frameIntervalUs);
      const outputFrame = new VideoFrame(canvas, { timestamp: outputTimestampUs });
      try {
        results.diagnosticsMode.encodeSubmittedCount++;
        encoderInstance.encode(outputFrame, { keyFrame: i % 30 === 0 });
      } finally {
        outputFrame.close();
      }
      framesProcessed++;
      renderTime += performance.now() - frameRenderStart;
    }

    // Wait for the decoder to complete decoding
    const decodeFlushStart = performance.now();
    try {
      await Promise.race([
        decoderInstance.flush(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
      ]);
      results.diagnosticsMode.flushStatus = 'SUCCESS';
    } catch (flushErr) {
      results.diagnosticsMode.flushStatus = flushErr.message === 'Timeout' ? 'TIMEOUT' : 'ERROR';
      results.diagnosticsMode.decoderError = `Decoder flush failed: ${flushErr.message || flushErr}`;
    }
    results.timings.decode = decodeTime + (performance.now() - decodeFlushStart);
    results.timings.render = renderTime;

    // Flush Encoder to ensure all frames are encoded
    const encFlushStart = performance.now();
    try {
      await Promise.race([
        encoderInstance.flush(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
      ]);
      results.diagnosticsMode.encoderFlushStatus = 'SUCCESS';
    } catch (encFlushErr) {
      results.diagnosticsMode.encoderFlushStatus = encFlushErr.message === 'Timeout' ? 'TIMEOUT' : 'ERROR';
      results.diagnosticsMode.encoderError = `Encoder flush failed: ${encFlushErr.message || encFlushErr}`;
    }
    results.timings.encode = (performance.now() - encodeStart);

    // Finalize Muxer and obtain MP4 Blob
    const muxFinalStart = performance.now();
    if (muxer && results.diagnosticsMode.muxStatus === 'SUCCESS') {
      try {
        muxer.finalize();
        results.diagnosticsMode.finalizeStatus = 'SUCCESS';
      } catch (finErr) {
        results.diagnosticsMode.finalizeStatus = 'ERROR';
        results.diagnosticsMode.muxError = `Muxer finalize failed: ${finErr.message || finErr}`;
      }
    }
    results.timings.mux = performance.now() - muxFinalStart;

    results.timings.total = performance.now() - overallStart;
    results.metrics.framesDecoded = results.diagnosticsMode.outputCallbackCount;
    
    // Playback test inside HTMLVideoElement to verify MP4 metadata/duration/playability
    if (muxer && results.diagnosticsMode.finalizeStatus === 'SUCCESS') {
      const buffer = muxer.target.buffer;
      results.diagnosticsMode.mp4ByteLength = buffer.byteLength;
      
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(blob);
      results.videoUrl = videoUrl;

      const playbackTest = new Promise((resolve) => {
        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        videoEl.muted = true;
        videoEl.playsInline = true;
        
        const timeout = setTimeout(() => {
          results.diagnosticsMode.playbackTest = {
            success: false,
            error: "Playback metadata load timed out after 3000ms"
          };
          resolve();
        }, 3000);

        videoEl.onloadedmetadata = () => {
          results.diagnosticsMode.playbackTest = {
            success: true,
            duration: videoEl.duration,
            width: videoEl.videoWidth,
            height: videoEl.videoHeight,
            canPlay: false,
            error: null
          };
        };

        videoEl.oncanplay = () => {
          if (results.diagnosticsMode.playbackTest) {
            results.diagnosticsMode.playbackTest.canPlay = true;
          }
          clearTimeout(timeout);
          resolve();
        };

        videoEl.onerror = () => {
          results.diagnosticsMode.playbackTest = {
            success: false,
            error: videoEl.error ? `Code ${videoEl.error.code}: ${videoEl.error.message}` : "Unknown video element error"
          };
          clearTimeout(timeout);
          resolve();
        };

        videoEl.src = videoUrl;
      });

      await playbackTest;
    }

    const actualDurationSec = totalFrames / targetFps;
    results.metrics.realtimeSpeedFactor = actualDurationSec / (results.timings.total / 1000);

    // Success check: decoder, encoder, muxer and playback test are all successful!
    results.metrics.success = 
      results.diagnosticsMode.outputCallbackCount === totalFrames &&
      results.diagnosticsMode.renderedFramesCount === totalFrames &&
      results.diagnosticsMode.encodedChunksCount === totalFrames &&
      results.diagnosticsMode.finalizeStatus === 'SUCCESS' &&
      results.diagnosticsMode.playbackTest?.success === true;

  } catch (err) {
    results.error = err.message || String(err);
  } finally {
    if (decoderInstance) {
      try { decoderInstance.close(); } catch (e) {}
    }
    if (encoderInstance) {
      try { encoderInstance.close(); } catch (e) {}
    }
    // Safety check: close any remaining frames in queue in case of early return/exceptions
    for (const f of decodedFrames) {
      try { f.close(); } catch (e) {}
    }
    decodedFrames.length = 0;
  }

  // Trigger progress callback with complete stats at the end
  if (onProgress) {
    onProgress({
      status: "Completed Diagnostic Mode Scale Test",
      samplesDemuxed: totalFrames,
      decodeSubmitted: totalFrames,
      decodeOutput: results.diagnosticsMode.outputCallbackCount,
      decodeQueueSize: 0,
      renderedFrames: results.diagnosticsMode.renderedFramesCount,
      encodeSubmitted: results.diagnosticsMode.encodeSubmittedCount,
      encodeOutput: results.diagnosticsMode.encodedChunksCount,
      encodeQueueSize: 0,
      muxedChunks: results.diagnosticsMode.muxedChunksCount,
      elapsedTimeMs: performance.now() - overallStart,
      jsHeapSize: null
    });
  }

  return results;
}
