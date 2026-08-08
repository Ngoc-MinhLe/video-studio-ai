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
 * Diagnostic Mode: Sequential execution to prevent deadlocks.
 * - Demuxes all H.264 samples using MP4Box.
 * - Feeds all requested samples directly to VideoDecoder without waiting in a loop.
 * - Calls decoder.flush() to output all frames.
 * - Renders each decoded VideoFrame to Canvas sequentially.
 * - Encodes each frame using VideoEncoder.
 * - Calls encoder.flush().
 * - Muxes chunks using mp4-muxer.
 * - Performs playback verification inside an HTMLVideoElement.
 * 
 * @param {File} file The real uploaded video file.
 * @param {number} frameLimit Limit the number of samples to process.
 * @param {Function} onProgress Progress callback.
 * @returns {Promise<Object>} The diagnostic results.
 */
export function runWebCodecsVideoFilePoC(file, frameLimit = 25, onProgress) {
  return new Promise(async (resolve, reject) => {
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
        playbackTest: null,
        stallDump: null
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
    let pipelineError = null;

    // Instrumentation State Tracing variables
    let samplesDemuxedCount = 0;
    let decodeSubmittedCount = 0;
    let framesDecodedCount = 0;
    let renderedCount = 0;
    let encodeSubmittedCount = 0;
    let framesEncodedCount = 0;
    let muxedCount = 0;
    let chunksFed = 0;
    let framesProcessed = 0;

    let pipelineState = "DEMUX";
    let waitingFor = "none";

    const updateProgress = () => {
      if (onProgress) {
        onProgress({
          status: `STATE: ${pipelineState} | Processing ${framesProcessed}/${frameLimit}`,
          samplesDemuxed: samplesDemuxedCount,
          decodeSubmitted: decodeSubmittedCount,
          decodeOutput: framesDecodedCount,
          decodeQueueSize: decodedFrames.length,
          renderedFrames: renderedCount,
          encodeSubmitted: encodeSubmittedCount,
          encodeOutput: framesEncodedCount,
          encodeQueueSize: encodeSubmittedCount - framesEncodedCount,
          muxedChunks: muxedCount,
          elapsedTimeMs: performance.now() - overallStart,
          jsHeapSize: null
        });
      }
    };

    // Heartbeat log and Stall detector (3 seconds limit)
    let lastSamplesDemuxed = 0;
    let lastDecodeOutput = 0;
    let lastRendered = 0;
    let lastEncodeOutput = 0;
    let lastMuxed = 0;
    let stallIntervalCount = 0;

    const heartbeatInterval = setInterval(() => {
      const elapsed = Math.round(performance.now() - overallStart);
      const decQueueSize = decoderInstance ? decoderInstance.decodeQueueSize : 0;
      const encQueueSize = encodeSubmittedCount - framesEncodedCount;

      console.log(`PIPELINE: demuxed=${samplesDemuxedCount} decodeSubmitted=${decodeSubmittedCount} decodeOutput=${framesDecodedCount} decodedFramesQueue=${decodedFrames.length} renderedFrames=${renderedCount} encodeSubmitted=${encodeSubmittedCount} encodeOutput=${framesEncodedCount} muxedChunks=${muxedCount} decoderQueueSize=${decQueueSize} encoderQueueSize=${encQueueSize} currentFrameIndex=${framesProcessed} nextSampleIndex=${chunksFed} elapsedMs=${elapsed} STATE=${pipelineState}`);

      const hasChanged = 
        samplesDemuxedCount !== lastSamplesDemuxed ||
        framesDecodedCount !== lastDecodeOutput ||
        renderedCount !== lastRendered ||
        framesEncodedCount !== lastEncodeOutput ||
        muxedCount !== lastMuxed;

      if (hasChanged) {
        lastSamplesDemuxed = samplesDemuxedCount;
        lastDecodeOutput = framesDecodedCount;
        lastRendered = renderedCount;
        lastEncodeOutput = framesEncodedCount;
        lastMuxed = muxedCount;
        stallIntervalCount = 0;
      } else {
        stallIntervalCount++;
        if (stallIntervalCount >= 6) { // 6 * 500ms = 3000ms (3 seconds)
          pipelineError = `PIPELINE STALLED AT: ${pipelineState} (waiting for: ${waitingFor})`;
          console.error(`PoC Stalled: ${pipelineError}`);
          
          results.diagnosticsMode.stallDump = {
            currentFrameIndex: framesProcessed,
            nextSampleIndex: chunksFed,
            demuxed: samplesDemuxedCount,
            decodeSubmitted: decodeSubmittedCount,
            decodeOutput: framesDecodedCount,
            decodedFramesQueue: decodedFrames.length,
            renderedFrames: renderedCount,
            encodeSubmitted: encodeSubmittedCount,
            encodeOutput: framesEncodedCount,
            muxedChunks: muxedCount,
            decoderQueueSize: decQueueSize,
            encoderQueueSize: encQueueSize,
            state: pipelineState,
            waitingFor: waitingFor
          };
          
          results.error = pipelineError;
          clearInterval(heartbeatInterval);
          
          // Cleanup GPU resources
          if (decoderInstance) { try { decoderInstance.close(); } catch(e){} }
          if (encoderInstance) { try { encoderInstance.close(); } catch(e){} }
          for (const f of decodedFrames) { try { f.close(); } catch(e){} }
          decodedFrames.length = 0;
          
          resolve(results); // Resolve early with stall dump to avoid hanging
        }
      }
      updateProgress();
    }, 500);

    try {
      // 1. Demux samples with mp4box.js
      pipelineState = "DEMUX";
      waitingFor = "mp4box parsing samples";
      const demuxStart = performance.now();
      const mp4boxFile = MP4Box.createFile();
      
      let videoTrack = null;
      let descriptionBytes = null;
      let targetCodecString = 'unknown';
      const samples = [];
      
      const demuxPromise = new Promise((resolveDemux, rejectDemux) => {
        mp4boxFile.onReady = (info) => {
          videoTrack = info.videoTracks[0];
          if (!videoTrack) {
            rejectDemux(new Error("No video track found in the uploaded file."));
            return;
          }
          
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

                      try {
                        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
                        avcC.write(stream);
                        const rawBox = new Uint8Array(stream.buffer);
                        if (rawBox.length > 8) {
                          descriptionBytes = rawBox.slice(8);
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
            rejectDemux(new Error(`PoC only supports H.264 (avc1) files. Found codec: ${videoTrack.codec}`));
            return;
          }

          mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 10000 });
          mp4boxFile.start();
        };
        
        mp4boxFile.onSamples = (track_id, ref, extractedSamples) => {
          samples.push(...extractedSamples);
          samplesDemuxedCount = samples.length;
          results.meta.totalSamplesInFile = samples.length;
          updateProgress();
          
          if (samples.length >= videoTrack.nb_samples) {
            mp4boxFile.stop();
            resolveDemux();
          }
        };
        
        mp4boxFile.onError = (err) => {
          rejectDemux(new Error("MP4Box parsing error: " + err));
        };
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const arrayBuffer = e.target.result;
          arrayBuffer.fileStart = 0;
          try {
            mp4boxFile.appendBuffer(arrayBuffer);
            mp4boxFile.flush();
          } catch (err) {
            rejectDemux(err);
          }
        };
        reader.onerror = () => rejectDemux(reader.error);
        reader.readAsArrayBuffer(file);
      });

      await demuxPromise;
      results.timings.demux = performance.now() - demuxStart;

      const firstKeyframeIndex = samples.findIndex(s => s.is_sync);
      if (firstKeyframeIndex === -1) {
        throw new Error("No sync frame (keyframe) found in the video track. Cannot decode.");
      }
      
      const availableSamples = samples.slice(firstKeyframeIndex);
      const totalFrames = Math.min(availableSamples.length, frameLimit);
      results.meta.testLimitFramesCount = totalFrames;

      const diagnosticSamples = availableSamples.slice(0, totalFrames);
      const timescale = videoTrack.timescale;
      const trackWidth = results.meta.width;
      const trackHeight = results.meta.height;

      if (!descriptionBytes || descriptionBytes.byteLength === 0) {
        throw new Error("AVCDecoderConfigurationRecord (avcC) is missing or empty. Cannot configure VideoDecoder.");
      }

      // 2. Setup VideoDecoder (FROZEN decoder callbacks and config)
      decoderInstance = new VideoDecoder({
        output: (frame) => {
          try {
            results.diagnosticsMode.outputCallbackCount++;
            framesDecodedCount++;
            
            if (results.diagnosticsMode.outputFramesLog.length < 10) {
              results.diagnosticsMode.outputFramesLog.push({
                timestamp: frame.timestamp,
                width: frame.codedWidth,
                height: frame.codedHeight
              });
            }
            
            decodedFrames.push(frame);
            results.diagnosticsMode.decodedFramesCount = decodedFrames.length;
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

      // 3. Feed all samples sequentially into decoder without blocking
      pipelineState = "DECODING";
      waitingFor = "Feeding all EncodedVideoChunks to VideoDecoder";
      console.log(`Feeding all ${totalFrames} samples to VideoDecoder...`);

      for (let idx = 0; idx < totalFrames; idx++) {
        if (pipelineError) throw new Error(pipelineError);
        
        const sample = diagnosticSamples[idx];
        const sampleTimeUs = Math.round((sample.cts / timescale) * 1000000);
        const sampleDurationUs = Math.round((sample.duration / timescale) * 1000000);
        const chunkType = sample.is_sync ? 'key' : 'delta';

        const chunk = new EncodedVideoChunk({
          type: chunkType,
          timestamp: sampleTimeUs,
          duration: sampleDurationUs,
          data: sample.data
        });
        decoderInstance.decode(chunk);
        decodeSubmittedCount++;
        chunksFed++;

        if (results.diagnosticsMode.samplesLogged.length < 10) {
          results.diagnosticsMode.samplesLogged.push({
            index: idx,
            byteLength: sample.data.byteLength,
            is_sync: sample.is_sync,
            chunkTimestamp: sampleTimeUs,
            chunkType
          });
        }
      }

      // Flush decoder sequentially (NO Promise.race to swallow stalls)
      pipelineState = "FLUSHING";
      waitingFor = "decoderInstance.flush()";
      console.log("WAIT START: decoderInstance.flush()");
      const decodeFlushStart = performance.now();
      await decoderInstance.flush();
      console.log("WAIT END: decoderInstance.flush()");
      results.diagnosticsMode.flushStatus = 'SUCCESS';
      results.timings.decode = performance.now() - decodeFlushStart;

      console.log(`Decoder flush completed. Decoded frames count: ${decodedFrames.length} / ${totalFrames}`);

      // 4. Setup Muxer & VideoEncoder
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
          framesEncodedCount++;
          
          if (results.diagnosticsMode.encoderChunksLogged.length < 10) {
            results.diagnosticsMode.encoderChunksLogged.push({
              timestamp: chunk.timestamp,
              type: chunk.type
            });
          }

          try {
            if (muxer && results.diagnosticsMode.muxStatus !== 'ERROR') {
              muxer.addVideoChunk(chunk, metadata);
              results.diagnosticsMode.muxedChunksCount++;
              muxedCount++;
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

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      // 5. Render Canvas & Encode exactly the decoded frames sequentially
      pipelineState = "ENCODING";
      waitingFor = "Rendering and submitting all VideoFrames to VideoEncoder";
      const frameIntervalUs = 1000000 / targetFps; // 40000 µs
      const renderStart = performance.now();
      const encodeStart = performance.now();

      for (let i = 0; i < decodedFrames.length; i++) {
        if (pipelineError) throw new Error(pipelineError);

        const decodedFrame = decodedFrames[i];
        try {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(decodedFrame, 0, 0, targetWidth, targetHeight);
          results.diagnosticsMode.renderedFramesCount++;
          renderedCount++;

          const outputTimestampUs = Math.round(i * frameIntervalUs);
          const outputFrame = new VideoFrame(canvas, { timestamp: outputTimestampUs });
          try {
            results.diagnosticsMode.encodeSubmittedCount++;
            encodeSubmittedCount++;
            encoderInstance.encode(outputFrame, { keyFrame: i % 30 === 0 });
          } finally {
            outputFrame.close();
          }
        } finally {
          decodedFrame.close();
        }
        framesProcessed++;
      }
      decodedFrames.length = 0; // Clear array
      results.timings.render = performance.now() - renderStart;

      // Flush Encoder
      pipelineState = "FLUSHING";
      waitingFor = "encoderInstance.flush()";
      console.log("WAIT START: encoderInstance.flush()");
      await encoderInstance.flush();
      console.log("WAIT END: encoderInstance.flush()");
      results.diagnosticsMode.encoderFlushStatus = 'SUCCESS';
      results.timings.encode = (performance.now() - encodeStart);

      // 6. Finalize Muxer and obtain MP4 Blob
      pipelineState = "MUXING";
      waitingFor = "muxer.finalize()";
      const muxFinalStart = performance.now();
      if (muxer && results.diagnosticsMode.muxStatus === 'SUCCESS') {
        muxer.finalize();
        results.diagnosticsMode.finalizeStatus = 'SUCCESS';
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

        const playbackTest = new Promise((resolvePlay) => {
          const videoEl = document.createElement('video');
          videoEl.preload = 'metadata';
          videoEl.muted = true;
          videoEl.playsInline = true;
          
          const timeout = setTimeout(() => {
            results.diagnosticsMode.playbackTest = {
              success: false,
              error: "Playback metadata load timed out after 3000ms"
            };
            resolvePlay();
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
            resolvePlay();
          };

          videoEl.onerror = () => {
            results.diagnosticsMode.playbackTest = {
              success: false,
              error: videoEl.error ? `Code ${videoEl.error.code}: ${videoEl.error.message}` : "Unknown video element error"
            };
            clearTimeout(timeout);
            resolvePlay();
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

      pipelineState = "DONE";
      waitingFor = "none";
      clearInterval(heartbeatInterval);
      resolve(results);

    } catch (err) {
      pipelineState = "ERROR";
      waitingFor = "none";
      results.error = err.message || String(err);
      clearInterval(heartbeatInterval);
      
      if (decoderInstance) { try { decoderInstance.close(); } catch (e) {} }
      if (encoderInstance) { try { encoderInstance.close(); } catch (e) {} }
      for (const f of decodedFrames) { try { f.close(); } catch (e) {} }
      decodedFrames.length = 0;
      
      resolve(results);
    }
  });
}
