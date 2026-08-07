import { Renderer } from '../core/Renderer';

export class Canvas2DRenderer extends Renderer {
  constructor(canvas) {
    super(canvas);
    this.subtitleCache = new Map(); // sub.id -> { canvas, width, height, hash }
    this.gradientCache = new Map(); // key -> CanvasGradient
  }

  /**
   * Render background image with specific configurations (mirror blur, cover/contain, offset)
   */
  drawBackground(bgImgEl, bgMirrorBlur, bgFit, bgZoom, bgOffsetX, bgOffsetY, bgEffect, zoomSpeed, zoomRange, totalScale, canvasW, canvasH) {
    if (bgImgEl) {
      // A. Lớp Lấp Đầy Gương Kính Phủ Mờ Lề Dư (Blurred Mirror Fill)
      if (bgMirrorBlur) {
        this.ctx.save();
        this.ctx.fillStyle = '#090b10';
        this.ctx.fillRect(0, 0, canvasW, canvasH);

        this.ctx.filter = 'blur(25px)';
        const blurW = canvasW * 1.3;
        const blurH = canvasH * 1.3;
        const blurX = (canvasW - blurW) / 2;
        const blurY = (canvasH - blurH) / 2;
        this.ctx.globalAlpha = 0.8;
        this.ctx.drawImage(bgImgEl, blurX, blurY, blurW, blurH);
        this.ctx.restore();
      } else {
        this.ctx.fillStyle = '#090b10';
        this.ctx.fillRect(0, 0, canvasW, canvasH);
      }

      const imgW = bgImgEl.naturalWidth || bgImgEl.width || 1;
      const imgH = bgImgEl.naturalHeight || bgImgEl.height || 1;
      const imgRatio = imgW / imgH;
      const canvasRatio = canvasW / canvasH;

      let baseW, baseH;
      if (bgFit === 'contain') {
        if (imgRatio > canvasRatio) {
          baseW = canvasW;
          baseH = canvasW / imgRatio;
        } else {
          baseH = canvasH;
          baseW = canvasH * imgRatio;
        }
      } else {
        // 'cover'
        if (imgRatio > canvasRatio) {
          baseH = canvasH;
          baseW = canvasH * imgRatio;
        } else {
          baseW = canvasW;
          baseH = canvasW / imgRatio;
        }
      }

      const drawW = baseW * totalScale;
      const drawH = baseH * totalScale;

      const shiftX = (canvasW * (bgOffsetX || 0)) / 100;
      const shiftY = (canvasH * (bgOffsetY || 0)) / 100;

      // Nhân dịch chuyển với (2 - totalScale) để trùng khớp 100% với CSS transform-origin và scale của Live Preview
      const drawX = ((canvasW - drawW) / 2) + shiftX * (2 - totalScale);
      const drawY = ((canvasH - drawH) / 2) + shiftY * (2 - totalScale);

      this.ctx.drawImage(bgImgEl, drawX, drawY, drawW, drawH);
    } else {
      this.ctx.fillStyle = '#090b10';
      this.ctx.fillRect(0, 0, canvasW, canvasH);
    }
  }

