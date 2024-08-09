// src/ImageUpload.js
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import otsu from "otsu";
function ImageUpload() {
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);

  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.src = reader.result;

      setOriginalImage(reader.result);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        grayscale(ctx, img.width, img.height);
        dilate(ctx, img.width, img.height);
        divisiveNormalization(ctx, img.width, img.height, 10);
        erode(ctx, img.width, img.height);
        adjustBrightnessContrast(ctx, img.width, img.height, 10, 50);

        setProcessedImage(canvas.toDataURL());
      };
    };

    reader.readAsDataURL(file);
  };

  function truncate(value) {
    return Math.min(255, Math.max(0, value));
  }

  const threshold = (ctx, width, height, level = 0.5) => {
    let imageData = ctx.getImageData(0, 0, width, height);
    let pixels = imageData.data;
    const thresh = Math.floor(level * 255);
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      let val;
      if (gray >= thresh) {
        val = 255;
      } else {
        val = 0;
      }
      pixels[i] = pixels[i + 1] = pixels[i + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
  };

  function divisiveNormalization(ctx, width, height, neighborhoodSize) {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;

    let copy = new Uint8ClampedArray(data);

    const side = neighborhoodSize;
    const halfSide = Math.floor(side / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;

        // Calculate the sum of pixel values in the neighborhood
        for (let ky = -halfSide; ky <= halfSide; ky++) {
          for (let kx = -halfSide; kx <= halfSide; kx++) {
            let posY = y + ky;
            let posX = x + kx;

            if (posY >= 0 && posY < height && posX >= 0 && posX < width) {
              let offset = (posY * width + posX) * 4;
              sum += copy[offset];
              count++;
            }
          }
        }

        let localMean = sum / count;

        // Normalize the pixel value by dividing by the local mean
        let offset = (y * width + x) * 4;
        data[offset] =
          data[offset + 1] =
          data[offset + 2] =
            Math.min(255, (copy[offset] / localMean) * 128);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  const level = (ctx, width, height, blackLevel = 25, whiteLevel = 75) => {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        data[i + j] =
          ((data[i + j] - blackLevel) / (whiteLevel - blackLevel)) * 255;
        data[i + j] = Math.min(Math.max(data[i + j], 0), 255); // Clamp the value between 0 and 255
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const gamma = (ctx, width, height, radius) => {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        data[i + j] = 255 * Math.pow(data[i + j] / 255, 1 / radius);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const density = (ctx, width, height, radius) => {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        data[i + j] = Math.pow(data[i + j] / 255, 1 / radius) * 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const treeDepth = (ctx, width, height, depth) => {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        data[i + j] = Math.pow(data[i + j] / 255, depth) * 255;
        data[i + j] = Math.min(Math.max(data[i + j], 0), 255);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  function grayscale(ctx, width, height) {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = data[i + 1] = data[i + 2] = avg;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function dilate(ctx, width, height) {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;
    let copy = new Uint8ClampedArray(data);

    const kernel = [
      -1,
      0,
      1,
      -width,
      width,
      -width - 1,
      -width + 1,
      width - 1,
      width + 1,
    ];

    for (let i = 0; i < data.length; i += 4) {
      let max = 0;
      for (let j = 0; j < kernel.length; j++) {
        let offset = i + kernel[j] * 4;
        if (offset >= 0 && offset < data.length) {
          max = Math.max(max, copy[offset]);
        }
      }
      data[i] = data[i + 1] = data[i + 2] = max;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function detectEdges(ctx, width, height) {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;
    let grayData = new Uint8ClampedArray(data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      grayData[i / 4] = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    }

    let sobelData = new Uint8ClampedArray(grayData.length);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let pixelX =
          sobelX[0] * grayData[(y - 1) * width + (x - 1)] +
          sobelX[1] * grayData[(y - 1) * width + x] +
          sobelX[2] * grayData[(y - 1) * width + (x + 1)] +
          sobelX[3] * grayData[y * width + (x - 1)] +
          sobelX[4] * grayData[y * width + x] +
          sobelX[5] * grayData[y * width + (x + 1)] +
          sobelX[6] * grayData[(y + 1) * width + (x - 1)] +
          sobelX[7] * grayData[(y + 1) * width + x] +
          sobelX[8] * grayData[(y + 1) * width + (x + 1)];

        let pixelY =
          sobelY[0] * grayData[(y - 1) * width + (x - 1)] +
          sobelY[1] * grayData[(y - 1) * width + x] +
          sobelY[2] * grayData[(y - 1) * width + (x + 1)] +
          sobelY[3] * grayData[y * width + (x - 1)] +
          sobelY[4] * grayData[y * width + x] +
          sobelY[5] * grayData[y * width + (x + 1)] +
          sobelY[6] * grayData[(y + 1) * width + (x - 1)] +
          sobelY[7] * grayData[(y + 1) * width + x] +
          sobelY[8] * grayData[(y + 1) * width + (x + 1)];

        let magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY) >>> 0;

        sobelData[y * width + x] = magnitude > 255 ? 255 : magnitude;
      }
    }

    for (let i = 0; i < sobelData.length; i++) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = sobelData[i];
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function erode(ctx, width, height) {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;
    let copy = new Uint8ClampedArray(data);

    const kernel = [
      -1,
      0,
      1,
      -width,
      width,
      -width - 1,
      -width + 1,
      width - 1,
      width + 1,
    ];

    for (let i = 0; i < data.length; i += 4) {
      let min = 255;
      for (let j = 0; j < kernel.length; j++) {
        let offset = i + kernel[j] * 4;
        if (offset >= 0 && offset < data.length) {
          min = Math.min(min, copy[offset]);
        }
      }
      data[i] = data[i + 1] = data[i + 2] = min;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function adjustBrightnessContrast(ctx, width, height, brightness, contrast) {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;

    brightness = brightness || 0;
    contrast = contrast || 0;

    for (let i = 0; i < data.length; i += 4) {
      // Adjust Brightness
      data[i] += brightness;
      data[i + 1] += brightness;
      data[i + 2] += brightness;

      // Adjust Contrast
      data[i] = (data[i] - 128) * contrast + 128;
      data[i + 1] = (data[i + 1] - 128) * contrast + 128;
      data[i + 2] = (data[i + 2] - 128) * contrast + 128;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function smooth(ctx, width, height) {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;

    const kernel = [
      1 / 9,
      1 / 9,
      1 / 9,
      1 / 9,
      1 / 9,
      1 / 9,
      1 / 9,
      1 / 9,
      1 / 9,
    ];
    const side = Math.round(Math.sqrt(kernel.length));
    const halfSide = Math.floor(side / 2);

    let output = new Uint8ClampedArray(data.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0;
        for (let kernelY = 0; kernelY < side; kernelY++) {
          for (let kernelX = 0; kernelX < side; kernelX++) {
            let currentY = y + kernelY - halfSide;
            let currentX = x + kernelX - halfSide;
            if (
              currentY >= 0 &&
              currentY < height &&
              currentX >= 0 &&
              currentX < width
            ) {
              let offset = (currentY * width + currentX) * 4;
              r += data[offset] * kernel[kernelY * side + kernelX];
              g += data[offset + 1] * kernel[kernelY * side + kernelX];
              b += data[offset + 2] * kernel[kernelY * side + kernelX];
            }
          }
        }
        let offset = (y * width + x) * 4;
        output[offset] = r;
        output[offset + 1] = g;
        output[offset + 2] = b;
        output[offset + 3] = data[offset + 3];
      }
    }

    ctx.putImageData(new ImageData(output, width, height), 0, 0);
  }

  function adaptiveThreshold(ctx, width, height, blockSize, c) {
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;

    let grayData = new Uint8ClampedArray(data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      grayData[i / 4] = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    }

    let thresholdData = new Uint8ClampedArray(grayData.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;

        for (let ky = -blockSize; ky <= blockSize; ky++) {
          for (let kx = -blockSize; kx <= blockSize; kx++) {
            let posY = y + ky;
            let posX = x + kx;

            if (posY >= 0 && posY < height && posX >= 0 && posX < width) {
              sum += grayData[posY * width + posX];
              count++;
            }
          }
        }

        let localMean = sum / count;
        thresholdData[y * width + x] =
          grayData[y * width + x] > localMean - c ? 255 : 0;
      }
    }

    for (let i = 0; i < thresholdData.length; i++) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = thresholdData[i];
    }

    ctx.putImageData(imageData, 0, 0);
  }

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: "2px dashed #aaa",
          padding: "20px",
          cursor: "pointer",
        }}
      >
        <input {...getInputProps()} />
        <p>Drag 'n' drop an image here, or click to select one</p>
      </div>
      {originalImage && (
        <div>
          <h2>Original Image:</h2>
          <img
            src={originalImage}
            alt="Original"
            style={{ maxWidth: "100%", marginTop: "20px" }}
          />
        </div>
      )}
      {processedImage && (
        <div>
          <h2>Processed Image:</h2>
          <img
            src={processedImage}
            alt="Processed"
            style={{ maxWidth: "100%", marginTop: "20px" }}
          />
        </div>
      )}
    </div>
  );
}

export default ImageUpload;
