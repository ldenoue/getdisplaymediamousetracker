//import { ShaderRenderer } from './shader-renderer.js';
import './tracking-min.js';
import './jsfeat.js';
import { BlobExtractionLaurent_u8, BlobBounds_u8 } from './connected-component-labelling.js';

const fps = 60 // assuming requestAnimationFrame is at 60fps
const zoomDuration = 1000
let zoomDelta = 0
let current = null;
const RADIUS = 4
let zooming = false
let timeout = null
let lastDiff = []
let lastMouse = null
let w = 0
let h = 0
let previous = null
let pdata = null
let diff = null
let ddata = null
let processing = false
let reduceFactor = 2
let canvas = document.createElement('canvas')
let ctx = null
const threshold = 32
var img_u8 = null
var label = null
var blobDiff = null
var previousgray = null
var emptyLabel = null
let coords = []
let videoWidth = 0
let videoHeight = 0
let minsize = 0
let maxsize = 0

function blobDifference(label,result,gray1,gray2,width,height, threshold)
  {
    var n = result.length;
    //var x,y;
    var points = [];
    for (var index=0;index<n;index++)
    {
      if (Math.abs(gray1[index]-gray2[index]) > threshold)
      {
        //x = index % width;
        //y = (index / width) | 0;
        //points.push(x,y);
        result[index] = 1;
      }
      else
        result[index] = 0;
    }
    BlobExtractionLaurent_u8(label,result,width,height);
    let boxes = BlobBounds_u8(label, width, height);
    const MINW = 1;
    const MINH = 1;
    for (let i=0;i<boxes.length;i++)
    {
      const b = boxes[i];
      if (b.l !== 65535 && b.x1 > 0 && b.y1 > 0 && b.y2-b.y1>= MINH && b.x2-b.x1>= MINW)
        points.push({x:b.x1,y:b.y1,w:b.x2-b.x1+1,h:b.y2-b.y1+1});
    }
    return points;
  }
function initCanvas(video) {
  videoWidth = video.videoWidth
  videoHeight = video.videoHeight
  w = parseInt(videoWidth / reduceFactor)
  h = parseInt(videoHeight / reduceFactor)
  canvas.width = w
  canvas.height = h
  ctx = canvas.getContext('2d', {willReadFrequently: true})
  minsize = w / 60
  maxsize = w / 4
  img_u8 = new jsfeat.matrix_t(w, h, jsfeat.U8C1_t);
  previous = ctx.createImageData(w,h);
  pdata = previous.data;
  label = new Uint16Array(w * h);
  blobDiff = new Uint8ClampedArray(w * h);
  emptyLabel = new Uint16Array(w * h);
  previousgray = new Uint8ClampedArray(w * h);
}


function zoomInOut() {
  zoomPosition = null
}

let scale = 1.0
let zoomPosition = null

function draw(video) {
  ctx.drawImage(video,0,0,videoWidth,videoHeight,0,0,w,h);
  current = ctx.getImageData(0,0,w,h);
  const grayscale = tracking.Image.grayscale(current.data, w, h);
  label.set(emptyLabel);
  let diff = blobDifference(label,blobDiff,previousgray,grayscale,w,h, threshold);
  previousgray.set(grayscale);
  let newPos = [];
  for (let d of diff) {
    let found = false;
    for (let l of lastDiff) {
      if (d.x === l.x && d.y === l.y) {
        found = true;
        break
      }
    }
    if (!found)
      newPos.push(d)
  }
  //ctx.save();
  //ctx.fillStyle = 'blue'
  //ctx.strokeStyle = 'blue'
  let newMouse = null
  //ctx.lineWidth = 3

  if (newPos.length > 0 && newPos.length <= 3) {
    /*let x = newPos.reduce((acc,p) => p.x + acc, 0) / newPos.length
    let y = newPos.reduce((acc,p) => p.y + acc, 0) / newPos.length
    newMouse = {x,y}*/
    newMouse = newPos[0]
    //if (lastMouse && (Math.abs(lastMouse.x - newMouse.x) > 64 || Math.abs(lastMouse.y - newMouse.y) > 64))
    //  newMouse = null
  }
  if (newMouse) {
    clearTimeout(timeout)
    timeout = null
    coords.push(newMouse)
    lastMouse = newMouse
  } else if (!timeout) {
    timeout = setTimeout(() => {
      zoomPosition = detectWiggles(coords)
      coords = []
      if (zoomPosition) {
        scale = 1.0
        zoomDelta = 1000 / (zoomDuration * fps)
        zooming = true
        //setTimeout(() => zoomInOut(), zoomDuration)
      }
    }, 200)
  }
  lastDiff = newPos;
  if (!lastMouse)
    return null
  return {x: lastMouse.x * 100 / w, y: lastMouse.y * 100 / h}
}