  /**
   * Render visualizer layers (sine wave, vinyl disc, bars, ring)
   */
  drawVisualizers(activeVisualizers, options, projectTime, bgImgEl, canvasW, canvasH) {
    const {
      sinePosX = 50, sinePosY = 50,
      vinylPosX = 50, vinylPosY = 50,
      barsPosX = 50, barsPosY = 75,
      ringPosX = 50, ringPosY = 50
    } = options;

    const vizList = Array.isArray(activeVisualizers) ? activeVisualizers : ['sinewave'];

    vizList.forEach((vType) => {
      if (vType === 'sinewave') {
        this.ctx.save();
        const vY = (canvasH * (sinePosY !== undefined ? sinePosY : 50)) / 100;
        const vX = (canvasW * (sinePosX !== undefined ? sinePosX : 50)) / 100;
        const shiftX = vX - (canvasW / 2);
        const scaleF = canvasH / 720;
        const amp = Math.sin(projectTime * 6) * (45 * scaleF) + (15 * scaleF);

        this.ctx.shadowColor = '#ec4899';
        this.ctx.shadowBlur = 24 * scaleF;

        // Caching gradient đối tượng để tránh tạo lại mỗi frame
        const gradKey = `sine_${shiftX}_${canvasW}`;
        let grad = this.gradientCache.get(gradKey);
        if (!grad) {
          grad = this.ctx.createLinearGradient(shiftX, 0, canvasW + shiftX, 0);
          grad.addColorStop(0, '#ec4899');
          grad.addColorStop(0.4, '#a855f7');
          grad.addColorStop(0.7, '#3b82f6');
          grad.addColorStop(1, '#06b6d4');
          this.gradientCache.set(gradKey, grad);
        }

        // Upper Wide Glow Curve
        this.ctx.beginPath();
        this.ctx.moveTo(shiftX, vY);
        this.ctx.bezierCurveTo(canvasW * 0.25 + shiftX, vY - amp, canvasW * 0.75 + shiftX, vY + amp, canvasW + shiftX, vY);
        this.ctx.strokeStyle = grad;
        this.ctx.lineWidth = 7 * scaleF;
        this.ctx.stroke();

        // Lower Symmetric Wave
        this.ctx.beginPath();
        this.ctx.moveTo(shiftX, vY);
        this.ctx.bezierCurveTo(canvasW * 0.25 + shiftX, vY + amp, canvasW * 0.75 + shiftX, vY - amp, canvasW + shiftX, vY);
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 3.5 * scaleF;
        this.ctx.stroke();

        // Particle Dots along wave
        const dotPositions = [0.1, 0.3, 0.5, 0.7, 0.9];
        dotPositions.forEach((pos, idx) => {
          const px = canvasW * pos + shiftX;
          const py = vY + Math.sin(projectTime * 6 + idx) * amp;
          const r = (4 + Math.abs(Math.sin(projectTime * 8 + idx)) * 3) * scaleF;

          this.ctx.fillStyle = '#f472b6';
          this.ctx.shadowColor = '#f472b6';
          this.ctx.shadowBlur = 12 * scaleF;
          this.ctx.beginPath();
          this.ctx.arc(px, py, r, 0, Math.PI * 2);
          this.ctx.fill();
        });

        this.ctx.restore();
      } else if (vType === 'vinyl') {
        this.ctx.save();
        const centerX = (canvasW * (vinylPosX !== undefined ? vinylPosX : 50)) / 100;
        const centerY = (canvasH * (vinylPosY !== undefined ? vinylPosY : 50)) / 100;
        const radius = Math.min(canvasW, canvasH) * 0.22;
        const scaleF = canvasH / 720;

        this.ctx.translate(centerX, centerY);
        const angle = (projectTime * 120 * Math.PI) / 180;
        this.ctx.rotate(angle);

        // Outer Glow
        this.ctx.shadowColor = '#a855f7';
        this.ctx.shadowBlur = 35 * scaleF;

        // Outer Vinyl Black Disc
        this.ctx.fillStyle = '#0c0d12';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 4 * scaleF;
        this.ctx.stroke();

        // Vinyl Grooves
        for (let r = radius * 0.45; r < radius * 0.95; r += 10 * scaleF) {
          this.ctx.beginPath();
          this.ctx.arc(0, 0, r, 0, Math.PI * 2);
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          this.ctx.lineWidth = 1.5 * scaleF;
          this.ctx.stroke();
        }

        // Center Album Artwork Badge
        if (bgImgEl) {
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
          this.ctx.clip();
          this.ctx.drawImage(bgImgEl, -radius * 0.4, -radius * 0.4, radius * 0.8, radius * 0.8);
          this.ctx.restore();
        }

        // Center Spindle Hole
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius * 0.06, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
      } else if (vType === 'bars') {
        this.ctx.save();
        const barCount = 24;
        const barWidth = (canvasW * 0.65) / barCount;
        const centerX = (canvasW * (barsPosX !== undefined ? barsPosX : 50)) / 100;
        const startX = centerX - (barCount * barWidth) / 2;
        const vY = (canvasH * (barsPosY !== undefined ? barsPosY : 75)) / 100;
        const scaleF = canvasH / 720;

        for (let b = 0; b < barCount; b++) {
          const barHeight = Math.abs(Math.sin(projectTime * 5 + b * 0.4)) * (canvasH * 0.16) + (canvasH * 0.02);
          const bx = startX + b * barWidth;
          const by = vY - barHeight / 2;

          // Caching gradient của từng bar
          const gradKey = `bar_${b}_${bx}_${vY}`;
          let grad = this.gradientCache.get(gradKey);
          if (!grad) {
            grad = this.ctx.createLinearGradient(bx, vY + (canvasH * 0.09), bx, vY - (canvasH * 0.09));
            grad.addColorStop(0, '#ec4899');
            grad.addColorStop(0.5, '#a855f7');
            grad.addColorStop(1, '#06b6d4');
            this.gradientCache.set(gradKey, grad);
          }

          this.ctx.fillStyle = grad;
          this.ctx.fillRect(bx + 2 * scaleF, by, barWidth - 4 * scaleF, barHeight);

          // Bouncing peak indicator dot
          this.ctx.fillStyle = '#67e8f9';
          this.ctx.shadowColor = '#06b6d4';
          this.ctx.shadowBlur = 10 * scaleF;
          this.ctx.fillRect(bx + 2 * scaleF, by - 6 * scaleF, barWidth - 4 * scaleF, 3 * scaleF);
        }
        this.ctx.restore();
      } else if (vType === 'ring') {
        this.ctx.save();
        const centerX = (canvasW * (ringPosX !== undefined ? ringPosX : 50)) / 100;
        const centerY = (canvasH * (ringPosY !== undefined ? ringPosY : 50)) / 100;
        const scaleF = canvasH / 720;
        const baseRadius = Math.min(canvasW, canvasH) * 0.22;
        const pulseRadius = baseRadius + Math.abs(Math.sin(projectTime * 6)) * (baseRadius * 0.18);

        this.ctx.strokeStyle = '#ec4899';
        this.ctx.shadowColor = '#ec4899';
        this.ctx.shadowBlur = 35 * scaleF;
        this.ctx.lineWidth = 6 * scaleF;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Outer dashed Cyber ring
        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(projectTime * 0.8);
        this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
        this.ctx.setLineDash([12 * scaleF, 8 * scaleF]);
        this.ctx.lineWidth = 3 * scaleF;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, baseRadius * 1.3, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();

        this.ctx.restore();
      }
    });
  }

