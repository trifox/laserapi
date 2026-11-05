/**
 *  IFrame Loader
 */
const searchParams = new URLSearchParams(window.location.search);

var ifrm;
var iframeWindow;
var config = {
  uri: searchParams.get('laserGameIframeUrl') || '/testgame/index.html',
  debug: !!searchParams.get('debug'),
};
var initCalled = false;
var iframeApi = {
  util: {
    fillButton: require('./gui/iframe_fillButton.js').default,
    renderRaster: require('./gui/iframe_renderRaster.js').default,
  },
};

function prepareFrame() {
  if (!ifrm) {
    console.log('creating iframe');
    ifrm = document.createElement('iframe');
    ifrm.setAttribute('src', config.uri + '?&' + Math.random());
    ifrm.style.width = '640px';
    ifrm.style.height = '480px';
    ifrm.style.left = '0px';
    ifrm.style.top = '0px';
    ifrm.style.position = 'absolute';
    document.body.appendChild(ifrm);

    iframeWindow = ifrm.contentWindow;
    iframeWindow.laser = iframeApi;
  }
}
function removeFrame() {
  document.body.removeChild(ifrm);
  ifrm = null;
}
var mouseX;
var mouseY;
var clientWidth;
var clientHeight;

const debugMouseCatcher = (ev) => {
  mouseX = ev.clientX;
  mouseY = ev.clientY;
  clientWidth = ev.target.clientWidth;
  clientHeight = ev.target.clientHeight;
};
export default {
  name: 'IFrame Game Loader',
  description: `
  
  tragt die index.html des iframes als query parameter ein:

  ?laserGameIframeUrl=...

  eventuell solltet ihr noch cross domain checking deaktivieren
  
 .`,
  image: 'media/img/gametitles/iframefun.png',
  init: function (data) {
    // hier halt iframe erzeugen
    console.log('iframe init game iframe ', config);

    console.log('iframe config', iframeApi);
    console.log('iframe  %cHello!\nwie gehts?', 'font-size: 3em');

    prepareFrame();
    document
      .getElementById('canvascontainer')
      .addEventListener('mousemove', debugMouseCatcher);
    initCalled = false;
  },
  stop: function () {
    console.log('iframe stopping game iframe ', config);

    if (iframeWindow && typeof iframeWindow.stop === 'function') {
      // console.log('Icalling into iframe');
      if (config.debug) {
        // Provide Mouse coords
      }
      //console.log('iframe', iframeWindow.handle);
      iframeWindow.stop(grid, elapsed);
    }

    removeFrame();
    document
      .getElementById('canvascontainer')
      .removeEventListener('mousemove', debugMouseCatcher);
    console.log(document.getElementById('canvascontainer'));
    // hier halt iframe erzeugen
  },
  handle: function (grid, elapsed) {
    //console.log('Iframe und dann call der method', ifrm, iframeWindow);

    if (
      !initCalled &&
      iframeWindow &&
      typeof iframeWindow.start === 'function'
    ) {
      // console.log('Icalling into iframe');
      initCalled = true;
      //console.log('iframe', iframeWindow.handle);
      iframeWindow.start();
    }

    if (iframeWindow && typeof iframeWindow.handle === 'function') {
      //  console.log('Icalling into iframe');
      if (config.debug) {
        // Provide Mouse coords
        let sizeX = Math.round(Math.sqrt(grid.length));
        let sizeY = Math.round(Math.sqrt(grid.length));
        var coord =
          (mouseX / clientWidth) * sizeX +
          (mouseY / clientHeight) * sizeX * sizeY;
        console.log(
          'coord is',
          clientWidth,
          clientHeight,
          sizeX,
          sizeY,
          Math.floor(coord)
        );
        grid[Math.floor(coord)] = 1;
      }
      // console.log(grid, mouseX, mouseY);
      iframeWindow.handle(grid, elapsed);
    }
  },
};
