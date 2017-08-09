var DRAG_MODE_NONE = 0;
var DRAG_MODE_SELECT = 1;
var DRAG_MODE_SCROLL = 2;

var nSelection = 4;
var dataTree = null;
var canvasContext = null;
var displayInfo = {
  x:0,
  y:0,
  z:1
};
var prevMousePosition = {
  x:0,
  y:0
};
var dragMode = DRAG_MODE_NONE;
var data = [];
var selectedDataIndices = [];
var draggingSelection = -1;
var responsiveCircleRadius = 20;
var normalDPSize = 4;

function loadData(){
  var req = new XMLHttpRequest();
  req.open('GET', 'data.csv', true);
  req.onreadystatechange = function (aEvt) {
    if (req.readyState == 4) {
      if(req.status == 200) {
        var lines = req.responseText.split('\n');
        for(var i = 0; i < lines.length - 1; i++) {
          var line = lines[i].split(',');
          data.push({
            x:parseFloat(line[0]),
            y:parseFloat(line[1]),
            r:parseFloat(line[2]),
            g:parseFloat(line[3]),
            b:parseFloat(line[4]),
            filename:line[5],
            i:i
          });
        }
        dataLoaded();
      } else {
        console.error('data loading error');
      }
    }
  };
  req.send(null);
}

function indexRTree() {
  dataTree = rbush(9, ['.x', '.y', '.x', '.y']);
  dataTree.load(data);
}

function dataLoaded() {
  indexRTree();
  for (var i = 0; i < nSelection; i++){
    changeSelectedDataIndex(i, i);
  }
  canvas = document.getElementById('canvas');
  canvasContext = canvas.getContext('2d');
  canvas.addEventListener('mousedown', canvasMouseDown);
  canvas.addEventListener('mousemove', canvasMouseDragged);
  canvas.addEventListener('mouseup', canvasMouseUp);
  canvas.addEventListener('mousewheel', canvasMouseWheel);
  // start canvas draw
  window.requestAnimationFrame(draw);
}

//draw things
function draw(){
  var canvas = canvasContext.canvas;
  canvasContext.fillStyle = 'black';
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  var minCanvasSideLength = canvas.width < canvas.height ? canvas.width : canvas.height;
  var dataInDisplay = getDataInDisplay();
  for(var i = 0; i<dataInDisplay.length; i++){
    var dp = dataInDisplay[i];
    var x = (dp.x - displayInfo.x) * displayInfo.z * minCanvasSideLength;
    var y = (dp.y - displayInfo.y) * displayInfo.z * minCanvasSideLength;
    if(selectedDataIndices.includes(dp.i)){
      //draw selected point
      // temp
      canvasContext.fillStyle = 'rgb(' + parseInt(dp.r * 255) + ', ' + parseInt(dp.g * 255) + ', ' + parseInt(dp.b * 255) + ')';
      canvasContext.strokeStyle = canvasContext.fillStyle;
      canvasContext.fillRect(x - normalDPSize, y - normalDPSize, 2 * normalDPSize, 2 * normalDPSize);
      canvasContext.beginPath();
      if (dp.i == selectedDataIndices[draggingSelection]) {
        canvasContext.arc(prevMousePosition.x, prevMousePosition.y, responsiveCircleRadius, 0, 6.3, false);
      } else {
        canvasContext.arc(x, y, responsiveCircleRadius, 0, 6.3, false);
      }
      canvasContext.stroke();
      canvasContext.fillText(dp.filename, x, y);
    } else {
      //draw normal point
      canvasContext.fillStyle = 'rgb(' + parseInt(dp.r * 255) + ', ' + parseInt(dp.g * 255) + ', ' + parseInt(dp.b * 255) + ')';
      canvasContext.fillRect(x - normalDPSize / 2, y - normalDPSize / 2, normalDPSize, normalDPSize);
    }
  }
  window.requestAnimationFrame(draw);
}

function getDataInDisplay(){
  var maxX = displayInfo.x + 1 / displayInfo.z;
  var maxY = displayInfo.y + 1 / displayInfo.z;
  return dataTree.search({
    minX:displayInfo.x,
    minY:displayInfo.y,
    maxX:maxX,
    maxY:maxY
  });
}

function getPosition(e){
  var rect = e.currentTarget.getBoundingClientRect();
  var x = e.clientX - rect.left - e.currentTarget.clientLeft + e.currentTarget.scrollLeft;
  var y = e.clientY - rect.top - e.currentTarget.clientTop + e.currentTarget.scrollTop;
  return {x:x, y:y};
}

function getDistance(x1, y1, x2, y2){
  return Math.sqrt((x1-x2)*(x1-x2)+(y1-y2)*(y1-y2));
}

function getNearestDataIndex(p){
  var canvas = canvasContext.canvas;
  var minCanvasSideLength = canvas.width < canvas.height ? canvas.width : canvas.height;
  var x = p.x / displayInfo.z  / minCanvasSideLength + displayInfo.x;
  var y = p.y / displayInfo.z  / minCanvasSideLength + displayInfo.y;
  return data.indexOf(knn(dataTree, x, y, 1)[0]);
}

function changeSelectedDataIndex(i, j) {
  console.log(i, j);
  selectedDataIndices[i] = j;
  //play
}

function canvasMouseDown(e){
  //get in-canvas x, y
  var p = getPosition(e);
  var canvas = canvasContext.canvas;
  var minCanvasSideLength = canvas.width < canvas.height ? canvas.width : canvas.height;

  for (var i = 0; i < nSelection; i++) {
    var dp = data[selectedDataIndices[i]];
    var x = (dp.x - displayInfo.x) * displayInfo.z * minCanvasSideLength;
    var y = (dp.y - displayInfo.y) * displayInfo.z * minCanvasSideLength;

    //if inside the responsive circle
    if (getDistance(p.x, p.y, x, y) < responsiveCircleRadius) {
      dragMode = DRAG_MODE_SELECT;
      draggingSelection = i;
      break;
    } else {
      dragMode = DRAG_MODE_SCROLL;
    }
  }
}

function canvasMouseDragged(e){
  // get in-canvas x, y
  var p = getPosition(e);
  if (dragMode == DRAG_MODE_SELECT) {
    nearestDataIndex = getNearestDataIndex(p);
    if (!(selectedDataIndices.includes(nearestDataIndex))) {
      changeSelectedDataIndex(draggingSelection, nearestDataIndex);
    }
  } else if (dragMode == DRAG_MODE_SCROLL) {
    scrollDisplay(p.x - prevMousePosition.x, p.y - prevMousePosition.y);
  }
  prevMousePosition = p;
}

function canvasMouseUp(){
  dragMode = DRAG_MODE_NONE;
  draggingSelection = -1;
}

function canvasMouseWheel(e){
  var prevZ = displayInfo.z;
  var prevCenterMargin = 0.5 / displayInfo.z;

  if (e.deltaY > 0) {
    displayInfo.z *= 0.9;
  } else if (e.deltaY < 0) {
    displayInfo.z /= 0.9;
  }

  var centerMargin = 0.5 / displayInfo.z;
  displayInfo.x -= (centerMargin - prevCenterMargin);
  displayInfo.y -= (centerMargin - prevCenterMargin);
}

function scrollDisplay(x, y) {
  var canvas = canvasContext.canvas;
  var minCanvasSideLength = canvas.width < canvas.height ? canvas.width : canvas.height;
  displayInfo.x -= x / minCanvasSideLength / displayInfo.z;
  displayInfo.y -= y / minCanvasSideLength / displayInfo.z;
}