  /**
   * Render a frame from an active HTML5 Video Element
   */
  drawVideoFrame(videoEl, canvasW, canvasH) {
    const vW = videoEl.videoWidth || 1280;
    const vH = videoEl.videoHeight || 720;
    const srcR = vW / vH;
    const targetR = canvasW / canvasH;

    let dW = canvasW;
    let dH = canvasH;
    let dX = 0;
    let dY = 0;

    if (srcR > targetR) {
      dW = canvasW;
      dH = canvasW / srcR;
      dY = (canvasH - dH) / 2;
    } else {
      dH = canvasH;
      dW = canvasH * srcR;
      dX = (canvasW - dW) / 2;
    }

    this.ctx.drawImage(videoEl, dX, dY, dW, dH);
  }

  /**
   * Render active subtitle lines with OffscreenCanvas caching
   */
  drawSubtitles(subtitles, projectTime, subOptions, canvasW, canvasH) {
    const validSubs = subtitles || [];
    const activeSubs = validSubs.filter(
      s => s.text && s.text.trim() !== '' && projectTime >= Number(s.startTime) && projectTime <= Number(s.endTime)
    );

    if (!activeSubs || activeSubs.length === 0) return;

    const scaleFactor = canvasH / 720;

    activeSubs.forEach((sub) => {
      const text = sub.text.trim();
      const baseFontSize = Math.max(16, Math.round(((sub.fontSize !== undefined ? sub.fontSize : subOptions.fontSize) || 24) * scaleFactor));
      const style = sub.style || subOptions.subStyle || 'tiktok';
      const anim = sub.anim || subOptions.subAnimation || 'bounce';
      const rotationDeg = sub.rotation !== undefined ? sub.rotation : (subOptions.subRotation || 0);
      const customColor = sub.color || subOptions.subColor || '#ffffff';
      const customBgColor = sub.bgColor || subOptions.subBgColor || '#000000';
      const animSpeed = sub.animSpeed !== undefined ? sub.animSpeed : (subOptions.subAnimSpeed || 1.0);
      const posX = sub.x !== undefined ? sub.x : (subOptions.subX !== undefined ? subOptions.subX : 50);
      const posY = sub.y !== undefined ? sub.y : (subOptions.subY !== undefined ? subOptions.subY : 85);
      const boxWPercent = sub.boxWidth !== undefined ? sub.boxWidth : (subOptions.subBoxWidth || 80);

      // 1. Tính toán tiến trình hiệu ứng hoạt cảnh
      const elapsed = projectTime - Number(sub.startTime);
      let animScale = 1.0;
      let animAlpha = 1.0;
      let animOffsetY = 0;
      let animShakeX = 0;
      let animShakeY = 0;
      let displayText = text;

      if (anim === 'typewriter') {
        const words = text.split(' ');
        const subDuration = (Number(sub.endTime) - Number(sub.startTime)) || 3;
        const revealProgress = Math.min(1, Math.max(0, (elapsed * animSpeed) / subDuration));
        const visibleWordCount = Math.max(1, Math.ceil(revealProgress * words.length));
        displayText = words.slice(0, visibleWordCount).join(' ');
      } else if (anim === 'marquee') {
        const subDuration = (Number(sub.endTime) - Number(sub.startTime)) || 3;
        const progress = Math.min(1, Math.max(0, (elapsed * animSpeed) / subDuration));
        animShakeX = (0.5 - progress) * (canvasW * 1.4);
      } else if (anim === 'bounce') {
        const dur = 0.35 / animSpeed;
        if (elapsed < dur) {
          const progress = elapsed / dur;
          animScale = 0.5 + Math.sin(progress * Math.PI) * 0.75;
        }
      } else if (anim === 'fade') {
        const dur = 0.3 / animSpeed;
        if (elapsed < dur) {
          const progress = elapsed / dur;
          animAlpha = Math.min(1, Math.max(0, progress));
          animOffsetY = (1 - progress) * (20 * scaleFactor);
        }
      } else if (anim === 'pulse') {
        animScale = 1.0 + Math.sin(elapsed * 4 * animSpeed) * 0.05;
      } else if (anim === 'shake') {
        animShakeX = (Math.random() - 0.5) * (6 * scaleFactor * animSpeed);
        animShakeY = (Math.random() - 0.5) * (6 * scaleFactor * animSpeed);
        animScale = 1.0 + Math.sin(elapsed * 8 * animSpeed) * 0.03;
      }

      // Tạo Cache Key dựa trên các thuộc tính của Subtitle
      const isMarqueeMode = anim === 'marquee' || style === 'led';
      const cacheKey = `${sub.id}_${displayText}_${baseFontSize}_${customColor}_${customBgColor}_${style}_${boxWPercent}`;

      let cached = this.subtitleCache.get(sub.id);
      
      // Nếu là chạy chữ LED Marquee thì không dùng cache tĩnh do text liên tục cuộn dịch chuyển
      const useCache = !isMarqueeMode;

      if (useCache) {
        if (!cached || cached.hash !== cacheKey) {
          cached = this._renderSubtitleToCache(displayText, baseFontSize, style, customColor, customBgColor, scaleFactor, canvasW, boxWPercent, cacheKey);
          this.subtitleCache.set(sub.id, cached);
        }
      }

      this.ctx.save();
      this.ctx.globalAlpha = animAlpha;

      let x = canvasW * (posX / 100) + animShakeX;
      let y = canvasH * (posY / 100) - animOffsetY + animShakeY;

      this.ctx.translate(x, y);
      if (rotationDeg !== 0) {
        this.ctx.rotate((rotationDeg * Math.PI) / 180);
      }

      if (useCache) {
        const { canvas: subCanvas, width: boxWidth, height: boxHeight } = cached;
        
        let boxX = - (boxWidth / 2);
        let boxY = - (boxHeight / 2);

        if (posX >= 75) {
          boxX = - boxWidth;
        } else if (posX <= 25) {
          boxX = 0;
        }

        if (posY >= 75) {
          boxY = - boxHeight;
        } else if (posY <= 25) {
          boxY = 0;
        }

        // Vẽ bộ đệm Offscreen Canvas với biên bù 20px phòng ngừa bị cắt shadowBlur
        this.ctx.drawImage(subCanvas, boxX - 20 * animScale, boxY - 20 * animScale, subCanvas.width * animScale, subCanvas.height * animScale);
      } else {
        // Vẽ trực tiếp không cache (chỉ dành cho chế độ LED marquee cuộn dịch chuyển)
        this._renderDirectSubtitle(displayText, baseFontSize, style, animSpeed, elapsed, scaleFactor, canvasW, boxWPercent, posX, posY);
      }

      this.ctx.restore();
    });
  }

