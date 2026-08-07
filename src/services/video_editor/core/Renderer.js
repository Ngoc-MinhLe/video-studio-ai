/**
 * Renderer base interface - Defines the rendering contract for video, audio, and visualizer elements.
 * This class is designed to be subclassed by specific rendering engines (e.g. Canvas2DRenderer, WebGL2Renderer).
 */
export class Renderer {
  constructor(canvas) {
    if (!canvas) {
      throw new Error('Renderer requires an HTMLCanvasElement instance.');
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Set target rendering resolution
   */
  setSize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Clear the rendering viewport
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render background image with specific configurations (mirror blur, cover/contain, offset)
   */
  drawBackground(bgImgEl, options) {
    throw new Error('drawBackground must be implemented by subclasses.');
  }

  /**
   * Render visualizer layers (sine wave, vinyl disc, bars, ring)
   */
  drawVisualizers(activeVisualizers, options, projectTime) {
    throw new Error('drawVisualizers must be implemented by subclasses.');
  }

  /**
   * Render a frame from an active HTML5 Video Element
   */
  drawVideoFrame(videoEl, options) {
    throw new Error('drawVideoFrame must be implemented by subclasses.');
  }

  /**
   * Render active subtitle lines
   */
  drawSubtitles(subtitles, projectTime, subOptions) {
    throw new Error('drawSubtitles must be implemented by subclasses.');
  }
}