function detectWiggles(coords = []) {
  if (coords.length < 2)
    return null
  let lastX = coords[0].x
  let lastY = coords[0].y
  let lastDirectionX = -10
  let nWigglesX = 0
  let lastDirectionY = -10
  let nWigglesY = 0
  let deltasX = []
  let deltasY = []
  let minx = 5000
  let maxx = -5000
  let miny = 5000
  let maxy = -5000
  for (let i=1;i<coords.length;i++) {
    let c = coords[i]
    minx = Math.min(minx,c.x)
    maxx = Math.max(maxx,c.x)
    miny = Math.min(miny,c.y)
    maxy = Math.max(maxy,c.y)
    let x = c.x
    let y = c.y
    let deltaX = x - lastX
    lastX = x
    let newDirectionX = 0
    if (deltaX > 0) {
      newDirectionX = 1
    } else if (deltaX <= 0) {
      newDirectionX = -1
    }
    if (newDirectionX !== 0 && newDirectionX !== lastDirectionX) {
      deltasX.push({minx,maxx})
      minx = 5000
      maxx = -5000
      nWigglesX++
    }
    let deltaY = y - lastY
    lastY = y
    let newDirectionY = 0
    if (deltaY > 0) {
      newDirectionY = 1
    } else if (deltaY <= 0) {
      newDirectionY = -1
    }
    if (newDirectionY !== 0 && newDirectionY !== lastDirectionY) {
      deltasY.push({miny,maxy})
      miny = 5000
      maxy = -5000
      nWigglesY++
    }
    lastDirectionX = newDirectionX
    lastDirectionY = newDirectionY
  }
  deltasX = deltasX.map(d => new Object({c:(d.minx+d.maxx)/2,d:d.maxx-d.minx})).filter(d => d.d < maxsize && d.d > minsize)
  deltasY = deltasY.map(d => new Object({c:(d.miny+d.maxy)/2,d:d.maxy-d.miny})).filter(d => d.d < maxsize && d.d > minsize)
  if (deltasX.length < 2 || deltasY.length < 2)
    return null
  let midX = deltasX.reduce((acc,n) => n.c + acc, 0) / deltasX.length
  let midY = deltasY.reduce((acc,n) => n.c + acc, 0) / deltasY.length
  let size = deltasX.reduce((acc,n) => n.d + acc, 0) / deltasX.length
  const center = {x: midX * reduceFactor, y: midY * reduceFactor, size: size * reduceFactor}
  return center
}

class FilterStream {
  constructor(stream, shader) {
    this.stream = stream;
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    this.canvas = canvas;
    //this.renderer = new ShaderRenderer(this.canvas, video, shader);

    video.addEventListener("playing", () => {
      // Use a 2D Canvas.
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      this.cursorSize = Math.min(32, this.video.videoWidth / 30)
      initCanvas(this.video)
      console.log('playing')
      // Use a WebGL Renderer.
      //this.renderer.setSize(this.video.videoWidth, this.video.videoHeight);
      this.update();
    });
    video.srcObject = stream;
    video.autoplay = true;
    this.video = video;
    this.ctx = this.canvas.getContext('2d');
    this.outputStream = this.canvas.captureStream();
  }

  update() {
    if (zoomPosition && zooming) {
      scale += zoomDelta
      if (scale > 2.0) {
        zoomDelta = -zoomDelta
      }
      if (scale < 1.0) {
        zooming = false
      }
      let vw = this.video.videoWidth
      let vh = this.video.videoHeight
      let w = vw * scale
      let h = vh * scale
      let x = zoomPosition.x - zoomPosition.x * scale
      let y = zoomPosition.y - zoomPosition.y * scale
      this.ctx.drawImage(this.video,0,0,vw,vh,x,y,w,h)
    } else {
      this.ctx.drawImage(this.video, 0, 0);
    }
    //this.ctx.drawImage(this.video, 0, 0);
    let mousePos = draw(this.video)
    if (mousePos && mousePos.x) {
      let x = mousePos.x * this.video.videoWidth / 100
      let y = mousePos.y * this.video.videoHeight / 100
      this.ctx.fillStyle = 'rgba(0,0,255,0.3)'
      this.ctx.strokeStyle = 'rgba(0,0,255,0.3)'
      this.ctx.beginPath()
      this.ctx.arc(x, y, this.cursorSize, 0, Math.PI * 2, false)
      this.ctx.fill()
    }
    /*if (zoomPosition) {
      console.log('zoomPosition=',zoomPosition)
      let x = zoomPosition.x
      let y = zoomPosition.y
      let size = zoomPosition.size
      this.ctx.strokeRect(x - size, y - size, size * 2, size * 2)
    }*/
    // Use a WebGL renderer.
    //this.renderer.render();
    requestAnimationFrame(() => this.update());
  }
}

export { FilterStream }