  /**
   * Tạo tệp cache Offscreen Canvas cho phụ đề tĩnh
   */
  _renderSubtitleToCache(text, fontSize, style, color, bgColor, scaleFactor, canvasW, boxWPercent, hash) {
    const tempCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1, 1)
      : document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.font = `800 ${fontSize}px "Plus Jakarta Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    const metrics = tempCtx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.35;

    const boxWidth = Math.ceil(textWidth + (fontSize * 1.0));
    const boxHeight = Math.ceil(textHeight + (fontSize * 0.6));

    // Thêm biên bù 40px tránh shadow mờ biên bị cắt
    tempCanvas.width = boxWidth + 40;
    tempCanvas.height = boxHeight + 40;

    tempCtx.save();
    tempCtx.translate(20, 20); // Dịch chuyển vẽ vào vùng an toàn

    const boxX = 0;
    const boxY = 0;
    const textX = boxWidth / 2;
    const textY = boxHeight / 2;

    tempCtx.font = `800 ${fontSize}px "Plus Jakarta Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    tempCtx.textAlign = 'center';
    tempCtx.textBaseline = 'middle';

    // Áp dụng phong cách vẽ
    if (style === 'tiktok') {
      tempCtx.fillStyle = '#facc15';
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 10 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.strokeStyle = '#000000';
      tempCtx.lineWidth = 3 * scaleFactor;
      tempCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      tempCtx.fillStyle = '#090b10';
      tempCtx.fillText(text, textX, textY);
    } else if (style === 'victory') {
      tempCtx.shadowColor = '#a855f7';
      tempCtx.shadowBlur = 25 * scaleFactor;
      tempCtx.fillStyle = 'rgba(15, 7, 32, 0.9)';
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 12 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.strokeStyle = '#c084fc';
      tempCtx.lineWidth = 3 * scaleFactor;
      tempCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      tempCtx.fillStyle = '#e9d5ff';
      tempCtx.shadowColor = '#c084fc';
      tempCtx.shadowBlur = 15 * scaleFactor;
      tempCtx.fillText(`⚡ ${text} ⚡`, textX, textY);
    } else if (style === 'boom') {
      tempCtx.fillStyle = '#dc2626';
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.strokeStyle = '#fef08a';
      tempCtx.lineWidth = 3.5 * scaleFactor;
      tempCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillText(`💥 ${text}`, textX, textY);
    } else if (style === 'sponge') {
      tempCtx.fillStyle = '#15803d';
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 10 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.strokeStyle = '#4ade80';
      tempCtx.lineWidth = 3.5 * scaleFactor;
      tempCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      tempCtx.fillStyle = '#ffffff';
      tempCtx.shadowColor = '#4ade80';
      tempCtx.shadowBlur = 15 * scaleFactor;
      tempCtx.fillText(text, textX, textY);
    } else if (style === 'social') {
      tempCtx.fillStyle = '#2563eb';
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 20 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.strokeStyle = '#ffffff';
      tempCtx.lineWidth = 2 * scaleFactor;
      tempCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillText(`📢 ${text}`, textX, textY);
    } else if (style === 'custom') {
      tempCtx.fillStyle = bgColor;
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.fillStyle = color;
      tempCtx.fillText(text, textX, textY);
    } else if (style === 'neon') {
      tempCtx.shadowColor = '#ec4899';
      tempCtx.shadowBlur = 20 * scaleFactor;
      tempCtx.fillStyle = 'rgba(24, 9, 43, 0.85)';
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 12 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.strokeStyle = '#f472b6';
      tempCtx.lineWidth = 2 * scaleFactor;
      tempCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      tempCtx.fillStyle = '#f472b6';
      tempCtx.fillText(text, textX, textY);
    } else if (style === 'cinema') {
      tempCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 6 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.fillStyle = '#ffffff';
      tempCtx.shadowColor = 'rgba(0,0,0,0.8)';
      tempCtx.shadowBlur = 10 * scaleFactor;
      tempCtx.fillText(text, textX, textY);
    } else {
      tempCtx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      if (tempCtx.roundRect) {
        tempCtx.beginPath();
        tempCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scaleFactor);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      tempCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      tempCtx.lineWidth = 1.5 * scaleFactor;
      tempCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillText(text, textX, textY);
    }

    tempCtx.restore();

    return {
      canvas: tempCanvas,
      width: boxWidth,
      height: boxHeight,
      textWidth,
      hash
    };
  }

  /**
   * Vẽ trực tiếp (LED ticker cuộn dịch chuyển)
   */
  _renderDirectSubtitle(text, fontSize, style, animSpeed, elapsed, scaleFactor, canvasW, boxWPercent, posX, posY) {
    this.ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    const metrics = this.ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.35;

    const boxWidth = canvasW * (boxWPercent / 100);
    const boxHeight = textHeight + (fontSize * 0.6);

    let boxX = - (boxWidth / 2);
    let boxY = - (boxHeight / 2);
    let textY = 0;

    if (posX >= 75) {
      boxX = - boxWidth;
    } else if (posX <= 25) {
      boxX = 0;
    }

    if (posY >= 75) {
      boxY = - boxHeight;
      textY = - boxHeight / 2;
    } else if (posY <= 25) {
      boxY = 0;
      textY = boxHeight / 2;
    }

    this.ctx.fillStyle = '#06080d';
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10 * scaleFactor);
      this.ctx.fill();
    } else {
      this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = 3 * scaleFactor;
    this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4);
    this.ctx.clip();

    const scrollSpeed = 65 * scaleFactor * animSpeed;
    const totalDist = textWidth + boxWidth;
    const currentOffset = (elapsed * scrollSpeed) % totalDist;
    const mTextX = boxX + boxWidth - currentOffset + (textWidth / 2);
    
    this.ctx.fillStyle = '#fef08a';
    this.ctx.shadowColor = '#f59e0b';
    this.ctx.shadowBlur = 12 * scaleFactor;
    this.ctx.fillText(text, mTextX, textY);
    this.ctx.restore();
  }
}
